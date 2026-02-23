// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IXcm - Polkadot Hub XCM Precompile Interface
/// @notice Located at 0x00000000000000000000000000000000000a0000
/// @dev Enables cross-chain interactions from Solidity contracts
interface IXcm {
    /// @notice Execute an XCM message locally using the caller's origin
    /// @param message The encoded XCM message bytes
    /// @param refTime Reference time weight from weighMessage
    /// @param proofSize Proof size weight from weighMessage
    function execute(
        bytes calldata message,
        uint64 refTime,
        uint64 proofSize
    ) external;

    /// @notice Send an XCM message to a destination
    /// @param dest The encoded destination (MultiLocation)
    /// @param message The encoded XCM message bytes
    function send(
        bytes calldata dest,
        bytes calldata message
    ) external;

    /// @notice Estimate the computational cost of an XCM message
    /// @param message The encoded XCM message bytes
    /// @return refTime The reference time weight
    /// @return proofSize The proof size weight
    function weighMessage(
        bytes calldata message
    ) external view returns (uint64 refTime, uint64 proofSize);
}
