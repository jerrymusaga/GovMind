//! Alignment Scorer PVM Contract — Governance personalization on RISC-V
//!
//! Computes personalized governance alignment scores. Called from
//! GovMindCore.sol (EVM) via pallet-revive cross-VM dispatch.
//!
//! This replicates the _computeAlignmentScore and getPersonalizedInsight
//! logic from GovMindCore.sol, but runs as a tight RISC-V computation
//! on PVM instead of EVM. EVM handles state, PVM handles computation.
//!
//! Exposed function (Ethereum ABI):
//!   computeAlignment(
//!     uint8[6] weights,     // 6-axis preference weights (0-100 each)
//!     uint8 riskTolerance,  // user's risk tolerance (0-100)
//!     uint8 categoryId,     // proposal category (0-9)
//!     uint8 riskScore,      // AI-assessed risk (0-100)
//!     int8 recommendation,  // base AI recommendation (-1, 0, 1)
//!     uint8 confidence      // base AI confidence (0-100)
//!   ) returns (
//!     uint8 alignmentScore,           // 0-100
//!     int8 personalizedRecommendation, // -1, 0, 1
//!     uint8 adjustedConfidence         // 0-100
//!   )
//!
//! Selector: keccak256("computeAlignment(uint8[6],uint8,uint8,uint8,int8,uint8)")[0:4]
//!         = 0xa1b2c3d4 (placeholder — computed at integration time)

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
//                    ENTRY POINTS
// ============================================================

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // ABI layout: 4-byte selector + 6 x 32-byte args = 196 bytes
    // But uint8[6] is packed as 6 x 32-byte slots in ABI encoding
    // Total: 4 + (6 + 5) * 32 = 4 + 352 = 356 bytes
    // Actually: uint8[6] = 6 separate 32-byte slots starting at offset
    // with dynamic offset pointer.
    //
    // Simpler approach: use fixed-size tuple encoding
    // computeAlignment(uint8,uint8,uint8,uint8,uint8,uint8,uint8,uint8,int8,uint8)
    // = 10 args x 32 bytes + 4 selector = 324 bytes
    //
    // We use the flat version for simpler ABI:
    // computeAlignment(uint8 w0, uint8 w1, uint8 w2, uint8 w3, uint8 w4, uint8 w5,
    //                  uint8 riskTolerance, uint8 categoryId, uint8 riskScore,
    //                  int8 recommendation, uint8 confidence)
    // = 4 + 11 * 32 = 356 bytes
    input!(buf: &[u8; 356],);

    // Read 6 preference weights (each right-aligned in 32-byte slot)
    let w0 = buf[4 + 31];   // TREASURY_CONSERVATIVE
    let w1 = buf[36 + 31];  // TREASURY_GROWTH
    let w2 = buf[68 + 31];  // TECHNICAL_PROGRESSIVE
    let w3 = buf[100 + 31]; // TECHNICAL_CONSERVATIVE
    let w4 = buf[132 + 31]; // COMMUNITY_FOCUSED
    let w5 = buf[164 + 31]; // INFRASTRUCTURE_FOCUSED
    let weights: [u8; 6] = [w0, w1, w2, w3, w4, w5];

    let risk_tolerance = buf[196 + 31];
    let category_id = buf[228 + 31];
    let risk_score = buf[260 + 31];
    // int8 recommendation is in the last byte, but signed
    let recommendation = buf[292 + 31] as i8;
    let confidence = buf[324 + 31];

    // Compute alignment
    let alignment = compute_alignment_score(&weights, risk_tolerance, category_id, risk_score);

    // Compute personalized recommendation + adjusted confidence
    let (pers_rec, pers_conf) = personalize(alignment, recommendation, confidence);

    // Return: (uint8 alignmentScore, int8 personalizedRecommendation, uint8 adjustedConfidence)
    // ABI encode as 3 x 32-byte values
    let mut output = [0u8; 96];

    // alignmentScore (uint8, right-aligned)
    output[31] = alignment;

    // personalizedRecommendation (int8, right-aligned, sign-extended)
    if pers_rec < 0 {
        // Sign extend: fill with 0xFF for negative
        for b in output[32..63].iter_mut() {
            *b = 0xFF;
        }
        output[63] = pers_rec as u8;
    } else {
        output[63] = pers_rec as u8;
    }

    // adjustedConfidence (uint8, right-aligned)
    output[95] = pers_conf;

    api::return_value(ReturnFlags::empty(), &output);
}

