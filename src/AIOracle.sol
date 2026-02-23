// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IGovMindOracle.sol";

/// @title AIOracle - AI Analysis Bridge
/// @notice Receives AI-generated proposal analyses from the backend
///         and stores them on-chain for the GovMindCore to use.
///         Supports re-analysis when community data changes (new comments,
///         tally swings, status changes) via updateAnalysis().
/// @dev The oracle address is a trusted backend signer. In production,
///      this would use signature verification or a decentralized oracle network.
contract AIOracle is Ownable, IGovMindOracle {
    // ============================================================
    //                         ENUMS
    // ============================================================

    /// @notice Proposal categories for classification
    enum ProposalCategory {
        TREASURY_SPEND,          // 0
        TREASURY_TIP,            // 1
        TECHNICAL_UPGRADE,       // 2
        GOVERNANCE_CHANGE,       // 3
        STAKING_OPERATION,       // 4
        BRIDGE_OPERATION,        // 5
        COMMUNITY_INITIATIVE,    // 6
        INFRASTRUCTURE,          // 7
        BOUNTY,                  // 8
        OTHER                    // 9
    }

    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice Full on-chain analysis record
    struct ProposalAnalysis {
        uint256 referendumIndex;
        uint8 track;
        uint8 riskScore;
        uint8 categoryId;
        int8 recommendation;        // -1 Nay, 0 Abstain, 1 Aye
        uint8 confidence;            // 0-100 how confident the AI is
        uint256 requestedAmountDOT;
        uint256 treasuryImpactBps;   // Basis points
        string analysisIPFSHash;
        uint256 analyzedAt;
        bool exists;
        uint256 version;             // Incremented on each re-analysis
    }

    /// @notice Pending analysis request
    struct AnalysisRequest {
        address requester;
        uint256 requestedAt;
        bool fulfilled;
    }

    // ============================================================
    //                         STATE
    // ============================================================

    /// @notice Referendum index => analysis
    mapping(uint256 => ProposalAnalysis) public analyses;

    /// @notice Referendum index => request
    mapping(uint256 => AnalysisRequest) public requests;

    /// @notice Authorized oracle addresses (backend signers)
    mapping(address => bool) public authorizedOracles;

    /// @notice Minimum fee to request an analysis (anti-spam)
    uint256 public analysisRequestFee;

    /// @notice Total analyses published (includes first publish only, not updates)
    uint256 public totalAnalyses;

    /// @notice Total re-analyses performed
    uint256 public totalUpdates;

    /// @notice Array of all analyzed referendum indices
    uint256[] public analyzedReferenda;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);
    event AnalysisRequestCreated(uint256 indexed referendumIndex, address indexed requester);
    event AnalysisPublished(
        uint256 indexed referendumIndex,
        uint8 riskScore,
        int8 recommendation,
        uint8 confidence
    );
    event AnalysisUpdated(
        uint256 indexed referendumIndex,
        uint8 riskScore,
        int8 oldRecommendation,
        int8 newRecommendation,
        uint8 confidence,
        uint256 version
    );
    event RequestFeeUpdated(uint256 newFee);

    // ============================================================
    //                         ERRORS
    // ============================================================

    error NotAuthorizedOracle();
    error AnalysisAlreadyExists();
    error AnalysisDoesNotExist();
    error RequestAlreadyExists();
    error InsufficientFee();
    error InvalidRiskScore();
    error InvalidConfidence();
    error InvalidRecommendation();

    // ============================================================
    //                       MODIFIERS
    // ============================================================

    modifier onlyOracle() {
        if (!authorizedOracles[msg.sender]) revert NotAuthorizedOracle();
        _;
    }

    // ============================================================
    //                      CONSTRUCTOR
    // ============================================================

    /// @param _initialOracle Address of the initial oracle backend
    /// @param _requestFee Initial fee to request analysis (in wei)
    constructor(address _initialOracle, uint256 _requestFee) Ownable(msg.sender) {
        authorizedOracles[_initialOracle] = true;
        analysisRequestFee = _requestFee;
        emit OracleAuthorized(_initialOracle);
    }

    // ============================================================
    //                    ORACLE MANAGEMENT
    // ============================================================

    /// @notice Authorize a new oracle address
    function authorizeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = true;
        emit OracleAuthorized(_oracle);
    }

    /// @notice Revoke an oracle address
    function revokeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = false;
        emit OracleRevoked(_oracle);
    }

    /// @notice Update the analysis request fee
    function setRequestFee(uint256 _fee) external onlyOwner {
        analysisRequestFee = _fee;
        emit RequestFeeUpdated(_fee);
    }

    // ============================================================
    //                   ANALYSIS REQUESTS
    // ============================================================

    /// @notice Request an AI analysis for a referendum
    /// @param _referendumIndex The referendum to analyze
    function requestAnalysis(uint256 _referendumIndex) external payable {
        if (msg.value < analysisRequestFee) revert InsufficientFee();
        if (requests[_referendumIndex].requester != address(0)) revert RequestAlreadyExists();

        requests[_referendumIndex] = AnalysisRequest({
            requester: msg.sender,
            requestedAt: block.timestamp,
            fulfilled: false
        });

        emit AnalysisRequestCreated(_referendumIndex, msg.sender);
        emit AnalysisRequested(_referendumIndex, msg.sender);
    }

    // ============================================================
    //                  ANALYSIS FULFILLMENT
    // ============================================================

    /// @notice Oracle publishes an AI analysis for a referendum (first time only)
    /// @dev Can be called proactively (without a request) or to fulfill a request
    function publishAnalysis(
        uint256 _referendumIndex,
        uint8 _track,
        uint8 _riskScore,
        uint8 _categoryId,
        int8 _recommendation,
        uint8 _confidence,
        uint256 _requestedAmountDOT,
        uint256 _treasuryImpactBps,
        string calldata _analysisIPFSHash
    ) external onlyOracle {
        if (analyses[_referendumIndex].exists) revert AnalysisAlreadyExists();
        _validateParams(_riskScore, _confidence, _recommendation);

        analyses[_referendumIndex] = ProposalAnalysis({
            referendumIndex: _referendumIndex,
            track: _track,
            riskScore: _riskScore,
            categoryId: _categoryId,
            recommendation: _recommendation,
            confidence: _confidence,
            requestedAmountDOT: _requestedAmountDOT,
            treasuryImpactBps: _treasuryImpactBps,
            analysisIPFSHash: _analysisIPFSHash,
            analyzedAt: block.timestamp,
            exists: true,
            version: 1
        });

        // Mark request as fulfilled if one exists
        if (requests[_referendumIndex].requester != address(0)) {
            requests[_referendumIndex].fulfilled = true;
        }

        analyzedReferenda.push(_referendumIndex);
        totalAnalyses++;

        emit AnalysisPublished(_referendumIndex, _riskScore, _recommendation, _confidence);
        emit AnalysisFulfilled(_referendumIndex, _riskScore, _recommendation);
    }

    /// @notice Re-analyze a referendum when community data has changed
    /// @dev Called by oracle when it detects significant changes:
    ///      - New comments with concerns/endorsements
    ///      - Tally swing > threshold
    ///      - Status change (e.g. Deciding → Confirming)
    ///      - Proposal content edited
    ///      Preserves version history on-chain via events.
    function updateAnalysis(
        uint256 _referendumIndex,
        uint8 _riskScore,
        uint8 _categoryId,
        int8 _recommendation,
        uint8 _confidence,
        uint256 _requestedAmountDOT,
        uint256 _treasuryImpactBps,
        string calldata _analysisIPFSHash
    ) external onlyOracle {
        if (!analyses[_referendumIndex].exists) revert AnalysisDoesNotExist();
        _validateParams(_riskScore, _confidence, _recommendation);

        ProposalAnalysis storage existing = analyses[_referendumIndex];
        int8 oldRec = existing.recommendation;
        uint256 newVersion = existing.version + 1;

        existing.riskScore = _riskScore;
        existing.categoryId = _categoryId;
        existing.recommendation = _recommendation;
        existing.confidence = _confidence;
        existing.requestedAmountDOT = _requestedAmountDOT;
        existing.treasuryImpactBps = _treasuryImpactBps;
        existing.analysisIPFSHash = _analysisIPFSHash;
        existing.analyzedAt = block.timestamp;
        existing.version = newVersion;

        totalUpdates++;

        emit AnalysisUpdated(
            _referendumIndex,
            _riskScore,
            oldRec,
            _recommendation,
            _confidence,
            newVersion
        );
    }

    // ============================================================
    //                      VIEW FUNCTIONS
    // ============================================================

    /// @notice Get full analysis for a referendum
    function getAnalysis(uint256 _referendumIndex)
        external
        view
        returns (ProposalAnalysis memory)
    {
        return analyses[_referendumIndex];
    }

    /// @notice Check if analysis exists for a referendum
    function hasAnalysis(uint256 _referendumIndex) external view returns (bool) {
        return analyses[_referendumIndex].exists;
    }

    /// @notice Get the version (re-analysis count) for a referendum
    function getAnalysisVersion(uint256 _referendumIndex) external view returns (uint256) {
        return analyses[_referendumIndex].version;
    }

    /// @notice Get the total number of analyzed referenda
    function getAnalyzedReferendaCount() external view returns (uint256) {
        return analyzedReferenda.length;
    }

    /// @notice Get a page of analyzed referenda indices
    /// @param _offset Start index
    /// @param _limit Number of items
    function getAnalyzedReferendaPaginated(uint256 _offset, uint256 _limit)
        external
        view
        returns (uint256[] memory)
    {
        uint256 end = _offset + _limit;
        if (end > analyzedReferenda.length) {
            end = analyzedReferenda.length;
        }
        uint256 resultLength = end - _offset;
        uint256[] memory result = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = analyzedReferenda[_offset + i];
        }
        return result;
    }

    // ============================================================
    //                       ADMIN
    // ============================================================

    /// @notice Withdraw collected fees
    function withdrawFees(address payable _to) external onlyOwner {
        (bool success, ) = _to.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }

    // ============================================================
    //                      INTERNAL
    // ============================================================

    function _validateParams(
        uint8 _riskScore,
        uint8 _confidence,
        int8 _recommendation
    ) internal pure {
        if (_riskScore > 100) revert InvalidRiskScore();
        if (_confidence > 100) revert InvalidConfidence();
        if (_recommendation < -1 || _recommendation > 1) revert InvalidRecommendation();
    }
}
