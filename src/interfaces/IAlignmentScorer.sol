// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAlignmentScorer - Interface for the Rust PVM alignment scoring contract
/// @notice Called cross-VM from EVM Solidity → PVM Rust via pallet-revive.
///         The Rust contract computes governance personalization on RISC-V.
/// @dev Deploy target: PVM (Rust → RISC-V). This interface is used by EVM contracts.
///      Replicates _computeAlignmentScore + getPersonalizedInsight logic.
interface IAlignmentScorer {
    /// @notice Compute personalized alignment score and recommendation
    /// @param w0 Weight: Treasury Conservative (0-100)
    /// @param w1 Weight: Treasury Growth (0-100)
    /// @param w2 Weight: Technical Progressive (0-100)
    /// @param w3 Weight: Technical Conservative (0-100)
    /// @param w4 Weight: Community Focused (0-100)
    /// @param w5 Weight: Infrastructure Focused (0-100)
    /// @param riskTolerance User's risk tolerance (0-100)
    /// @param categoryId Proposal category (0-9)
    /// @param riskScore AI-assessed risk score (0-100)
    /// @param recommendation Base AI recommendation (-1, 0, 1)
    /// @param confidence Base AI confidence (0-100)
    /// @return alignmentScore Personalized alignment (0-100)
    /// @return personalizedRecommendation Adjusted recommendation (-1, 0, 1)
    /// @return adjustedConfidence Adjusted confidence (0-100)
    function computeAlignment(
        uint8 w0,
        uint8 w1,
        uint8 w2,
        uint8 w3,
        uint8 w4,
        uint8 w5,
        uint8 riskTolerance,
        uint8 categoryId,
        uint8 riskScore,
        int8 recommendation,
        uint8 confidence
    ) external returns (
        uint8 alignmentScore,
        int8 personalizedRecommendation,
        uint8 adjustedConfidence
    );
}
