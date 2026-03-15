// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityVault.sol";
import "./interfaces/ICollectiveAggregator.sol";

/// @title CollectiveRegistry - On-Chain AI Voting Collectives with Dynamic Profiles
/// @notice Manages governance collectives with 6-axis identity profiles.
///         When members join or leave, the collective's profile dynamically shifts
///         based on the weighted average of all members' on-chain identities,
///         computed via a PVM Rust contract on RISC-V.
/// @dev Collective profiles = seed (founder's vision) blended with member average.
///      Seed weight (e.g. 30%) ensures the collective never drifts completely from its name.
///      Cross-VM: EVM CollectiveRegistry → PVM CollectiveAggregator → EVM IdentityVault
contract CollectiveRegistry is Ownable {
    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice On-chain representation of a voting collective
    struct Collective {
        bool exists;
        string name;                  // e.g. "Sustainability Guardians"
        string philosophy;            // Short description of collective's stance
        uint8[6] seedAxes;            // Founder's original 6-axis profile (immutable anchor)
        uint8[6] axes;                // Current dynamic profile (shifts with members)
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

    /// @notice Reference to IdentityVault for reading member profiles
    IdentityVault public identityVault;

    /// @notice PVM Collective Aggregator contract (Rust on RISC-V)
    ICollectiveAggregator public aggregatorPVM;

    /// @notice Whether to use PVM for profile aggregation
    bool public usePVMAggregator;

    /// @notice Seed weight: percentage of founder's profile in the blend (0-100)
    /// @dev Default 30 = 30% seed, 70% member average
    uint8 public seedWeight;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event CollectiveCreated(uint8 indexed collectiveId, string name);
    event MemberJoined(address indexed user, uint8 indexed collectiveId);
    event MemberLeft(address indexed user, uint8 indexed collectiveId);
    event MemberSwitched(address indexed user, uint8 indexed fromCollective, uint8 indexed toCollective);
    event ProfileShifted(uint8 indexed collectiveId, uint8[6] newAxes);
    event PVMAggregatorUpdated(address indexed aggregator, bool enabled);

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

    constructor(address _identityVault) Ownable(msg.sender) {
        identityVault = IdentityVault(_identityVault);
        seedWeight = 30; // 30% seed, 70% members
    }

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
            seedAxes: _axes,
            axes: _axes,  // starts equal to seed
            riskTolerance: _riskTolerance,
            memberCount: 0,
            createdAt: block.timestamp
        });

        collectiveCount++;
        emit CollectiveCreated(_id, _name);
    }

    /// @notice Set PVM aggregator contract and toggle cross-VM aggregation
    function setPVMAggregator(address _aggregator, bool _enabled) external onlyOwner {
        aggregatorPVM = ICollectiveAggregator(_aggregator);
        usePVMAggregator = _enabled;
        emit PVMAggregatorUpdated(_aggregator, _enabled);
    }

    /// @notice Update seed weight
    function setSeedWeight(uint8 _weight) external onlyOwner {
        require(_weight <= 100, "Weight > 100");
        seedWeight = _weight;
    }

    // ============================================================
    //                    MEMBERSHIP
    // ============================================================

    /// @notice Join a collective. If already in one, switches automatically.
    ///         If the user has an on-chain identity, the collective's profile shifts.
    /// @param _collectiveId The collective to join (1-indexed)
    function joinCollective(uint8 _collectiveId) external {
        if (!collectives[_collectiveId].exists) revert CollectiveDoesNotExist();

        if (isMember[msg.sender]) {
            uint8 currentId = memberCollective[msg.sender];
            if (currentId == _collectiveId) revert AlreadyInThisCollective();

            // Leave current collective (with profile recalc)
            _removeFromCollective(currentId, msg.sender);
            emit MemberSwitched(msg.sender, currentId, _collectiveId);
        } else {
            isMember[msg.sender] = true;
            totalMembers++;
            emit MemberJoined(msg.sender, _collectiveId);
        }

        memberCollective[msg.sender] = _collectiveId;

        // Add to new collective and recalculate profile
        _addToCollective(_collectiveId, msg.sender);
    }

    /// @notice Leave your current collective
    function leaveCollective() external {
        if (!isMember[msg.sender]) revert NotInAnyCollective();

        uint8 currentId = memberCollective[msg.sender];
        _removeFromCollective(currentId, msg.sender);

        memberCollective[msg.sender] = 0;
        isMember[msg.sender] = false;
        totalMembers--;

        emit MemberLeft(msg.sender, currentId);
    }

    // ============================================================
    //                    INTERNAL: PROFILE AGGREGATION
    // ============================================================

    function _addToCollective(uint8 _collectiveId, address _user) internal {
        Collective storage c = collectives[_collectiveId];
        uint256 countBefore = c.memberCount;
        c.memberCount++;

        // If user has an identity, recalculate profile
        if (identityVault.hasIdentity(_user)) {
            uint8[6] memory memberAxes = identityVault.getPreferenceWeights(_user);

            if (usePVMAggregator && address(aggregatorPVM) != address(0)) {
                // Cross-VM: delegate computation to PVM Rust contract
                uint8[6] memory newAxes = aggregatorPVM.recalculateOnJoin(
                    c.seedAxes,
                    c.axes,
                    memberAxes,
                    uint32(countBefore),
                    seedWeight
                );
                c.axes = newAxes;
            } else {
                // Fallback: Solidity computation
                _recalculateOnJoinSolidity(c, memberAxes, countBefore);
            }

            emit ProfileShifted(_collectiveId, c.axes);
        }
    }

    function _removeFromCollective(uint8 _collectiveId, address _user) internal {
        Collective storage c = collectives[_collectiveId];
        uint256 countBefore = c.memberCount;
        c.memberCount--;

        if (identityVault.hasIdentity(_user)) {
            uint8[6] memory memberAxes = identityVault.getPreferenceWeights(_user);

            if (usePVMAggregator && address(aggregatorPVM) != address(0)) {
                uint8[6] memory newAxes = aggregatorPVM.recalculateOnLeave(
                    c.seedAxes,
                    c.axes,
                    memberAxes,
                    uint32(countBefore),
                    seedWeight
                );
                c.axes = newAxes;
            } else {
                _recalculateOnLeaveSolidity(c, memberAxes, countBefore);
            }

            emit ProfileShifted(_collectiveId, c.axes);
        }
    }

    /// @notice Solidity fallback for profile aggregation (mirrors PVM logic)
    function _recalculateOnJoinSolidity(
        Collective storage c,
        uint8[6] memory newMemberAxes,
        uint256 countBefore
    ) internal {
        uint256 sw = seedWeight;
        uint256 mw = 100 - sw;

        if (countBefore == 0) {
            // First member
            for (uint8 i = 0; i < 6; i++) {
                c.axes[i] = uint8((uint256(c.seedAxes[i]) * sw + uint256(newMemberAxes[i]) * mw) / 100);
            }
        } else {
            for (uint8 i = 0; i < 6; i++) {
                // Reverse member avg from current blend
                uint256 currentTotal = uint256(c.axes[i]) * 100;
                uint256 seedPart = uint256(c.seedAxes[i]) * sw;
                uint256 memberAvgX100 = currentTotal >= seedPart
                    ? (currentTotal - seedPart) * 100 / mw
                    : 0;

                // New average with the joining member
                uint256 newAvgX100 = (memberAvgX100 * countBefore + uint256(newMemberAxes[i]) * 100)
                    / (countBefore + 1);

                // Blend
                uint256 blended = (uint256(c.seedAxes[i]) * sw + newAvgX100 * mw / 100) / 100;
                c.axes[i] = blended > 100 ? 100 : uint8(blended);
            }
        }
    }

    function _recalculateOnLeaveSolidity(
        Collective storage c,
        uint8[6] memory leavingAxes,
        uint256 countBefore
    ) internal {
        if (countBefore <= 1) {
            // Last member: revert to seed
            c.axes = c.seedAxes;
            return;
        }

        uint256 sw = seedWeight;
        uint256 mw = 100 - sw;

        for (uint8 i = 0; i < 6; i++) {
            uint256 currentTotal = uint256(c.axes[i]) * 100;
            uint256 seedPart = uint256(c.seedAxes[i]) * sw;
            uint256 memberAvgX100 = currentTotal >= seedPart
                ? (currentTotal - seedPart) * 100 / mw
                : 0;

            uint256 leavingX100 = uint256(leavingAxes[i]) * 100;
            uint256 numerator = memberAvgX100 * countBefore >= leavingX100
                ? memberAvgX100 * countBefore - leavingX100
                : 0;
            uint256 newAvgX100 = numerator / (countBefore - 1);

            uint256 blended = (uint256(c.seedAxes[i]) * sw + newAvgX100 * mw / 100) / 100;
            c.axes[i] = blended > 100 ? 100 : uint8(blended);
        }
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    /// @notice Get a collective's current dynamic 6-axis governance profile
    function getCollectiveAxes(uint8 _collectiveId)
        external
        view
        returns (uint8[6] memory)
    {
        if (!collectives[_collectiveId].exists) revert CollectiveDoesNotExist();
        return collectives[_collectiveId].axes;
    }

    /// @notice Get a collective's original seed profile (founder's vision)
    function getSeedAxes(uint8 _collectiveId)
        external
        view
        returns (uint8[6] memory)
    {
        if (!collectives[_collectiveId].exists) revert CollectiveDoesNotExist();
        return collectives[_collectiveId].seedAxes;
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
