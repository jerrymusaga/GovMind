//! Alignment Scorer PVM Contract — Governance personalization on RISC-V
//!
//! Computes personalized governance alignment scores. Called from
//! GovMindCore.sol (EVM) via pallet-revive cross-VM dispatch.
//!
//! EVM handles state and orchestration. PVM handles computation.
//!
//! computeAlignment(uint8,uint8,uint8,uint8,uint8,uint8,uint8,uint8,uint8,int8,uint8)
//!   → (uint8 alignmentScore, int8 personalizedRec, uint8 adjustedConfidence)

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
    // 4 selector + 11 args x 32 bytes = 356 bytes
    input!(buf: &[u8; 356],);

    // Read 6 preference weights (each right-aligned in 32-byte slot)
    let weights: [u8; 6] = [
        buf[4 + 31],   // w0: TREASURY_CONSERVATIVE
        buf[36 + 31],  // w1: TREASURY_GROWTH
        buf[68 + 31],  // w2: TECHNICAL_PROGRESSIVE
        buf[100 + 31], // w3: TECHNICAL_CONSERVATIVE
        buf[132 + 31], // w4: COMMUNITY_FOCUSED
        buf[164 + 31], // w5: INFRASTRUCTURE_FOCUSED
    ];

    let risk_tolerance = buf[196 + 31];
    let category_id = buf[228 + 31];
    let risk_score = buf[260 + 31];
    let recommendation = buf[292 + 31] as i8;
    let confidence = buf[324 + 31];

    // Compute alignment score
    let alignment = compute_alignment_score(&weights, risk_tolerance, category_id, risk_score);

    // Compute personalized recommendation + adjusted confidence
    let (pers_rec, pers_conf) = personalize(alignment, recommendation, confidence);

    // Return: (uint8, int8, uint8) = 3 x 32-byte ABI slots = 96 bytes
    let mut output = [0u8; 96];

    // alignmentScore (uint8, right-aligned in slot 0)
    output[31] = alignment;

    // personalizedRecommendation (int8, right-aligned in slot 1, sign-extended)
    if pers_rec < 0 {
        // Sign extend: 0xFF fill for negative int8 in int256 slot
        let mut i = 32;
        while i < 63 {
            output[i] = 0xFF;
            i += 1;
        }
        output[63] = pers_rec as u8;
    } else {
        output[63] = pers_rec as u8;
    }

    // adjustedConfidence (uint8, right-aligned in slot 2)
    output[95] = pers_conf;

    api::return_value(ReturnFlags::empty(), &output);
}

// ============================================================
//  CORE: Alignment Score Computation
// ============================================================

/// Mirrors _computeAlignmentScore from GovMindCore.sol
fn compute_alignment_score(
    weights: &[u8; 6],
    risk_tolerance: u8,
    category_id: u8,
    risk_score: u8,
) -> u8 {
    let (support_axis, oppose_axis, has_mapping) = get_category_axes(category_id);

    if !has_mapping {
        return 50;
    }

    let support_weight = weights[support_axis as usize] as i16;
    let oppose_weight = weights[oppose_axis as usize] as i16;

    // alignment = 50 + (support - oppose) / 2
    let mut raw: i16 = 50 + (support_weight - oppose_weight) / 2;

    // Risk penalty
    if risk_score > risk_tolerance {
        raw -= (risk_score - risk_tolerance) as i16 / 2;
    }

    // Clamp [0, 100]
    if raw < 0 {
        0
    } else if raw > 100 {
        100
    } else {
        raw as u8
    }
}

/// Mirrors _getCategoryAxes from GovMindCore.sol
fn get_category_axes(category_id: u8) -> (u8, u8, bool) {
    match category_id {
        0 | 1 | 8 => (1, 0, true), // Treasury: Growth supports, Conservative opposes
        2 => (2, 3, true),          // Technical: Progressive supports, Conservative opposes
        3 | 6 => (4, 5, true),      // Community supports, Infrastructure opposes
        4 | 5 | 7 => (5, 4, true),  // Infrastructure supports, Community opposes
        _ => (0, 0, false),          // OTHER → neutral
    }
}

// ============================================================
//  CORE: Personalization Logic
// ============================================================

/// Mirrors getPersonalizedInsight logic from GovMindCore.sol
fn personalize(alignment: u8, base_rec: i8, base_confidence: u8) -> (i8, u8) {
    let conf = base_confidence as u16;
    let align = alignment as u16;

    if alignment >= 60 {
        if base_rec >= 0 {
            // User likes + AI says Aye/Abstain → Aye
            let adjusted = min_u16(100, conf + (align - 50) / 2);
            (1, adjusted as u8)
        } else {
            // User likes but AI says Nay → Abstain (conflict)
            let adjusted = min_u16(100, conf / 2 + align / 2);
            (0, adjusted as u8)
        }
    } else if alignment <= 40 {
        if base_rec <= 0 {
            // User dislikes + AI says Nay/Abstain → Nay
            let adjusted = min_u16(100, conf + (50 - align) / 2);
            (-1, adjusted as u8)
        } else {
            // User dislikes but AI says Aye → Nay (user overrides)
            let adjusted = min_u16(100, conf / 2 + (50 - align) / 2);
            (-1, adjusted as u8)
        }
    } else {
        // Neutral zone (41-59) → keep base
        (base_rec, base_confidence)
    }
}

fn min_u16(a: u16, b: u16) -> u16 {
    if a < b { a } else { b }
}
