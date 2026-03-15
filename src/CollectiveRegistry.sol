// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CollectiveRegistry - On-Chain AI Voting Collectives
/// @notice Manages governance collectives with 6-axis identity profiles.
///         Users join a collective to receive AI-aligned voting recommendations.
/// @dev Each collective has a fixed governance profile (same 6 axes as IdentityVault).
///      Membership is one-collective-per-address. Collective profiles are set by owner.
contract CollectiveRegistry is Ownable {
    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice On-chain representation of a voting collective
    struct Collective {
        bool exists;
        string name;                  // e.g. "Sustainability Guardians"
        string philosophy;            // Short description of collective's stance
        uint8[6] axes;                // 6-axis governance profile (0-100 each)
        uint8 riskTolerance;          // 0-100: collective's risk appetite
        uint256 memberCount;          // Current number of members
        uint256 createdAt;
    }

    // ============================================================
    //                         STATE
    // ============================================================

    /// @notice collectiveId => Collective data
    mapping(uint8 => Collective) public collectives;

    /// @notice user address => collectiveId (0 = not joined)
    mapping(address => uint8) public memberCollective;

    /// @notice user address => has joined any collective
    mapping(address => bool) public isMember;

    /// @notice Total number of registered collectives
    uint8 public collectiveCount;

    /// @notice Total members across all collectives
    uint256 public totalMembers;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event CollectiveCreated(uint8 indexed collectiveId, string name);
    event MemberJoined(address indexed user, uint8 indexed collectiveId);
    event MemberLeft(address indexed user, uint8 indexed collectiveId);
    event MemberSwitched(address indexed user, uint8 indexed fromCollective, uint8 indexed toCollective);

    // ============================================================
    //                         ERRORS
    // ============================================================

    error CollectiveDoesNotExist();
    error AlreadyInThisCollective();
    error NotInAnyCollective();
    error InvalidAxis();
    error CollectiveAlreadyExists();

    // ============================================================
    //                      CONSTRUCTOR
    // ============================================================

    constructor() Ownable(msg.sender) {}

    // ============================================================
    //                    ADMIN: COLLECTIVE MANAGEMENT
    // ============================================================

    /// @notice Register a new collective with its governance profile
    /// @param _id Collective ID (1-indexed, 0 reserved for "none")
    /// @param _name Display name
    /// @param _philosophy Short philosophy statement
    /// @param _axes 6-axis governance profile [0-100 each]
    /// @param _riskTolerance Risk appetite (0-100)
    function createCollective(
        uint8 _id,
        string calldata _name,
        string calldata _philosophy,
        uint8[6] calldata _axes,
        uint8 _riskTolerance
    ) external onlyOwner {
        if (_id == 0) revert InvalidAxis();
        if (collectives[_id].exists) revert CollectiveAlreadyExists();

        for (uint8 i = 0; i < 6; i++) {
            if (_axes[i] > 100) revert InvalidAxis();
        }

        collectives[_id] = Collective({
            exists: true,
            name: _name,
            philosophy: _philosophy,
            axes: _axes,
            riskTolerance: _riskTolerance,
            memberCount: 0,
            createdAt: block.timestamp
        });

        collectiveCount++;
        emit CollectiveCreated(_id, _name);
    }

    // ============================================================
    //                    MEMBERSHIP
    // ============================================================

    /// @notice Join a collective. If already in one, switches automatically.
    /// @param _collectiveId The collective to join (1-indexed)
    function joinCollective(uint8 _collectiveId) external {
        if (!collectives[_collectiveId].exists) revert CollectiveDoesNotExist();

        if (isMember[msg.sender]) {
            uint8 currentId = memberCollective[msg.sender];
            if (currentId == _collectiveId) revert AlreadyInThisCollective();

            // Leave current collective
            collectives[currentId].memberCount--;
            emit MemberSwitched(msg.sender, currentId, _collectiveId);
        } else {
            isMember[msg.sender] = true;
            totalMembers++;
            emit MemberJoined(msg.sender, _collectiveId);
        }

        memberCollective[msg.sender] = _collectiveId;
        collectives[_collectiveId].memberCount++;
    }

    /// @notice Leave your current collective
    function leaveCollective() external {
        if (!isMember[msg.sender]) revert NotInAnyCollective();

        uint8 currentId = memberCollective[msg.sender];
        collectives[currentId].memberCount--;
        memberCollective[msg.sender] = 0;
        isMember[msg.sender] = false;
        totalMembers--;

        emit MemberLeft(msg.sender, currentId);
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    /// @notice Get a collective's full 6-axis governance profile
    function getCollectiveAxes(uint8 _collectiveId)
        external
        view
        returns (uint8[6] memory)
    {
        if (!collectives[_collectiveId].exists) revert CollectiveDoesNotExist();
        return collectives[_collectiveId].axes;
    }

    /// @notice Get the collective a user belongs to (0 = none)
    function getUserCollective(address _user) external view returns (uint8) {
        return memberCollective[_user];
    }

    /// @notice Get member count for a collective
    function getMemberCount(uint8 _collectiveId) external view returns (uint256) {
        return collectives[_collectiveId].memberCount;
    }

    /// @notice Check if a collective exists
    function collectiveExists(uint8 _collectiveId) external view returns (bool) {
        return collectives[_collectiveId].exists;
    }
}
