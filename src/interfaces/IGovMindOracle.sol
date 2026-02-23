// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IGovMindOracle - Interface for AI oracle callbacks
/// @notice Defines the interface between AI backend and on-chain contracts
interface IGovMindOracle {
    struct AnalysisResult {
        uint256 referendumIndex;
        uint8 track;
        uint8 riskScore;          // 0-100
        uint8 categoryId;         // Maps to ProposalCategory enum
        int8 recommendation;      // -1 Nay, 0 Abstain, 1 Aye
        uint256 requestedAmount;  // DOT amount requested (if treasury)
        uint256 treasuryImpact;   // Basis points (e.g., 230 = 2.3%)
        string analysisHash;      // IPFS CID of full analysis
    }

    event AnalysisRequested(uint256 indexed referendumIndex, address indexed requester);
    event AnalysisFulfilled(uint256 indexed referendumIndex, uint8 riskScore, int8 recommendation);
}
