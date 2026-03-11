//! SCALE Codec PVM Contract — Native Substrate encoding on RISC-V
//!
//! Provides SCALE encoding functions called from Solidity EVM contracts
//! via pallet-revive's cross-VM dispatch. No bridge. No XCM. One call.
//!
//! Exposed functions (Ethereum ABI):
//!   encodeVoteCall(uint32, bool, uint8, uint128) → bytes
//!   encodeCompactU32(uint32) → bytes
//!   encodeU128LE(uint128) → bytes

#![no_std]
#![no_main]

use uapi::{input, HostFn, HostFnImpl as api, ReturnFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

// Function selectors (pre-computed keccak256 first 4 bytes)
const SEL_VOTE_CALL: [u8; 4] = [0x6b, 0x8a, 0x58, 0x64];
const SEL_COMPACT_U32: [u8; 4] = [0x9c, 0x0c, 0x4b, 0xe6];
const SEL_U128_LE: [u8; 4] = [0x7c, 0x5a, 0xa5, 0x7d];

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // 4 selector + 4 x 32-byte args = 132
    input!(buf: &[u8; 132],);

    let sel: [u8; 4] = [buf[0], buf[1], buf[2], buf[3]];

    match sel {
        SEL_VOTE_CALL => handle_encode_vote_call(buf),
        SEL_COMPACT_U32 => handle_encode_compact_u32(buf),
        SEL_U128_LE => handle_encode_u128_le(buf),
        _ => unsafe { core::arch::asm!("unimp", options(noreturn)) },
    }
}

// ============================================================
//  HANDLER: encodeVoteCall(uint32, bool, uint8, uint128)
// ============================================================

fn handle_encode_vote_call(buf: &[u8; 132]) {
    let poll_index = read_u32(buf, 4);
    let aye = buf[67] != 0;
    let conviction = buf[99];
    let balance = read_u128(buf, 100);

    // Max encoded size: 2 + 4 + 1 + 1 + 16 = 24 bytes
    let mut data = [0u8; 24];
    let mut pos: usize = 0;

    // Pallet index: 20 (convictionVoting)
    data[pos] = 20;
    pos += 1;
    // Call index: 0 (vote)
    data[pos] = 0;
    pos += 1;
    // poll_index as SCALE compact u32
    pos += write_compact_u32(poll_index, &mut data, pos);
    // AccountVote::Standard variant = 0x00
    data[pos] = 0x00;
    pos += 1;
    // Vote byte: bit 7 = aye, bits 0-6 = conviction
    data[pos] = conviction | if aye { 0x80 } else { 0x00 };
    pos += 1;
    // Balance as fixed-width u128 LE (16 bytes)
    write_u128_le(balance, &mut data, pos);
    pos += 16;

    return_bytes(&data[..pos]);
}

// ============================================================
//  HANDLER: encodeCompactU32(uint32)
// ============================================================

fn handle_encode_compact_u32(buf: &[u8; 132]) {
    let value = read_u32(buf, 4);
    let mut data = [0u8; 4];
    let len = write_compact_u32(value, &mut data, 0);
    return_bytes(&data[..len]);
}

// ============================================================
//  HANDLER: encodeU128LE(uint128)
// ============================================================

fn handle_encode_u128_le(buf: &[u8; 132]) {
    let value = read_u128(buf, 4);
    let mut data = [0u8; 16];
    write_u128_le(value, &mut data, 0);
    return_bytes(&data);
}

// ============================================================
//  SCALE ENCODING FUNCTIONS
// ============================================================

/// SCALE compact u32 encoding. Returns number of bytes written.
fn write_compact_u32(value: u32, out: &mut [u8], pos: usize) -> usize {
    if value <= 63 {
        out[pos] = (value as u8) << 2;
        1
    } else if value <= 16383 {
        let encoded = ((value as u16) << 2) | 0x01;
        out[pos] = (encoded & 0xFF) as u8;
        out[pos + 1] = (encoded >> 8) as u8;
        2
    } else {
        let encoded = (value << 2) | 0x02;
        out[pos] = (encoded & 0xFF) as u8;
        out[pos + 1] = ((encoded >> 8) & 0xFF) as u8;
        out[pos + 2] = ((encoded >> 16) & 0xFF) as u8;
        out[pos + 3] = ((encoded >> 24) & 0xFF) as u8;
        4
    }
}

/// Fixed-width u128 LE encoding (16 bytes)
fn write_u128_le(value: u128, out: &mut [u8], pos: usize) {
    let bytes = value.to_le_bytes();
    let mut i = 0;
    while i < 16 {
        out[pos + i] = bytes[i];
        i += 1;
    }
}

// ============================================================
//  ABI HELPERS
// ============================================================

fn read_u32(buf: &[u8], offset: usize) -> u32 {
    u32::from_be_bytes([
        buf[offset + 28],
        buf[offset + 29],
        buf[offset + 30],
        buf[offset + 31],
    ])
}

fn read_u128(buf: &[u8], offset: usize) -> u128 {
    u128::from_be_bytes([
        buf[offset + 16], buf[offset + 17], buf[offset + 18], buf[offset + 19],
        buf[offset + 20], buf[offset + 21], buf[offset + 22], buf[offset + 23],
        buf[offset + 24], buf[offset + 25], buf[offset + 26], buf[offset + 27],
        buf[offset + 28], buf[offset + 29], buf[offset + 30], buf[offset + 31],
    ])
}

/// ABI-encode `bytes` return value using a fixed buffer.
/// Layout: offset(32) + length(32) + data(padded to 32)
/// Max data size we handle: 24 bytes → fits in 32-byte pad = 96 bytes total
fn return_bytes(data: &[u8]) {
    let data_len = data.len();
    let padded_len = (data_len + 31) & !31;
    // Total output: 32 (offset) + 32 (length) + padded_len
    // Max: 32 + 32 + 32 = 96
    let mut output = [0u8; 96];

    // Offset: 0x20 (32 in big-endian u256)
    output[31] = 0x20;

    // Length: data_len (big-endian u256)
    output[63] = data_len as u8;
    if data_len > 255 {
        output[62] = (data_len >> 8) as u8;
    }

    // Data bytes
    let mut i = 0;
    while i < data_len {
        output[64 + i] = data[i];
        i += 1;
    }
    // Rest is already zero-padded

    let total = 64 + padded_len;
    api::return_value(ReturnFlags::empty(), &output[..total]);
}
