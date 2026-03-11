//! SCALE Codec PVM Contract — Native Substrate encoding on RISC-V
//!
//! This contract provides SCALE encoding functions that can be called
//! from Solidity EVM contracts via pallet-revive's cross-VM dispatch.
//!
//! Exposed functions (Ethereum ABI):
//!   encodeVoteCall(uint32 pollIndex, bool aye, uint8 conviction, uint128 balance)
//!     → returns (bytes)
//!   encodeCompactU32(uint32 value) → returns (bytes)
//!   encodeU128LE(uint128 value) → returns (bytes)
//!
//! Function selectors:
//!   encodeVoteCall:   keccak256("encodeVoteCall(uint32,bool,uint8,uint128)")[0:4]
//!   encodeCompactU32: keccak256("encodeCompactU32(uint32)")[0:4]
//!   encodeU128LE:     keccak256("encodeU128LE(uint128)")[0:4]

#![no_std]
#![no_main]

extern crate alloc;

use alloc::vec::Vec;
use uapi::{input, HostFn, HostFnImpl as api, ReturnFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

// ============================================================
//                    FUNCTION SELECTORS
// ============================================================
// Pre-computed keccak256 selectors (first 4 bytes)
// encodeVoteCall(uint32,bool,uint8,uint128) = 0x6b8a5864
const SELECTOR_ENCODE_VOTE_CALL: [u8; 4] = [0x6b, 0x8a, 0x58, 0x64];
// encodeCompactU32(uint32) = 0x9c0c4be6
const SELECTOR_ENCODE_COMPACT_U32: [u8; 4] = [0x9c, 0x0c, 0x4b, 0xe6];
// encodeU128LE(uint128) = 0x7c5aa57d
const SELECTOR_ENCODE_U128_LE: [u8; 4] = [0x7c, 0x5a, 0xa5, 0x7d];

// ============================================================
//                    ENTRY POINTS
// ============================================================

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Read up to 132 bytes of calldata:
    // 4 selector + up to 4 x 32-byte args = 132
    input!(buf: &[u8; 132],);

    let selector: [u8; 4] = [buf[0], buf[1], buf[2], buf[3]];

    match selector {
        SELECTOR_ENCODE_VOTE_CALL => handle_encode_vote_call(buf),
        SELECTOR_ENCODE_COMPACT_U32 => handle_encode_compact_u32(buf),
        SELECTOR_ENCODE_U128_LE => handle_encode_u128_le(buf),
        _ => {
            // Unknown selector — revert
            unsafe { core::arch::asm!("unimp", options(noreturn)) }
        }
    }
}

// ============================================================
//                    HANDLERS
// ============================================================

/// encodeVoteCall(uint32 pollIndex, bool aye, uint8 conviction, uint128 balance)
/// ABI layout:
///   bytes  4..36:  pollIndex (uint32, right-aligned in 32 bytes)
///   bytes 36..68:  aye (bool, right-aligned)
///   bytes 68..100: conviction (uint8, right-aligned)
///   bytes 100..132: balance (uint128, right-aligned)
fn handle_encode_vote_call(buf: &[u8; 132]) {
    let poll_index = read_u32(buf, 4);
    let aye = buf[67] != 0;
    let conviction = buf[99];
    let balance = read_u128(buf, 100);

    // SCALE-encode convictionVoting.vote() call
    let mut result = Vec::new();

    // Pallet index: 20 (convictionVoting)
    result.push(20u8);
    // Call index: 0 (vote)
    result.push(0u8);
    // poll_index as SCALE compact u32
    encode_compact_u32_into(poll_index, &mut result);
    // AccountVote::Standard variant = 0x00
    result.push(0x00);
    // Vote byte: bit 7 = aye, bits 0-6 = conviction
    let vote_byte = conviction | if aye { 0x80 } else { 0x00 };
    result.push(vote_byte);
    // Balance as fixed-width u128 LE
    encode_u128_le_into(balance, &mut result);

    return_bytes(&result);
}

/// encodeCompactU32(uint32 value)
/// ABI layout:
///   bytes 4..36: value (uint32, right-aligned)
fn handle_encode_compact_u32(buf: &[u8; 132]) {
    let value = read_u32(buf, 4);
    let mut result = Vec::new();
    encode_compact_u32_into(value, &mut result);
    return_bytes(&result);
}

/// encodeU128LE(uint128 value)
/// ABI layout:
///   bytes 4..36: value (uint128, right-aligned in 32 bytes)
fn handle_encode_u128_le(buf: &[u8; 132]) {
    let value = read_u128(buf, 4);
    let mut result = Vec::new();
    encode_u128_le_into(value, &mut result);
    return_bytes(&result);
}

// ============================================================
//                    SCALE ENCODING
// ============================================================

/// SCALE compact encoding for u32
/// 0-63:         single byte,  val << 2 | 0b00
/// 64-16383:     two bytes,    val << 2 | 0b01
/// 16384-2^30-1: four bytes,   val << 2 | 0b10
fn encode_compact_u32_into(value: u32, out: &mut Vec<u8>) {
    if value <= 63 {
        out.push((value as u8) << 2);
    } else if value <= 16383 {
        let encoded = ((value as u16) << 2) | 0x01;
        out.push((encoded & 0xFF) as u8);
        out.push((encoded >> 8) as u8);
    } else {
        let encoded = (value << 2) | 0x02;
        out.push((encoded & 0xFF) as u8);
        out.push(((encoded >> 8) & 0xFF) as u8);
        out.push(((encoded >> 16) & 0xFF) as u8);
        out.push(((encoded >> 24) & 0xFF) as u8);
    }
}

/// Fixed-width u128 little-endian encoding (16 bytes)
fn encode_u128_le_into(value: u128, out: &mut Vec<u8>) {
    let bytes = value.to_le_bytes();
    out.extend_from_slice(&bytes);
}

// ============================================================
//                    ABI HELPERS
// ============================================================

/// Read a uint32 from ABI-encoded calldata (right-aligned in 32-byte slot)
fn read_u32(buf: &[u8], offset: usize) -> u32 {
    let b = &buf[offset + 28..offset + 32];
    u32::from_be_bytes([b[0], b[1], b[2], b[3]])
}

/// Read a uint128 from ABI-encoded calldata (right-aligned in 32-byte slot)
fn read_u128(buf: &[u8], offset: usize) -> u128 {
    let b = &buf[offset + 16..offset + 32];
    u128::from_be_bytes([
        b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
        b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15],
    ])
}

/// Return dynamic bytes via ABI encoding
/// ABI encoding for `bytes`:
///   offset (32 bytes) = 0x20 (points to data start)
///   length (32 bytes) = data.len()
///   data   (padded to 32-byte boundary)
fn return_bytes(data: &[u8]) {
    let padded_len = (data.len() + 31) & !31; // round up to 32
    let total = 32 + 32 + padded_len;         // offset + length + padded data

    let mut output = Vec::with_capacity(total);

    // Offset: 0x0000...0020 (32 bytes, big-endian)
    let mut offset_bytes = [0u8; 32];
    offset_bytes[31] = 0x20;
    output.extend_from_slice(&offset_bytes);

    // Length: data.len() (32 bytes, big-endian)
    let mut len_bytes = [0u8; 32];
    let len = data.len() as u64;
    len_bytes[24..32].copy_from_slice(&len.to_be_bytes());
    output.extend_from_slice(&len_bytes);

    // Data (padded with zeros)
    output.extend_from_slice(data);
    for _ in 0..(padded_len - data.len()) {
        output.push(0);
    }

    api::return_value(ReturnFlags::empty(), &output);
}
