// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title IdentityVault - Governance Identity Storage
/// @notice Stores user governance preferences for AI-assisted voting
/// @dev Each user creates a "Governance Identity" that defines their values,
///      risk tolerance, and per-track delegation settings
contract IdentityVault is Ownable {
    // ============================================================
    //                         ENUMS
    // ============================================================

    /// @notice Preference axes that define a user's governance philosophy
    enum PreferenceAxis {
        TREASURY_CONSERVATIVE,   // 0 - Minimize treasury spend
        TREASURY_GROWTH,         // 1 - Invest for ecosystem growth
        TECHNICAL_PROGRESSIVE,   // 2 - Favor protocol upgrades
        TECHNICAL_CONSERVATIVE,  // 3 - Favor stability
        COMMUNITY_FOCUSED,       // 4 - Prioritize community proposals
        INFRASTRUCTURE_FOCUSED   // 5 - Prioritize infra/tooling
    }

    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice Core governance identity for a user
    struct GovernanceIdentity {
        bool exists;
        uint8 riskTolerance;              // 0-100: how much risk the user accepts
        uint8 minConfidenceThreshold;     // 0-100: min AI confidence to auto-vote
        uint256 maxAutoVoteAmountDOT;     // Max DOT on treasury proposals for auto-vote
        bool autoVoteEnabled;             // Master switch for AI auto-voting
        string preferencesIPFSHash;       // IPFS hash of extended preference data
        uint256 createdAt;
        uint256 updatedAt;
    }

    /// @notice Per-track delegation configuration
    struct TrackDelegation {
        bool enabled;                     // Is AI delegation active for this track?
        uint256 maxAmount;                // Max DOT the AI can vote with on this track
        uint8 maxConviction;              // Max conviction multiplier (0-6)
    }

    // ============================================================
    //                         STATE
    // ============================================================

    /// @notice User address => GovernanceIdentity
    mapping(address => GovernanceIdentity) public identities;

    /// @notice User address => preference axis => weight (0-100)
    mapping(address => mapping(uint8 => uint8)) public preferenceWeights;

    /// @notice User address => track ID => delegation config
    mapping(address => mapping(uint8 => TrackDelegation)) public trackDelegations;

    /// @notice Total number of identities created
    uint256 public totalIdentities;

    /// @notice List of all users who have created identities (for iteration)
    address[] public identityHolders;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event IdentityCreated(address indexed user, uint8 riskTolerance, uint256 timestamp);
    event IdentityUpdated(address indexed user, uint256 timestamp);
    event PreferencesUpdated(address indexed user, uint8[] axes, uint8[] weights);
    event TrackDelegationConfigured(address indexed user, uint8 indexed track, bool enabled);
    event AutoVoteToggled(address indexed user, bool enabled);

    // ============================================================
    //                         ERRORS
    // ============================================================

    error IdentityAlreadyExists();
    error IdentityDoesNotExist();
    error InvalidArrayLength();
    error InvalidWeight();
    error InvalidRiskTolerance();
    error InvalidConviction();
    error InvalidAxis();

    // ============================================================
    //                      CONSTRUCTOR
    // ============================================================

    constructor() Ownable(msg.sender) {}

    // ============================================================
    //                    IDENTITY MANAGEMENT
    // ============================================================

    /// @notice Create a new governance identity
    /// @param _riskTolerance Risk tolerance score (0-100)
    /// @param _minConfidence Minimum AI confidence to auto-vote (0-100)
    /// @param _maxAutoVoteDOT Maximum DOT for auto-vote on treasury proposals
    /// @param _preferencesHash IPFS hash of extended preferences
    /// @param _axes Array of preference axis IDs (0-5)
    /// @param _weights Corresponding weights for each axis (0-100)
    function createIdentity(
        uint8 _riskTolerance,
        uint8 _minConfidence,
        uint256 _maxAutoVoteDOT,
        string calldata _preferencesHash,
        uint8[] calldata _axes,
        uint8[] calldata _weights
    ) external {
        if (identities[msg.sender].exists) revert IdentityAlreadyExists();
        if (_riskTolerance > 100) revert InvalidRiskTolerance();
        if (_minConfidence > 100) revert InvalidRiskTolerance();
        if (_axes.length != _weights.length) revert InvalidArrayLength();

        identities[msg.sender] = GovernanceIdentity({
            exists: true,
            riskTolerance: _riskTolerance,
            minConfidenceThreshold: _minConfidence,
            maxAutoVoteAmountDOT: _maxAutoVoteDOT,
            autoVoteEnabled: false, // Default off, user explicitly enables
            preferencesIPFSHash: _preferencesHash,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _setPreferenceWeights(msg.sender, _axes, _weights);

        identityHolders.push(msg.sender);
        totalIdentities++;

        emit IdentityCreated(msg.sender, _riskTolerance, block.timestamp);
    }

    /// @notice Update preference weights
    /// @param _axes Array of preference axis IDs
    /// @param _weights Corresponding weights (0-100)
    function updatePreferences(
        uint8[] calldata _axes,
        uint8[] calldata _weights
    ) external {
        if (!identities[msg.sender].exists) revert IdentityDoesNotExist();
        if (_axes.length != _weights.length) revert InvalidArrayLength();

        _setPreferenceWeights(msg.sender, _axes, _weights);
        identities[msg.sender].updatedAt = block.timestamp;

        emit PreferencesUpdated(msg.sender, _axes, _weights);
    }

    /// @notice Update risk tolerance and confidence threshold
    /// @param _riskTolerance New risk tolerance (0-100)
    /// @param _minConfidence New minimum confidence (0-100)
    /// @param _maxAutoVoteDOT New max DOT for auto-vote
    function updateSettings(
        uint8 _riskTolerance,
        uint8 _minConfidence,
        uint256 _maxAutoVoteDOT
    ) external {
        if (!identities[msg.sender].exists) revert IdentityDoesNotExist();
        if (_riskTolerance > 100) revert InvalidRiskTolerance();
        if (_minConfidence > 100) revert InvalidRiskTolerance();

        GovernanceIdentity storage identity = identities[msg.sender];
        identity.riskTolerance = _riskTolerance;
        identity.minConfidenceThreshold = _minConfidence;
        identity.maxAutoVoteAmountDOT = _maxAutoVoteDOT;
        identity.updatedAt = block.timestamp;

        emit IdentityUpdated(msg.sender, block.timestamp);
    }

    /// @notice Toggle auto-vote on/off
    /// @param _enabled Whether to enable AI auto-voting
    function toggleAutoVote(bool _enabled) external {
        if (!identities[msg.sender].exists) revert IdentityDoesNotExist();

        identities[msg.sender].autoVoteEnabled = _enabled;
        identities[msg.sender].updatedAt = block.timestamp;

        emit AutoVoteToggled(msg.sender, _enabled);
    }

    // ============================================================
    //                   TRACK DELEGATION
    // ============================================================

    /// @notice Configure AI delegation for a specific governance track
    /// @param _track The OpenGov track ID
    /// @param _enabled Whether AI can vote on this track
    /// @param _maxAmount Maximum DOT the AI can use for votes on this track
    /// @param _maxConviction Maximum conviction multiplier (0-6)
    function configureTrackDelegation(
        uint8 _track,
        bool _enabled,
        uint256 _maxAmount,
        uint8 _maxConviction
    ) external {
        if (!identities[msg.sender].exists) revert IdentityDoesNotExist();
        if (_maxConviction > 6) revert InvalidConviction();

        trackDelegations[msg.sender][_track] = TrackDelegation({
            enabled: _enabled,
            maxAmount: _maxAmount,
            maxConviction: _maxConviction
        });

        identities[msg.sender].updatedAt = block.timestamp;

        emit TrackDelegationConfigured(msg.sender, _track, _enabled);
    }

    /// @notice Batch configure multiple tracks at once
    /// @param _tracks Array of track IDs
    /// @param _enabled Array of enabled flags
    /// @param _maxAmounts Array of max amounts
    /// @param _maxConvictions Array of max convictions
    function batchConfigureTracks(
        uint8[] calldata _tracks,
        bool[] calldata _enabled,
        uint256[] calldata _maxAmounts,
        uint8[] calldata _maxConvictions
    ) external {
        if (!identities[msg.sender].exists) revert IdentityDoesNotExist();
        uint256 len = _tracks.length;
        if (
            len != _enabled.length ||
            len != _maxAmounts.length ||
            len != _maxConvictions.length
        ) revert InvalidArrayLength();

        for (uint256 i = 0; i < len; i++) {
            if (_maxConvictions[i] > 6) revert InvalidConviction();
            trackDelegations[msg.sender][_tracks[i]] = TrackDelegation({
                enabled: _enabled[i],
                maxAmount: _maxAmounts[i],
                maxConviction: _maxConvictions[i]
            });
            emit TrackDelegationConfigured(msg.sender, _tracks[i], _enabled[i]);
        }

        identities[msg.sender].updatedAt = block.timestamp;
    }

    // ============================================================
    //                       VIEW FUNCTIONS
    // ============================================================

    /// @notice Get a user's full preference weights
    /// @param _user Address to query
    /// @return weights Array of 6 weights corresponding to each PreferenceAxis
    function getPreferenceWeights(address _user)
        external
        view
        returns (uint8[6] memory weights)
    {
        for (uint8 i = 0; i < 6; i++) {
            weights[i] = preferenceWeights[_user][i];
        }
    }

    /// @notice Check if a user can auto-vote on a specific track
    /// @param _user Address to check
    /// @param _track Track ID
    /// @param _amount Proposed vote amount
    /// @param _confidence AI confidence score
    /// @return canVote Whether the auto-vote is allowed
    function canAutoVote(
        address _user,
        uint8 _track,
        uint256 _amount,
        uint8 _confidence
    ) external view returns (bool canVote) {
        GovernanceIdentity storage identity = identities[_user];
        if (!identity.exists || !identity.autoVoteEnabled) return false;
        if (_confidence < identity.minConfidenceThreshold) return false;

        TrackDelegation storage delegation = trackDelegations[_user][_track];
        if (!delegation.enabled) return false;
        if (_amount > delegation.maxAmount) return false;

        return true;
    }

    /// @notice Get the number of identity holders (for pagination)
    function getIdentityHolderCount() external view returns (uint256) {
        return identityHolders.length;
    }

    /// @notice Check if a user has an identity
    function hasIdentity(address _user) external view returns (bool) {
        return identities[_user].exists;
    }

    // ============================================================
    //                      INTERNAL
    // ============================================================

    function _setPreferenceWeights(
        address _user,
        uint8[] calldata _axes,
        uint8[] calldata _weights
    ) internal {
        for (uint256 i = 0; i < _axes.length; i++) {
            if (_axes[i] > 5) revert InvalidAxis();
            if (_weights[i] > 100) revert InvalidWeight();
            preferenceWeights[_user][_axes[i]] = _weights[i];
        }
    }
}
