// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ScaleCodec.sol";
import "./interfaces/IXcm.sol";

/// @title XCMGovernanceRelay - Cross-Chain Vote Execution via XCM
/// @notice Enables GovMind to relay governance votes from Polkadot Hub EVM
///         to the Relay Chain's convictionVoting pallet via XCM Transact.
///         This is the first EVM dApp to execute OpenGov votes cross-chain.
/// @dev Architecture:
///      1. User/AI votes through GovMindCore on Hub EVM
///      2. GovMindCore calls this contract to relay the vote
///      3. This contract SCALE-encodes the convictionVoting.vote() call
///      4. Constructs an XCM message: WithdrawAsset → BuyExecution → Transact
///      5. Sends via the XCM precompile to the Relay Chain
///
///      The vote executes from GovMind's sovereign account on the Relay Chain,
///      acting as a governance delegate for all opt-in users.
contract XCMGovernanceRelay is Ownable {
    using ScaleCodec for uint32;
    using ScaleCodec for uint64;
    using ScaleCodec for uint128;

    // ============================================================
    //                       CONSTANTS
    // ============================================================

    /// @notice XCM precompile on Polkadot Hub at fixed address
    IXcm constant XCM_PRECOMPILE = IXcm(0x00000000000000000000000000000000000A0000);

    /// @notice convictionVoting pallet index on Polkadot Relay Chain
    uint8 constant CONVICTION_VOTING_PALLET_INDEX = 20;

    /// @notice Call index for convictionVoting.vote()
    uint8 constant VOTE_CALL_INDEX = 0;

    // --- XCM Instruction Discriminants (XCM V4) ---
    uint8 constant XCM_WITHDRAW_ASSET = 0;
    uint8 constant XCM_TRANSACT = 6;
    uint8 constant XCM_DEPOSIT_ASSET = 13;
    uint8 constant XCM_BUY_EXECUTION = 19;
    uint8 constant XCM_REFUND_SURPLUS = 20;

    // --- XCM OriginKind enum ---
    uint8 constant ORIGIN_SOVEREIGN_ACCOUNT = 1;

    // --- XCM Version prefix ---
    uint8 constant XCM_V4 = 4;

    // --- Default execution weight for convictionVoting.vote() ---
    /// @dev Conservative estimates; can be adjusted via admin
    uint64 public transactRefTime = 500_000_000;    // 500ms
    uint64 public transactProofSize = 20_000;        // 20KB

    /// @notice Fee amount in plancks to pay for XCM execution on relay chain
    /// @dev 1 DOT = 10^10 plancks. Default 0.1 DOT for safety margin.
    uint128 public xcmFeeAmount = 1_000_000_000; // 0.1 DOT

    // ============================================================
    //                         STATE
    // ============================================================

    /// @notice Whether XCM relay is active (can be disabled if routing issues)
    bool public relayEnabled;

    /// @notice Authorized callers (GovMindCore contract)
    mapping(address => bool) public authorizedCallers;

    /// @notice Track relayed votes for transparency
    uint256 public totalRelayedVotes;

    /// @notice Referendum => relay status
    mapping(uint256 => RelayedVote[]) public relayedVotes;

    struct RelayedVote {
        address voter;
        uint32 referendumIndex;
        bool aye;
        uint8 conviction;
        uint128 amount;
        uint256 timestamp;
    }

    // ============================================================
    //                         EVENTS
    // ============================================================

    event VoteRelayed(
        address indexed voter,
        uint32 indexed referendumIndex,
        bool aye,
        uint8 conviction,
        uint128 amount,
        bytes xcmMessage
    );

    event RelayToggled(bool enabled);
    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);
    event WeightUpdated(uint64 refTime, uint64 proofSize);
    event FeeUpdated(uint128 amount);

    // ============================================================
    //                         ERRORS
    // ============================================================

    error RelayDisabled();
    error NotAuthorized();
    error InvalidConviction();
    error ZeroAmount();

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor() Ownable(msg.sender) {
        relayEnabled = true;
    }

    // ============================================================
    //                    CORE: XCM VOTE RELAY
    // ============================================================

    /// @notice Relay a governance vote to the Relay Chain via XCM
    /// @param _voter Address of the voter (for tracking)
    /// @param _referendumIndex Relay Chain referendum index
    /// @param _aye True for Aye, false for Nay
    /// @param _conviction Conviction multiplier (0-6)
    /// @param _amount DOT amount in plancks (10^10 per DOT)
    function relayVote(
        address _voter,
        uint32 _referendumIndex,
        bool _aye,
        uint8 _conviction,
        uint128 _amount
    ) external {
        if (!relayEnabled) revert RelayDisabled();
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        if (_conviction > 6) revert InvalidConviction();
        if (_amount == 0) revert ZeroAmount();

        // 1. SCALE-encode the convictionVoting.vote() call
        bytes memory encodedCall = _encodeConvictionVote(
            _referendumIndex,
            _aye,
            _conviction,
            _amount
        );

        // 2. Build the full XCM message
        bytes memory xcmMessage = _buildXcmMessage(encodedCall);

        // 3. Encode relay chain destination
        bytes memory destination = _encodeRelayChainDestination();

        // 4. Send via XCM precompile
        XCM_PRECOMPILE.send(destination, xcmMessage);

        // 5. Record the relay
        relayedVotes[_referendumIndex].push(RelayedVote({
            voter: _voter,
            referendumIndex: _referendumIndex,
            aye: _aye,
            conviction: _conviction,
            amount: _amount,
            timestamp: block.timestamp
        }));
        totalRelayedVotes++;

        emit VoteRelayed(
            _voter,
            _referendumIndex,
            _aye,
            _conviction,
            _amount,
            xcmMessage
        );
    }

    // ============================================================
    //                 SCALE ENCODING: PALLET CALL
    // ============================================================

    /// @notice SCALE-encode convictionVoting.vote() call for Relay Chain
    /// @dev Encoding format:
    ///      [pallet_index: u8] [call_index: u8] [poll_index: Compact<u32>]
    ///      [AccountVote::Standard { vote: Vote, balance: u128 }]
    ///
    ///      Vote byte: bit 7 = aye flag, bits 0-6 = conviction (0-6)
    ///      AccountVote::Standard variant index = 0x00
    function _encodeConvictionVote(
        uint32 _referendumIndex,
        bool _aye,
        uint8 _conviction,
        uint128 _amount
    ) internal pure returns (bytes memory) {
        // Vote byte: conviction | (aye ? 0x80 : 0x00)
        uint8 voteByte = _conviction | (_aye ? 0x80 : 0x00);

        // poll_index as SCALE compact u32
        bytes memory compactPollIndex = ScaleCodec.encodeCompactU32(_referendumIndex);

        // Balance as fixed-width u128 LE (NOT compact in AccountVote::Standard)
        bytes memory balanceLE = ScaleCodec.encodeU128LE(_amount);

        return abi.encodePacked(
            CONVICTION_VOTING_PALLET_INDEX,  // pallet index: 20 (0x14)
            VOTE_CALL_INDEX,                  // call index: 0 (0x00)
            compactPollIndex,                 // poll_index: Compact<u32>
            uint8(0x00),                      // AccountVote::Standard variant
            voteByte,                         // Vote { aye, conviction }
            balanceLE                         // balance: u128
        );
    }

    // ============================================================
    //                 XCM MESSAGE CONSTRUCTION
    // ============================================================

    /// @notice Build a complete XCM V4 message for vote relay
    /// @dev Message structure:
    ///      VersionedXcm::V4([
    ///        WithdrawAsset([ DOT(xcmFeeAmount) ]),
    ///        BuyExecution { fees: DOT(xcmFeeAmount), weight_limit: Unlimited },
    ///        Transact { origin_kind: SovereignAccount, weight, call },
    ///        RefundSurplus,
    ///        DepositAsset { assets: Wild(All), beneficiary: Here }
    ///      ])
    function _buildXcmMessage(bytes memory encodedCall) internal view returns (bytes memory) {
        // --- Instruction 1: WithdrawAsset ---
        // Withdraw DOT to pay for execution on relay chain
        bytes memory withdrawAsset = _encodeWithdrawAsset(xcmFeeAmount);

        // --- Instruction 2: BuyExecution ---
        // Pay for XCM execution with withdrawn DOT
        bytes memory buyExecution = _encodeBuyExecution(xcmFeeAmount);

        // --- Instruction 3: Transact ---
        // Execute convictionVoting.vote() on relay chain
        bytes memory transact = _encodeTransact(encodedCall);

        // --- Instruction 4: RefundSurplus ---
        // Refund any leftover fees
        bytes memory refundSurplus = abi.encodePacked(XCM_REFUND_SURPLUS);

        // --- Instruction 5: DepositAsset ---
        // Return leftover DOT to origin (Hub sovereign account on relay)
        bytes memory depositAsset = _encodeDepositAsset();

        // Combine into VersionedXcm::V4(Vec<Instruction>)
        // V4 prefix = 0x04
        // Vec length = 5 instructions → compact(5) = 0x14
        return abi.encodePacked(
            XCM_V4,                  // Version prefix
            ScaleCodec.encodeCompactU32(5), // Vec length (5 instructions)
            withdrawAsset,
            buyExecution,
            transact,
            refundSurplus,
            depositAsset
        );
    }

    /// @notice Encode WithdrawAsset instruction
    /// @dev WithdrawAsset(Vec<Asset>)
    ///      Asset = { id: AssetId(Location), fun: Fungibility::Fungible(amount) }
    ///      Native DOT on relay = Location { parents: 0, interior: Here }
    function _encodeWithdrawAsset(uint128 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            XCM_WITHDRAW_ASSET,                  // Instruction discriminant (0)
            ScaleCodec.encodeCompactU32(1),       // Vec<Asset> length = 1
            _encodeNativeDotAsset(amount)         // The DOT asset
        );
    }

    /// @notice Encode BuyExecution instruction
    /// @dev BuyExecution { fees: Asset, weight_limit: WeightLimit }
    ///      WeightLimit::Unlimited = 0x00
    function _encodeBuyExecution(uint128 feeAmount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            XCM_BUY_EXECUTION,                    // Instruction discriminant (19)
            _encodeNativeDotAsset(feeAmount),      // fees: Asset
            uint8(0x00)                            // WeightLimit::Unlimited
        );
    }

    /// @notice Encode Transact instruction
    /// @dev Transact { origin_kind, require_weight_at_most, call }
    ///      origin_kind: OriginKind::SovereignAccount (1)
    ///      require_weight_at_most: Weight { ref_time, proof_size }
    ///      call: DoubleEncoded (SCALE Vec<u8> of the encoded pallet call)
    function _encodeTransact(bytes memory call) internal view returns (bytes memory) {
        return abi.encodePacked(
            XCM_TRANSACT,                                    // Instruction discriminant (6)
            ORIGIN_SOVEREIGN_ACCOUNT,                        // OriginKind (1)
            ScaleCodec.encodeCompactU64(transactRefTime),    // Weight.refTime
            ScaleCodec.encodeCompactU64(transactProofSize),  // Weight.proofSize
            ScaleCodec.encodeVecU8(call)                     // Encoded call as Vec<u8>
        );
    }

    /// @notice Encode DepositAsset instruction
    /// @dev DepositAsset { assets: AssetFilter::Wild(WildAsset::All), beneficiary }
    ///      beneficiary = Location { parents: 0, interior: Here } (self on relay)
    function _encodeDepositAsset() internal pure returns (bytes memory) {
        return abi.encodePacked(
            XCM_DEPOSIT_ASSET,  // Instruction discriminant (13)
            uint8(0x01),        // AssetFilter::Wild variant
            uint8(0x00),        // WildAsset::All
            uint8(0x00),        // Beneficiary parents: 0
            uint8(0x00)         // Beneficiary interior: Here
        );
    }

    // ============================================================
    //                    ASSET ENCODING
    // ============================================================

    /// @notice Encode a native DOT asset on the Relay Chain
    /// @dev Asset { id: AssetId(Location { parents: 0, interior: Here }),
    ///              fun: Fungibility::Fungible(amount) }
    function _encodeNativeDotAsset(uint128 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(0x00),                             // AssetId: Location.parents = 0
            uint8(0x00),                             // AssetId: Location.interior = Here
            uint8(0x00),                             // Fungibility::Fungible variant
            ScaleCodec.encodeCompactU128(amount)     // Amount (compact)
        );
    }

    // ============================================================
    //                  DESTINATION ENCODING
    // ============================================================

    /// @notice Encode the Relay Chain destination
    /// @dev From a system parachain (Hub), relay chain is:
    ///      VersionedLocation::V4(Location { parents: 1, interior: Here })
    ///      SCALE: version(4) + parents(1) + interior(Here=0)
    function _encodeRelayChainDestination() internal pure returns (bytes memory) {
        return abi.encodePacked(
            XCM_V4,       // VersionedLocation::V4 prefix
            uint8(0x01),  // parents: 1 (go up to relay chain)
            uint8(0x00)   // interior: Here (no further junctions)
        );
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    /// @notice Preview the SCALE-encoded call that would be sent via XCM
    /// @dev Useful for verifying encoding correctness off-chain
    function previewEncodedCall(
        uint32 _referendumIndex,
        bool _aye,
        uint8 _conviction,
        uint128 _amount
    ) external pure returns (bytes memory encodedCall) {
        return _encodeConvictionVote(_referendumIndex, _aye, _conviction, _amount);
    }

    /// @notice Preview the full XCM message that would be sent
    function previewXcmMessage(
        uint32 _referendumIndex,
        bool _aye,
        uint8 _conviction,
        uint128 _amount
    ) external view returns (bytes memory xcmMessage) {
        bytes memory encodedCall = _encodeConvictionVote(
            _referendumIndex, _aye, _conviction, _amount
        );
        return _buildXcmMessage(encodedCall);
    }

    /// @notice Preview the relay chain destination encoding
    function previewDestination() external pure returns (bytes memory) {
        return _encodeRelayChainDestination();
    }

    /// @notice Get relayed votes for a referendum
    function getRelayedVotes(uint256 _referendumIndex)
        external
        view
        returns (RelayedVote[] memory)
    {
        return relayedVotes[_referendumIndex];
    }

    // ============================================================
    //                         ADMIN
    // ============================================================

    /// @notice Enable/disable XCM relay
    function setRelayEnabled(bool _enabled) external onlyOwner {
        relayEnabled = _enabled;
        emit RelayToggled(_enabled);
    }

    /// @notice Authorize a caller (e.g., GovMindCore)
    function authorizeCaller(address _caller) external onlyOwner {
        authorizedCallers[_caller] = true;
        emit CallerAuthorized(_caller);
    }

    /// @notice Revoke caller authorization
    function revokeCaller(address _caller) external onlyOwner {
        authorizedCallers[_caller] = false;
        emit CallerRevoked(_caller);
    }

    /// @notice Update Transact weight limits
    function updateWeight(uint64 _refTime, uint64 _proofSize) external onlyOwner {
        transactRefTime = _refTime;
        transactProofSize = _proofSize;
        emit WeightUpdated(_refTime, _proofSize);
    }

    /// @notice Update XCM execution fee amount
    function updateFee(uint128 _amount) external onlyOwner {
        xcmFeeAmount = _amount;
        emit FeeUpdated(_amount);
    }
}