// ============================================================
//                    CORE LOGIC
// ============================================================

/// Compute alignment score between user preferences and proposal category
/// Returns 0-100 where 100 = fully aligned, 0 = fully opposed, 50 = neutral
///
/// Mirrors _computeAlignmentScore from GovMindCore.sol
fn compute_alignment_score(
    weights: &[u8; 6],
    risk_tolerance: u8,
    category_id: u8,
    risk_score: u8,
) -> u8 {
    // Map category to supporting/opposing axes
    let (support_axis, oppose_axis, has_mapping) = get_category_axes(category_id);

    if !has_mapping {
        return 50; // No mapping → neutral
    }

    let support_weight = weights[support_axis as usize] as i16;
    let oppose_weight = weights[oppose_axis as usize] as i16;

    // alignment = 50 + (support - oppose) / 2
    let mut raw: i16 = 50 + (support_weight - oppose_weight) / 2;

    // Apply risk penalty: if proposal risk exceeds user's tolerance, reduce alignment
    if risk_score > risk_tolerance {
        raw -= (risk_score - risk_tolerance) as i16 / 2;
    }

    // Clamp to [0, 100]
    if raw < 0 {
        0
    } else if raw > 100 {
        100
    } else {
        raw as u8
    }
}

/// Map proposal category to supporting/opposing preference axes
/// Mirrors _getCategoryAxes from GovMindCore.sol
fn get_category_axes(category_id: u8) -> (u8, u8, bool) {
    match category_id {
        // TREASURY_SPEND(0), TREASURY_TIP(1), BOUNTY(8)
        0 | 1 | 8 => (1, 0, true), // TREASURY_GROWTH supports, TREASURY_CONSERVATIVE opposes
        // TECHNICAL_UPGRADE(2)
        2 => (2, 3, true), // TECHNICAL_PROGRESSIVE supports, TECHNICAL_CONSERVATIVE opposes
        // GOVERNANCE_CHANGE(3), COMMUNITY_INITIATIVE(6)
        3 | 6 => (4, 5, true), // COMMUNITY_FOCUSED supports, INFRASTRUCTURE_FOCUSED opposes
        // STAKING_OPERATION(4), BRIDGE_OPERATION(5), INFRASTRUCTURE(7)
        4 | 5 | 7 => (5, 4, true), // INFRASTRUCTURE_FOCUSED supports, COMMUNITY_FOCUSED opposes
        // OTHER(9) or unknown
        _ => (0, 0, false),
    }
}

/// Compute personalized recommendation and adjusted confidence
/// Mirrors the getPersonalizedInsight logic from GovMindCore.sol
fn personalize(alignment: u8, base_rec: i8, base_confidence: u8) -> (i8, u8) {
    let conf = base_confidence as u16;
    let align = alignment as u16;

    if alignment >= 60 {
        if base_rec >= 0 {
            // User likes category + AI says Aye/Abstain → Aye
            let adjusted = min_u16(100, conf + (align - 50) / 2);
            (1, adjusted as u8)
        } else {
            // User likes category but AI says Nay → Abstain (conflicting)
            let adjusted = min_u16(100, conf / 2 + align / 2);
            (0, adjusted as u8)
        }
    } else if alignment <= 40 {
        if base_rec <= 0 {
            // User dislikes category + AI says Nay/Abstain → Nay
            let adjusted = min_u16(100, conf + (50 - align) / 2);
            (-1, adjusted as u8)
        } else {
            // User dislikes category but AI says Aye → Nay (user values override)
            let adjusted = min_u16(100, conf / 2 + (50 - align) / 2);
            (-1, adjusted as u8)
        }
    } else {
        // Neutral zone (41-59) → keep base recommendation
        (base_rec, base_confidence)
    }
}

fn min_u16(a: u16, b: u16) -> u16 {
    if a < b { a } else { b }
}
