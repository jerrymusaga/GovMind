//! Collective Aggregator PVM Contract — Dynamic collective profile computation on RISC-V
//!
//! Computes the blended governance profile for a collective by combining the
//! founder's seed profile with the weighted average of all members' on-chain identities.
//!
//! Called from CollectiveRegistry.sol (EVM) via pallet-revive cross-VM dispatch.
//!
//! Two functions (selected by 4-byte selector):
//!
//! recalculateOnJoin(uint8[6] seed, uint8[6] currentAxes, uint8[6] newMemberAxes, uint32 memberCount, uint8 seedWeight)
//!   → uint8[6] updatedAxes
//!
//! recalculateOnLeave(uint8[6] seed, uint8[6] currentAxes, uint8[6] leavingMemberAxes, uint32 memberCount, uint8 seedWeight)
//!   → uint8[6] updatedAxes

#![no_std]
#![no_main]

use uapi::{input, HostFn, HostFnImpl as api, ReturnFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Max input: 4 selector + 5 args
    // Each arg is either uint8[6] (6 x 32 bytes = 192 bytes) or uint32/uint8 (32 bytes)
    // seed(192) + currentAxes(192) + newMemberAxes(192) + memberCount(32) + seedWeight(32) = 640
    // Total: 4 + 640 = 644 bytes
    input!(buf: &[u8; 644],);

    // Read 4-byte function selector
    let selector: [u8; 4] = [buf[0], buf[1], buf[2], buf[3]];

    // Parse common arguments
    // seed axes: 6 x uint8, each in a 32-byte slot starting at offset 4
    let seed = read_axes(buf, 4);
    // current axes: 6 x uint8, starting at offset 4 + 192 = 196
    let current = read_axes(buf, 196);
    // member axes (joining or leaving): 6 x uint8, starting at offset 388
    let member = read_axes(buf, 388);
    // member count: uint32, at offset 580 (right-aligned in 32-byte slot)
    let member_count = read_u32(buf, 580);
    // seed weight: uint8, at offset 612 (right-aligned in 32-byte slot)
    let seed_weight = buf[612 + 31];

    // Selector for recalculateOnJoin vs recalculateOnLeave
    // We use the first byte to distinguish: 0 for join, anything else for leave
    // In practice, the EVM will call with the correct Solidity selector
    let result = if selector == [0x8a, 0x9b, 0x37, 0x71] {
        // recalculateOnLeave
        recalculate_on_leave(&seed, &current, &member, member_count, seed_weight)
    } else {
        // recalculateOnJoin (default)
        recalculate_on_join(&seed, &current, &member, member_count, seed_weight)
    };

    // Return uint8[6] = 6 x 32-byte ABI slots = 192 bytes
    let mut output = [0u8; 192];
    for i in 0..6 {
        output[i * 32 + 31] = result[i];
    }

    api::return_value(ReturnFlags::empty(), &output);
}

/// Read 6 uint8 values from ABI-encoded uint8[6] (6 x 32-byte slots)
fn read_axes(buf: &[u8], offset: usize) -> [u8; 6] {
    [
        buf[offset + 31],
        buf[offset + 32 + 31],
        buf[offset + 64 + 31],
        buf[offset + 96 + 31],
        buf[offset + 128 + 31],
        buf[offset + 160 + 31],
    ]
}

/// Read a uint32 from a 32-byte ABI slot (right-aligned, big-endian)
fn read_u32(buf: &[u8], offset: usize) -> u32 {
    ((buf[offset + 28] as u32) << 24)
        | ((buf[offset + 29] as u32) << 16)
        | ((buf[offset + 30] as u32) << 8)
        | (buf[offset + 31] as u32)
}

// ============================================================
//  CORE: Dynamic Profile Aggregation
// ============================================================

/// Recalculate collective profile when a new member joins.
///
/// Formula: blended = seed * seedWeight + memberAvg * (100 - seedWeight)
///
/// memberAvg after join = (currentMemberAvg * count + newMember) / (count + 1)
/// where currentMemberAvg is derived from current axes and seed.
fn recalculate_on_join(
    seed: &[u8; 6],
    current: &[u8; 6],
    new_member: &[u8; 6],
    member_count: u32,
    seed_weight: u8,
) -> [u8; 6] {
    let sw = seed_weight as u32;
    let mw = 100 - sw; // member weight

    let mut result = [0u8; 6];

    if member_count == 0 {
        // First member: blend seed with this member's axes
        for i in 0..6 {
            let blended = (seed[i] as u32 * sw + new_member[i] as u32 * mw) / 100;
            result[i] = clamp(blended);
        }
    } else {
        // Reverse-engineer current member average from current blended axes
        // current[i] = (seed[i] * sw + memberAvg[i] * mw) / 100
        // memberAvg[i] = (current[i] * 100 - seed[i] * sw) / mw
        for i in 0..6 {
            let current_total = current[i] as u32 * 100;
            let seed_part = seed[i] as u32 * sw;

            // Avoid underflow
            let member_avg_x100 = if current_total >= seed_part {
                (current_total - seed_part) * 100 / mw
            } else {
                0
            };

            // New member average: (old_avg * count + new_member * 100) / (count + 1)
            let new_avg_x100 = (member_avg_x100 * member_count + new_member[i] as u32 * 100) / (member_count + 1);

            // Blend: seed * sw + new_avg * mw / 100
            let blended = (seed[i] as u32 * sw + new_avg_x100 * mw / 100) / 100;
            result[i] = clamp(blended);
        }
    }

    result
}

/// Recalculate collective profile when a member leaves.
fn recalculate_on_leave(
    seed: &[u8; 6],
    current: &[u8; 6],
    leaving_member: &[u8; 6],
    member_count: u32,
    seed_weight: u8,
) -> [u8; 6] {
    let sw = seed_weight as u32;
    let mw = 100 - sw;

    let mut result = [0u8; 6];

    if member_count <= 1 {
        // Last member leaving: revert to pure seed profile
        return *seed;
    }

    for i in 0..6 {
        let current_total = current[i] as u32 * 100;
        let seed_part = seed[i] as u32 * sw;

        let member_avg_x100 = if current_total >= seed_part {
            (current_total - seed_part) * 100 / mw
        } else {
            0
        };

        // Remove leaving member: (old_avg * count - leaving * 100) / (count - 1)
        let leaving_x100 = leaving_member[i] as u32 * 100;
        let numerator = if member_avg_x100 * member_count >= leaving_x100 {
            member_avg_x100 * member_count - leaving_x100
        } else {
            0
        };
        let new_avg_x100 = numerator / (member_count - 1);

        let blended = (seed[i] as u32 * sw + new_avg_x100 * mw / 100) / 100;
        result[i] = clamp(blended);
    }

    result
}

fn clamp(val: u32) -> u8 {
    if val > 100 { 100 } else { val as u8 }
}
