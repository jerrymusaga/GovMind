// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IXcm - Polkadot Hub XCM Precompile Interface
/// @notice Located at 0x00000000000000000000000000000000000a0000
/// @dev Enables cross-chain interactions from Solidity contracts.
///      The precompile uses Weight as a struct parameter, not flat u64 args.
///      Reference: https://docs.polkadot.com/smart-contracts/precompiles/xcm/
interface IXcm {
    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }

    /// @notice Execute an XCM message locally using the caller's origin
    /// @param message The encoded XCM message bytes
    /// @param weight Weight limit for execution
    function execute(
        bytes calldata message,
        Weight calldata weight
    ) external;

    /// @notice Send an XCM message to a destination
    /// @param dest The encoded destination (VersionedLocation)
    /// @param message The encoded XCM message bytes
    function send(
        bytes calldata dest,
        bytes calldata message
    ) external;

    /// @notice Estimate the computational cost of an XCM message
    /// @param message The encoded XCM message bytes
    /// @return weight The estimated weight
    function weighMessage(
        bytes calldata message
    ) external view returns (Weight memory weight);
}
