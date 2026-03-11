// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IScaleCodecPVM - Interface for the Rust PVM SCALE codec contract
/// @notice Called cross-VM from EVM Solidity → PVM Rust via pallet-revive.
///         The Rust contract provides native SCALE encoding on RISC-V.
/// @dev Deploy target: PVM (Rust → RISC-V). This interface is used by EVM contracts.
///      pallet-revive routes calls transparently — no bridge, no XCM.
interface IScaleCodecPVM {
    /// @notice SCALE-encode a complete convictionVoting.vote() call
    /// @param pollIndex Relay Chain referendum index
    /// @param aye True for Aye vote
    /// @param conviction Conviction multiplier (0-6)
    /// @param balance DOT amount in plancks
    /// @return encoded The SCALE-encoded pallet call bytes
    function encodeVoteCall(
        uint32 pollIndex,
        bool aye,
        uint8 conviction,
        uint128 balance
    ) external returns (bytes memory encoded);

    /// @notice SCALE compact-encode a uint32
    /// @param value The value to encode
    /// @return encoded The compact-encoded bytes
    function encodeCompactU32(uint32 value) external returns (bytes memory encoded);

    /// @notice Encode a uint128 as 16-byte little-endian
    /// @param value The value to encode
    /// @return encoded The LE-encoded bytes
    function encodeU128LE(uint128 value) external returns (bytes memory encoded);
}
