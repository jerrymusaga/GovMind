// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ICollectiveAggregator - Interface for the Rust PVM collective profile aggregation contract
/// @notice Called cross-VM from EVM CollectiveRegistry → PVM CollectiveAggregator via pallet-revive.
///         The Rust contract computes dynamic collective profiles as the weighted blend of
///         the founder's seed profile and the average of all members' on-chain governance identities.
/// @dev Deploy target: PVM (Rust → RISC-V). This interface is used by EVM contracts.
interface ICollectiveAggregator {
    /// @notice Recalculate collective profile after a new member joins
    /// @param seed The founder's original 6-axis seed profile
    /// @param currentAxes The collective's current blended axes
    /// @param newMemberAxes The joining member's 6-axis identity from IdentityVault
    /// @param memberCount Number of members BEFORE this join
    /// @param seedWeight Weight of the seed profile (0-100), e.g. 30 = 30% seed, 70% members
    /// @return updatedAxes The new blended 6-axis profile
    function recalculateOnJoin(
        uint8[6] calldata seed,
        uint8[6] calldata currentAxes,
        uint8[6] calldata newMemberAxes,
        uint32 memberCount,
        uint8 seedWeight
    ) external returns (uint8[6] memory updatedAxes);

    /// @notice Recalculate collective profile after a member leaves
    /// @param seed The founder's original 6-axis seed profile
    /// @param currentAxes The collective's current blended axes
    /// @param leavingMemberAxes The leaving member's 6-axis identity
    /// @param memberCount Number of members BEFORE this leave
    /// @param seedWeight Weight of the seed profile (0-100)
    /// @return updatedAxes The new blended 6-axis profile
    function recalculateOnLeave(
        uint8[6] calldata seed,
        uint8[6] calldata currentAxes,
        uint8[6] calldata leavingMemberAxes,
        uint32 memberCount,
        uint8 seedWeight
    ) external returns (uint8[6] memory updatedAxes);
}
