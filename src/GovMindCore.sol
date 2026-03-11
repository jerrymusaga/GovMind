// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IdentityVault.sol";
import "./AIOracle.sol";
import "./XCMGovernanceRelay.sol";
import "./interfaces/IAlignmentScorer.sol";

/// @title GovMindCore - AI Governance Intelligence Layer
/// @notice Main orchestrator that coordinates AI analysis, user identities,
///         and vote execution on Polkadot OpenGov via Hub's EVM
/// @dev Interacts with governance precompiles for actual vote execution.
///      If governance precompile is not yet available on testnet,
///      vote state is tracked internally for demo purposes.
contract GovMindCore is Ownable, ReentrancyGuard {
    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice Record of a vote cast through GovMind
    struct VoteRecord {
        address voter;
        uint256 referendumIndex;
        bool aye;
        uint256 conviction;        // 0-6 conviction multiplier
        uint256 amount;            // DOT committed
        bool isAIVote;             // true if AI auto-voted
        uint8 aiConfidence;        // AI confidence when vote was cast
        string reasoningHash;      // IPFS hash of AI reasoning for this specific user
        uint256 timestamp;
    }

    /// @notice Referendum tracking (aggregates GovMind votes)
    struct ReferendumTracker {
        uint256 referendumIndex;
        uint256 totalAye;          // Total DOT voted aye through GovMind
        uint256 totalNay;          // Total DOT voted nay through GovMind
        uint256 voterCount;
        uint256 aiVoterCount;      // How many votes were AI-generated
        bool isActive;
    }

    // ============================================================
    //                         STATE
    // ============================================================

    /// @notice Reference to IdentityVault contract
    IdentityVault public identityVault;

    /// @notice Reference to AIOracle contract
    AIOracle public aiOracle;

    /// @notice XCM Governance Relay contract for cross-chain voting
    XCMGovernanceRelay public xcmRelay;

    /// @notice Whether to relay votes to Relay Chain via XCM
    bool public xcmRelayEnabled;

    /// @notice PVM Alignment Scorer contract (Rust on RISC-V, called cross-VM)
    IAlignmentScorer public alignmentScorerPVM;

    /// @notice Whether to use PVM (Rust) for alignment scoring instead of Solidity
    bool public usePVMScorer;

    /// @notice User => referendum => VoteRecord
    mapping(address => mapping(uint256 => VoteRecord)) public voteRecords;

    /// @notice User => referendum => has voted
    mapping(address => mapping(uint256 => bool)) public hasVoted;

    /// @notice Referendum index => tracker
    mapping(uint256 => ReferendumTracker) public referendumTrackers;

    /// @notice User => array of referendum indices they voted on
    mapping(address => uint256[]) public userVoteHistory;

    /// @notice Total votes cast through GovMind
    uint256 public totalVotesCast;

    /// @notice Total AI-assisted votes
    uint256 public totalAIVotes;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event VoteCast(
        address indexed voter,
        uint256 indexed referendumIndex,
        bool aye,
        uint256 conviction,
        bool isAIVote,
        uint8 aiConfidence
    );

    event AIVoteExecuted(
        address indexed user,
        uint256 indexed referendumIndex,
        bool aye,
        uint8 confidence,
        string reasoningHash
    );

    event XCMRelayUpdated(address indexed relay);
    event XCMRelayToggled(bool enabled);
    event PVMScorerUpdated(address indexed scorer, bool enabled);
    event VoteRelayedViaXCM(
        address indexed voter,
        uint256 indexed referendumIndex,
        bool aye,
        uint256 conviction
    );

    // ============================================================
    //                         ERRORS
    // ============================================================

    error AlreadyVoted();
    error NoIdentity();
    error NoAnalysis();
    error AutoVoteNotEnabled();
    error TrackNotDelegated();
    error ConfidenceBelowThreshold();
    error AmountExceedsLimit();
    error InvalidConviction();
    error NotAuthorizedOracle();
    error ZeroAmount();

    // ============================================================
    //                       MODIFIERS
    // ============================================================

    modifier onlyOracle() {
        if (!aiOracle.authorizedOracles(msg.sender)) revert NotAuthorizedOracle();
        _;
    }

    // ============================================================
    //                      CONSTRUCTOR
    // ============================================================

    /// @param _identityVault Address of deployed IdentityVault
    /// @param _aiOracle Address of deployed AIOracle
    constructor(
        address _identityVault,
        address _aiOracle
    ) Ownable(msg.sender) {
        identityVault = IdentityVault(_identityVault);
        aiOracle = AIOracle(_aiOracle);
        xcmRelayEnabled = false; // Start with internal tracking, enable after XCM relay is deployed
    }

    // ============================================================
    //                    MANUAL VOTING
    // ============================================================

    /// @notice Cast a manual vote with AI insight displayed
    /// @param _referendumIndex Referendum to vote on
    /// @param _aye True for aye, false for nay
    /// @param _conviction Conviction multiplier (0-6)
    /// @param _amount DOT to commit
    function vote(
        uint256 _referendumIndex,
        bool _aye,
        uint256 _conviction,
        uint256 _amount
    ) external nonReentrant {
        if (hasVoted[msg.sender][_referendumIndex]) revert AlreadyVoted();
        if (_conviction > 6) revert InvalidConviction();
        if (_amount == 0) revert ZeroAmount();

        _recordVote(
            msg.sender,
            _referendumIndex,
            _aye,
            _conviction,
            _amount,
            false,  // not AI vote
            0,      // no AI confidence
            ""      // no reasoning hash
        );

        // Relay vote to Relay Chain via XCM if enabled
        if (xcmRelayEnabled && address(xcmRelay) != address(0)) {
            xcmRelay.relayVote(
                msg.sender,
                uint32(_referendumIndex),
                _aye,
                uint8(_conviction),
                uint128(_amount)
            );
            emit VoteRelayedViaXCM(msg.sender, _referendumIndex, _aye, _conviction);
        }

        emit VoteCast(msg.sender, _referendumIndex, _aye, _conviction, false, 0);
    }

    // ============================================================
    //                    AI AUTO-VOTING
    // ============================================================

    /// @notice Oracle executes an AI-generated vote for a user
    /// @dev Only callable by authorized oracle addresses
    /// @param _user User whose preferences determined the vote
    /// @param _referendumIndex Referendum to vote on
    /// @param _aye AI's recommended vote
    /// @param _conviction Conviction to use (respects user's max)
    /// @param _amount DOT to commit (respects user's limits)
    /// @param _confidence AI confidence score (0-100)
    /// @param _reasoningHash IPFS hash of personalized reasoning
    function executeAIVote(
        address _user,
        uint256 _referendumIndex,
        bool _aye,
        uint256 _conviction,
        uint256 _amount,
        uint8 _confidence,
        string calldata _reasoningHash
    ) external onlyOracle nonReentrant {
        // Validate user has identity and auto-vote enabled
        if (!identityVault.hasIdentity(_user)) revert NoIdentity();

        (
            ,  // exists
            ,  // riskTolerance
            ,  // minConfidenceThreshold
            ,  // maxAutoVoteAmountDOT
            bool autoVoteEnabled,
            ,  // preferencesIPFSHash
            ,  // createdAt
               // updatedAt
        ) = identityVault.identities(_user);
        if (!autoVoteEnabled) revert AutoVoteNotEnabled();

        // Validate analysis exists
        if (!aiOracle.hasAnalysis(_referendumIndex)) revert NoAnalysis();

        // Check track delegation
        AIOracle.ProposalAnalysis memory analysis = aiOracle.getAnalysis(_referendumIndex);

        if (!identityVault.canAutoVote(_user, analysis.track, _amount, _confidence)) {
            revert ConfidenceBelowThreshold();
        }

        // Check hasn't already voted
        if (hasVoted[_user][_referendumIndex]) revert AlreadyVoted();
        if (_conviction > 6) revert InvalidConviction();

        _recordVote(
            _user,
            _referendumIndex,
            _aye,
            _conviction,
            _amount,
            true,
            _confidence,
            _reasoningHash
        );

        // Relay vote to Relay Chain via XCM if enabled
        if (xcmRelayEnabled && address(xcmRelay) != address(0)) {
            xcmRelay.relayVote(
                _user,
                uint32(_referendumIndex),
                _aye,
                uint8(_conviction),
                uint128(_amount)
            );
            emit VoteRelayedViaXCM(_user, _referendumIndex, _aye, _conviction);
        }

        totalAIVotes++;

        emit AIVoteExecuted(_user, _referendumIndex, _aye, _confidence, _reasoningHash);
        emit VoteCast(_user, _referendumIndex, _aye, _conviction, true, _confidence);
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    /// @notice Get a user's vote on a specific referendum
    function getVote(address _user, uint256 _referendumIndex)
        external
        view
        returns (VoteRecord memory)
    {
        return voteRecords[_user][_referendumIndex];
    }

    /// @notice Get a user's voting history (referendum indices)
    function getUserVoteHistory(address _user)
        external
        view
        returns (uint256[] memory)
    {
        return userVoteHistory[_user];
    }

    /// @notice Get paginated vote history for a user
    function getUserVoteHistoryPaginated(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (uint256[] memory) {
        uint256[] storage history = userVoteHistory[_user];
        uint256 end = _offset + _limit;
        if (end > history.length) end = history.length;
        uint256 resultLength = end - _offset;
        uint256[] memory result = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = history[_offset + i];
        }
        return result;
    }

    /// @notice Get referendum stats tracked by GovMind
    function getReferendumStats(uint256 _referendumIndex)
        external
        view
        returns (
            uint256 totalAye,
            uint256 totalNay,
            uint256 voterCount,
            uint256 aiVoterCount
        )
    {
        ReferendumTracker storage tracker = referendumTrackers[_referendumIndex];
        return (
            tracker.totalAye,
            tracker.totalNay,
            tracker.voterCount,
            tracker.aiVoterCount
        );
    }

    /// @notice Get personalized AI recommendation for a specific user on a referendum
    /// @dev Cross-references user's 6-axis preferences against proposal category/risk
    ///      to produce a recommendation that differs per user. Users without an identity
    ///      receive the raw AI analysis unchanged.
    function getPersonalizedInsight(
        address _user,
        uint256 _referendumIndex
    )
        external
        view
        returns (
            int8 personalizedRecommendation,
            uint8 adjustedConfidence,
            uint8 riskScore,
            uint8 alignmentScore,
            string memory analysisHash
        )
    {
        if (!aiOracle.hasAnalysis(_referendumIndex)) {
            return (0, 0, 0, 50, "");
        }

        AIOracle.ProposalAnalysis memory analysis = aiOracle.getAnalysis(_referendumIndex);

        // No identity → return base analysis with neutral alignment
        if (!identityVault.hasIdentity(_user)) {
            return (
                analysis.recommendation,
                analysis.confidence,
                analysis.riskScore,
                50,
                analysis.analysisIPFSHash
            );
        }

        // Compute personalized alignment
        uint8 alignment = _computeAlignmentScore(_user, analysis.categoryId, analysis.riskScore);

        // Determine personalized recommendation
        int8 baseRec = analysis.recommendation;
        int8 persRec;
        uint8 persConfidence;

        if (alignment >= 60) {
            if (baseRec >= 0) {
                // User likes this category + AI says Aye/Abstain → Aye
                persRec = int8(1);
                // Boost confidence proportional to alignment strength
                persConfidence = uint8(_min(100, uint256(analysis.confidence) + (uint256(alignment) - 50) / 2));
            } else {
                // User likes this category but AI says Nay → Abstain (conflicting signals)
                persRec = int8(0);
                persConfidence = uint8(_min(100, uint256(analysis.confidence) / 2 + uint256(alignment) / 2));
            }
        } else if (alignment <= 40) {
            if (baseRec <= 0) {
                // User dislikes category + AI says Nay/Abstain → Nay
                persRec = int8(-1);
                persConfidence = uint8(_min(100, uint256(analysis.confidence) + (50 - uint256(alignment)) / 2));
            } else {
                // User dislikes category but AI says Aye → Nay (user values override)
                persRec = int8(-1);
                persConfidence = uint8(_min(100, uint256(analysis.confidence) / 2 + (50 - uint256(alignment)) / 2));
            }
        } else {
            // Neutral zone (41-59) → keep base recommendation
            persRec = baseRec;
            persConfidence = analysis.confidence;
        }

        return (
            persRec,
            persConfidence,
            analysis.riskScore,
            alignment,
            analysis.analysisIPFSHash
        );
    }

    /// @notice Get personalized insight using PVM Rust alignment scorer (cross-VM)
    /// @dev Non-view because cross-VM calls are state-changing transactions.
    ///      Uses the Rust PVM contract for alignment computation on RISC-V.
    function getPersonalizedInsightPVM(
        address _user,
        uint256 _referendumIndex
    )
        external
        returns (
            int8 personalizedRecommendation,
            uint8 adjustedConfidence,
            uint8 riskScore,
            uint8 alignmentScore,
            string memory analysisHash
        )
    {
        require(usePVMScorer && address(alignmentScorerPVM) != address(0), "PVM scorer not enabled");

        if (!aiOracle.hasAnalysis(_referendumIndex)) {
            return (0, 0, 0, 50, "");
        }

        AIOracle.ProposalAnalysis memory analysis = aiOracle.getAnalysis(_referendumIndex);

        if (!identityVault.hasIdentity(_user)) {
            return (
                analysis.recommendation,
                analysis.confidence,
                analysis.riskScore,
                50,
                analysis.analysisIPFSHash
            );
        }

        // Cross-VM call to Rust PVM alignment scorer
        (alignmentScore, personalizedRecommendation, adjustedConfidence) = _computeAlignmentPVM(
            _user, analysis.categoryId, analysis.riskScore, analysis.recommendation, analysis.confidence
        );
        riskScore = analysis.riskScore;
        analysisHash = analysis.analysisIPFSHash;
    }

    /// @dev Internal helper to call PVM scorer, avoids stack-too-deep
    function _computeAlignmentPVM(
        address _user,
        uint8 _categoryId,
        uint8 _riskScore,
        int8 _recommendation,
        uint8 _confidence
    ) internal returns (uint8, int8, uint8) {
        uint8[6] memory w = identityVault.getPreferenceWeights(_user);
        (, uint8 riskTol, , , , , ,) = identityVault.identities(_user);
        return _callPVMScorer(w, riskTol, _categoryId, _riskScore, _recommendation, _confidence);
    }

    /// @dev Separate function to isolate the 11-arg external call
    function _callPVMScorer(
        uint8[6] memory w,
        uint8 _riskTol,
        uint8 _catId,
        uint8 _risk,
        int8 _rec,
        uint8 _conf
    ) internal returns (uint8, int8, uint8) {
        return alignmentScorerPVM.computeAlignment(
            w[0], w[1], w[2], w[3], w[4], w[5],
            _riskTol, _catId, _risk, _rec, _conf
        );
    }

    // ============================================================
    //                       ADMIN
    // ============================================================

    /// @notice Set the XCM Governance Relay contract
    function setXCMRelay(address _relay) external onlyOwner {
        xcmRelay = XCMGovernanceRelay(_relay);
        emit XCMRelayUpdated(_relay);
    }

    /// @notice Toggle XCM vote relay to Relay Chain
    function toggleXCMRelay(bool _enabled) external onlyOwner {
        xcmRelayEnabled = _enabled;
        emit XCMRelayToggled(_enabled);
    }

    /// @notice Update contract references
    function updateContracts(
        address _identityVault,
        address _aiOracle
    ) external onlyOwner {
        if (_identityVault != address(0)) {
            identityVault = IdentityVault(_identityVault);
        }
        if (_aiOracle != address(0)) {
            aiOracle = AIOracle(_aiOracle);
        }
    }

    /// @notice Set PVM alignment scorer contract and toggle cross-VM computation
    /// @dev The PVM contract (Rust → RISC-V) handles alignment scoring natively.
    ///      When enabled, getPersonalizedInsightPVM() delegates computation
    ///      to the Rust contract via pallet-revive cross-VM dispatch.
    function setPVMScorer(address _scorer, bool _enabled) external onlyOwner {
        alignmentScorerPVM = IAlignmentScorer(_scorer);
        usePVMScorer = _enabled;
        emit PVMScorerUpdated(_scorer, _enabled);
    }

    // ============================================================
    //                      INTERNAL
    // ============================================================

    /// @notice Compute alignment score between user preferences and proposal category
    /// @dev Returns 0-100 where 100 = fully aligned, 0 = fully opposed, 50 = neutral
    function _computeAlignmentScore(
        address _user,
        uint8 _categoryId,
        uint8 _riskScore
    ) internal view returns (uint8) {
        (uint8 supportAxis, uint8 opposeAxis, bool hasMappig) = _getCategoryAxes(_categoryId);

        // No axis mapping (e.g. OTHER category) → neutral
        if (!hasMappig) return 50;

        uint8[6] memory weights = identityVault.getPreferenceWeights(_user);
        uint8 supportWeight = weights[supportAxis];
        uint8 opposeWeight = weights[opposeAxis];

        // alignment = 50 + (support - oppose) / 2, clamped to [0, 100]
        int16 raw = int16(50) + (int16(uint16(supportWeight)) - int16(uint16(opposeWeight))) / 2;

        // Apply risk penalty: if proposal risk exceeds user's tolerance, reduce alignment
        (, uint8 riskTolerance, , , , , ,) = identityVault.identities(_user);
        if (_riskScore > riskTolerance) {
            raw -= int16(uint16(_riskScore - riskTolerance)) / 2;
        }

        // Clamp to [0, 100]
        if (raw < 0) return 0;
        if (raw > 100) return 100;
        return uint8(uint16(raw));
    }

    /// @notice Map proposal category to supporting/opposing preference axes
    function _getCategoryAxes(uint8 _categoryId)
        internal
        pure
        returns (uint8 supportAxis, uint8 opposeAxis, bool hasMapping)
    {
        // TREASURY_SPEND(0), TREASURY_TIP(1), BOUNTY(8)
        if (_categoryId == 0 || _categoryId == 1 || _categoryId == 8) {
            return (1, 0, true); // TREASURY_GROWTH supports, TREASURY_CONSERVATIVE opposes
        }
        // TECHNICAL_UPGRADE(2)
        if (_categoryId == 2) {
            return (2, 3, true); // TECHNICAL_PROGRESSIVE supports, TECHNICAL_CONSERVATIVE opposes
        }
        // GOVERNANCE_CHANGE(3), COMMUNITY_INITIATIVE(6)
        if (_categoryId == 3 || _categoryId == 6) {
            return (4, 5, true); // COMMUNITY_FOCUSED supports, INFRASTRUCTURE_FOCUSED opposes
        }
        // STAKING_OPERATION(4), BRIDGE_OPERATION(5), INFRASTRUCTURE(7)
        if (_categoryId == 4 || _categoryId == 5 || _categoryId == 7) {
            return (5, 4, true); // INFRASTRUCTURE_FOCUSED supports, COMMUNITY_FOCUSED opposes
        }
        // OTHER(9) or unknown
        return (0, 0, false);
    }

    /// @notice Safe minimum
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _recordVote(
        address _voter,
        uint256 _referendumIndex,
        bool _aye,
        uint256 _conviction,
        uint256 _amount,
        bool _isAIVote,
        uint8 _aiConfidence,
        string memory _reasoningHash
    ) internal {
        voteRecords[_voter][_referendumIndex] = VoteRecord({
            voter: _voter,
            referendumIndex: _referendumIndex,
            aye: _aye,
            conviction: _conviction,
            amount: _amount,
            isAIVote: _isAIVote,
            aiConfidence: _aiConfidence,
            reasoningHash: _reasoningHash,
            timestamp: block.timestamp
        });

        hasVoted[_voter][_referendumIndex] = true;
        userVoteHistory[_voter].push(_referendumIndex);

        // Update referendum tracker
        ReferendumTracker storage tracker = referendumTrackers[_referendumIndex];
        if (!tracker.isActive) {
            tracker.referendumIndex = _referendumIndex;
            tracker.isActive = true;
        }
        if (_aye) {
            tracker.totalAye += _amount;
        } else {
            tracker.totalNay += _amount;
        }
        tracker.voterCount++;
        if (_isAIVote) {
            tracker.aiVoterCount++;
        }

        totalVotesCast++;
    }

}
