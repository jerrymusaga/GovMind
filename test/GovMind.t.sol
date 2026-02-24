// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/IdentityVault.sol";
import "../src/AIOracle.sol";
import "../src/GovMindCore.sol";

contract GovMindTest is Test {
    IdentityVault public vault;
    AIOracle public oracle;
    GovMindCore public core;

    address public owner;
    address public user1;
    address public user2;
    address public oracleBackend;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        oracleBackend = makeAddr("oracleBackend");

        vault = new IdentityVault();
        oracle = new AIOracle(oracleBackend, 0.001 ether);
        core = new GovMindCore(address(vault), address(oracle));
    }

    // ================================================================
    //                    IDENTITY VAULT TESTS
    // ================================================================

    function test_CreateIdentity() public {
        uint8[] memory axes = new uint8[](3);
        uint8[] memory weights = new uint8[](3);
        axes[0] = 0; weights[0] = 80; // TREASURY_CONSERVATIVE
        axes[1] = 2; weights[1] = 60; // TECHNICAL_PROGRESSIVE
        axes[2] = 4; weights[2] = 70; // COMMUNITY_FOCUSED

        vm.prank(user1);
        vault.createIdentity(50, 75, 1000 ether, "QmTest123", axes, weights);

        assertTrue(vault.hasIdentity(user1));
        assertEq(vault.totalIdentities(), 1);

        (
            bool exists,
            uint8 riskTolerance,
            uint8 minConfidence,
            ,
            bool autoVoteEnabled,
            ,
            ,
        ) = vault.identities(user1);

        assertTrue(exists);
        assertEq(riskTolerance, 50);
        assertEq(minConfidence, 75);
        assertFalse(autoVoteEnabled);
    }

    function test_RevertDuplicateIdentity() public {
        uint8[] memory axes = new uint8[](0);
        uint8[] memory weights = new uint8[](0);

        vm.prank(user1);
        vault.createIdentity(50, 75, 1000 ether, "", axes, weights);

        vm.prank(user1);
        vm.expectRevert(IdentityVault.IdentityAlreadyExists.selector);
        vault.createIdentity(50, 75, 1000 ether, "", axes, weights);
    }

    function test_RevertInvalidRiskTolerance() public {
        uint8[] memory axes = new uint8[](0);
        uint8[] memory weights = new uint8[](0);

        vm.prank(user1);
        vm.expectRevert(IdentityVault.InvalidRiskTolerance.selector);
        vault.createIdentity(101, 75, 1000 ether, "", axes, weights);
    }

    function test_UpdatePreferences() public {
        _createIdentity(user1);

        uint8[] memory axes = new uint8[](2);
        uint8[] memory weights = new uint8[](2);
        axes[0] = 1; weights[0] = 90; // TREASURY_GROWTH
        axes[1] = 5; weights[1] = 40; // INFRASTRUCTURE_FOCUSED

        vm.prank(user1);
        vault.updatePreferences(axes, weights);

        uint8[6] memory w = vault.getPreferenceWeights(user1);
        assertEq(w[1], 90);
        assertEq(w[5], 40);
    }

    function test_ToggleAutoVote() public {
        _createIdentity(user1);

        vm.prank(user1);
        vault.toggleAutoVote(true);

        (, , , , bool autoVoteEnabled, , ,) = vault.identities(user1);
        assertTrue(autoVoteEnabled);
    }

    function test_ConfigureTrackDelegation() public {
        _createIdentity(user1);

        vm.prank(user1);
        vault.configureTrackDelegation(0, true, 500 ether, 3);

        (bool enabled, uint256 maxAmount, uint8 maxConviction) =
            vault.trackDelegations(user1, 0);
        assertTrue(enabled);
        assertEq(maxAmount, 500 ether);
        assertEq(maxConviction, 3);
    }

    function test_RevertInvalidConviction() public {
        _createIdentity(user1);

        vm.prank(user1);
        vm.expectRevert(IdentityVault.InvalidConviction.selector);
        vault.configureTrackDelegation(0, true, 500 ether, 7);
    }

    function test_BatchConfigureTracks() public {
        _createIdentity(user1);

        uint8[] memory tracks = new uint8[](2);
        bool[] memory enabled = new bool[](2);
        uint256[] memory maxAmounts = new uint256[](2);
        uint8[] memory maxConvictions = new uint8[](2);

        tracks[0] = 0; enabled[0] = true; maxAmounts[0] = 100 ether; maxConvictions[0] = 1;
        tracks[1] = 1; enabled[1] = true; maxAmounts[1] = 200 ether; maxConvictions[1] = 2;

        vm.prank(user1);
        vault.batchConfigureTracks(tracks, enabled, maxAmounts, maxConvictions);

        (bool e0, uint256 a0,) = vault.trackDelegations(user1, 0);
        (bool e1, uint256 a1,) = vault.trackDelegations(user1, 1);
        assertTrue(e0);
        assertTrue(e1);
        assertEq(a0, 100 ether);
        assertEq(a1, 200 ether);
    }

    function test_CanAutoVote() public {
        _createIdentity(user1);

        vm.startPrank(user1);
        vault.toggleAutoVote(true);
        vault.configureTrackDelegation(0, true, 500 ether, 3);
        vm.stopPrank();

        assertTrue(vault.canAutoVote(user1, 0, 100 ether, 80));
        // Below confidence threshold (75)
        assertFalse(vault.canAutoVote(user1, 0, 100 ether, 50));
        // Above max amount
        assertFalse(vault.canAutoVote(user1, 0, 600 ether, 80));
        // Track not enabled
        assertFalse(vault.canAutoVote(user1, 5, 100 ether, 80));
    }

    // ================================================================
    //                     AI ORACLE TESTS
    // ================================================================

    function test_RequestAnalysis() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        oracle.requestAnalysis{value: 0.001 ether}(42);

        (address requester, , bool fulfilled) = oracle.requests(42);
        assertEq(requester, user1);
        assertFalse(fulfilled);
    }

    function test_RevertInsufficientFee() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(AIOracle.InsufficientFee.selector);
        oracle.requestAnalysis{value: 0.0001 ether}(42);
    }

    function test_PublishAnalysis() public {
        vm.prank(oracleBackend);
        oracle.publishAnalysis(
            42,     // referendumIndex
            0,      // track
            65,     // riskScore
            0,      // categoryId (TREASURY_SPEND)
            1,      // recommendation (Aye)
            85,     // confidence
            50000 ether, // requestedAmountDOT
            230,    // treasuryImpactBps (2.3%)
            "QmAnalysis123"
        );

        assertTrue(oracle.hasAnalysis(42));
        assertEq(oracle.totalAnalyses(), 1);

        AIOracle.ProposalAnalysis memory analysis = oracle.getAnalysis(42);
        assertEq(analysis.riskScore, 65);
        assertEq(analysis.confidence, 85);
        assertEq(analysis.recommendation, int8(1));
    }

    function test_RevertUnauthorizedOracle() public {
        vm.prank(user1);
        vm.expectRevert(AIOracle.NotAuthorizedOracle.selector);
        oracle.publishAnalysis(42, 0, 65, 0, 1, 85, 50000 ether, 230, "QmTest");
    }

    function test_RevertDuplicateAnalysis() public {
        _publishAnalysis(42);

        vm.prank(oracleBackend);
        vm.expectRevert(AIOracle.AnalysisAlreadyExists.selector);
        oracle.publishAnalysis(42, 0, 65, 0, 1, 85, 50000 ether, 230, "QmDuplicate");
    }

    function test_AuthorizeAndRevokeOracle() public {
        address newOracle = makeAddr("newOracle");

        oracle.authorizeOracle(newOracle);
        assertTrue(oracle.authorizedOracles(newOracle));

        oracle.revokeOracle(newOracle);
        assertFalse(oracle.authorizedOracles(newOracle));
    }

    function test_WithdrawFees() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        oracle.requestAnalysis{value: 0.001 ether}(42);

        address payable recipient = payable(makeAddr("recipient"));
        oracle.withdrawFees(recipient);
        assertEq(recipient.balance, 0.001 ether);
    }

    function test_FulfillsRequest() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        oracle.requestAnalysis{value: 0.001 ether}(42);

        _publishAnalysis(42);

        (, , bool fulfilled) = oracle.requests(42);
        assertTrue(fulfilled);
    }

    // ================================================================
    //                  UPDATE ANALYSIS TESTS
    // ================================================================

    function test_UpdateAnalysis() public {
        // First publish
        _publishAnalysis(42);

        AIOracle.ProposalAnalysis memory v1 = oracle.getAnalysis(42);
        assertEq(v1.version, 1);
        assertEq(v1.recommendation, int8(1)); // Aye
        assertEq(v1.riskScore, 65);

        // Simulate: new community concerns detected → oracle re-analyzes
        // Recommendation flips from Aye to Nay, risk increases
        vm.prank(oracleBackend);
        oracle.updateAnalysis(
            42,       // same referendum
            85,       // riskScore increased (was 65)
            0,        // categoryId unchanged
            -1,       // recommendation flipped to Nay
            72,       // confidence
            50000 ether,
            230,
            "QmUpdatedAnalysis_v2"
        );

        AIOracle.ProposalAnalysis memory v2 = oracle.getAnalysis(42);
        assertEq(v2.version, 2);
        assertEq(v2.recommendation, int8(-1)); // Now Nay
        assertEq(v2.riskScore, 85);
        assertEq(oracle.totalUpdates(), 1);
        // totalAnalyses should NOT increment on update
        assertEq(oracle.totalAnalyses(), 1);
    }

    function test_UpdateAnalysisChangesPersonalization() public {
        // Publish initial Aye analysis
        _publishAnalysis(42);

        // Growth user → should get Aye on treasury spend
        {
            uint8[] memory axes = new uint8[](2);
            uint8[] memory weights = new uint8[](2);
            axes[0] = 0; weights[0] = 10;
            axes[1] = 1; weights[1] = 90;

            vm.prank(user1);
            vault.createIdentity(50, 50, 1000 ether, "", axes, weights);
        }

        (int8 recBefore, , , ,) = core.getPersonalizedInsight(user1, 42);
        assertEq(recBefore, int8(1)); // Aye

        // Oracle updates: AI now says Nay (e.g., community raised red flags)
        vm.prank(oracleBackend);
        oracle.updateAnalysis(42, 80, 0, -1, 70, 50000 ether, 230, "QmV2");

        // Growth user + Nay base → personalization pushes to Abstain (conflicting signals)
        // alignment is high (~90) but base rec is Nay → conflict → Abstain
        // Actually per our logic: alignment >= 60 + baseRec < 0 → Abstain
        (int8 recAfter, , , ,) = core.getPersonalizedInsight(user1, 42);
        assertEq(recAfter, int8(0)); // Abstain due to conflicting signals
    }

    function test_RevertUpdateNonexistentAnalysis() public {
        vm.prank(oracleBackend);
        vm.expectRevert(AIOracle.AnalysisDoesNotExist.selector);
        oracle.updateAnalysis(999, 50, 0, 0, 50, 0, 0, "QmNope");
    }

    function test_RevertUpdateUnauthorized() public {
        _publishAnalysis(42);

        vm.prank(user1);
        vm.expectRevert(AIOracle.NotAuthorizedOracle.selector);
        oracle.updateAnalysis(42, 50, 0, 0, 50, 0, 0, "QmHack");
    }

    function test_MultipleUpdatesVersionIncrement() public {
        _publishAnalysis(42);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(oracleBackend);
            oracle.updateAnalysis(
                42,
                uint8(50 + i * 5),
                0,
                int8(i % 2 == 0 ? int256(1) : int256(-1)),
                uint8(60 + i * 5),
                50000 ether,
                230,
                string(abi.encodePacked("QmUpdate_", vm.toString(i)))
            );
        }

        assertEq(oracle.getAnalysisVersion(42), 6); // 1 initial + 5 updates
        assertEq(oracle.totalUpdates(), 5);
    }

    // ================================================================
    //                    GOVMIND CORE TESTS
    // ================================================================

    function test_ManualVote() public {
        vm.prank(user1);
        core.vote(42, true, 3, 100 ether);

        assertEq(core.totalVotesCast(), 1);
        assertTrue(core.hasVoted(user1, 42));

        GovMindCore.VoteRecord memory record = core.getVote(user1, 42);
        assertTrue(record.aye);
        assertEq(record.conviction, 3);
        assertEq(record.amount, 100 ether);
        assertFalse(record.isAIVote);
    }

    function test_RevertDoubleVote() public {
        vm.prank(user1);
        core.vote(42, true, 3, 100 ether);

        vm.prank(user1);
        vm.expectRevert(GovMindCore.AlreadyVoted.selector);
        core.vote(42, false, 1, 50 ether);
    }

    function test_RevertZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(GovMindCore.ZeroAmount.selector);
        core.vote(42, true, 3, 0);
    }

    function test_RevertInvalidConvictionOnVote() public {
        vm.prank(user1);
        vm.expectRevert(GovMindCore.InvalidConviction.selector);
        core.vote(42, true, 7, 100 ether);
    }

    function test_ReferendumStats() public {
        vm.prank(user1);
        core.vote(42, true, 3, 100 ether);

        vm.prank(user2);
        core.vote(42, false, 1, 50 ether);

        (uint256 totalAye, uint256 totalNay, uint256 voterCount, uint256 aiVoterCount) =
            core.getReferendumStats(42);

        assertEq(totalAye, 100 ether);
        assertEq(totalNay, 50 ether);
        assertEq(voterCount, 2);
        assertEq(aiVoterCount, 0);
    }

    function test_VoteHistory() public {
        vm.startPrank(user1);
        core.vote(1, true, 0, 10 ether);
        core.vote(2, false, 1, 20 ether);
        core.vote(3, true, 2, 30 ether);
        vm.stopPrank();

        uint256[] memory history = core.getUserVoteHistory(user1);
        assertEq(history.length, 3);
        assertEq(history[0], 1);
        assertEq(history[1], 2);
        assertEq(history[2], 3);
    }

    function test_PaginatedVoteHistory() public {
        vm.startPrank(user1);
        for (uint256 i = 0; i < 5; i++) {
            core.vote(i, true, 0, 10 ether);
        }
        vm.stopPrank();

        uint256[] memory page = core.getUserVoteHistoryPaginated(user1, 1, 3);
        assertEq(page.length, 3);
        assertEq(page[0], 1);
        assertEq(page[1], 2);
        assertEq(page[2], 3);
    }

    function test_ExecuteAIVote() public {
        // Setup: create identity, enable auto-vote, configure track, publish analysis
        _createIdentity(user1);

        vm.startPrank(user1);
        vault.toggleAutoVote(true);
        vault.configureTrackDelegation(0, true, 500 ether, 6);
        vm.stopPrank();

        _publishAnalysis(42);

        // Oracle executes AI vote
        vm.prank(oracleBackend);
        core.executeAIVote(
            user1,
            42,
            true,   // aye
            2,      // conviction
            100 ether,
            85,     // confidence
            "QmReasoning123"
        );

        assertTrue(core.hasVoted(user1, 42));
        assertEq(core.totalAIVotes(), 1);

        GovMindCore.VoteRecord memory record = core.getVote(user1, 42);
        assertTrue(record.isAIVote);
        assertEq(record.aiConfidence, 85);
    }

    function test_RevertAIVoteNoIdentity() public {
        _publishAnalysis(42);

        vm.prank(oracleBackend);
        vm.expectRevert(GovMindCore.NoIdentity.selector);
        core.executeAIVote(user1, 42, true, 2, 100 ether, 85, "QmTest");
    }

    function test_RevertAIVoteNotEnabled() public {
        _createIdentity(user1);
        // auto-vote is off by default
        _publishAnalysis(42);

        vm.prank(oracleBackend);
        vm.expectRevert(GovMindCore.AutoVoteNotEnabled.selector);
        core.executeAIVote(user1, 42, true, 2, 100 ether, 85, "QmTest");
    }

    function test_RevertAIVoteNoAnalysis() public {
        _createIdentity(user1);
        vm.prank(user1);
        vault.toggleAutoVote(true);

        vm.prank(oracleBackend);
        vm.expectRevert(GovMindCore.NoAnalysis.selector);
        core.executeAIVote(user1, 42, true, 2, 100 ether, 85, "QmTest");
    }

    function test_RevertAIVoteBelowConfidence() public {
        _createIdentity(user1);

        vm.startPrank(user1);
        vault.toggleAutoVote(true);
        vault.configureTrackDelegation(0, true, 500 ether, 6);
        vm.stopPrank();

        _publishAnalysis(42);

        // Confidence 50 is below user's threshold of 75
        vm.prank(oracleBackend);
        vm.expectRevert(GovMindCore.ConfidenceBelowThreshold.selector);
        core.executeAIVote(user1, 42, true, 2, 100 ether, 50, "QmTest");
    }

    function test_PersonalizedInsightNoIdentity() public {
        // User without identity gets raw AI analysis + neutral alignment
        _publishAnalysis(42);

        (int8 rec, uint8 confidence, uint8 riskScore, uint8 alignment,) =
            core.getPersonalizedInsight(user1, 42);

        assertEq(rec, int8(1));       // raw AI recommendation
        assertEq(confidence, 85);     // raw AI confidence
        assertEq(riskScore, 65);
        assertEq(alignment, 50);      // neutral
    }

    function test_PersonalizedInsightNoAnalysis() public {
        (int8 rec, uint8 confidence, uint8 riskScore, uint8 alignment,) =
            core.getPersonalizedInsight(user1, 99);

        assertEq(rec, int8(0));
        assertEq(confidence, 0);
        assertEq(riskScore, 0);
        assertEq(alignment, 50);
    }

    // ================================================================
    //            THE DEMO MOMENT: SAME PROPOSAL, DIFFERENT RECS
    // ================================================================

    function test_TwoUsersDifferentRecommendations() public {
        // Treasury spend proposal (categoryId=0) with Aye recommendation
        _publishAnalysis(42);

        // User A: Treasury-conservative (axis 0 = 90), low growth (axis 1 = 10)
        // Should oppose treasury spend → personalized rec = Nay
        {
            uint8[] memory axes = new uint8[](2);
            uint8[] memory weights = new uint8[](2);
            axes[0] = 0; weights[0] = 90; // TREASURY_CONSERVATIVE = 90
            axes[1] = 1; weights[1] = 10; // TREASURY_GROWTH = 10

            vm.prank(user1);
            vault.createIdentity(50, 75, 1000 ether, "", axes, weights);
        }

        // User B: Growth-focused (axis 1 = 90), low conservative (axis 0 = 10)
        // Should support treasury spend → personalized rec = Aye
        {
            uint8[] memory axes = new uint8[](2);
            uint8[] memory weights = new uint8[](2);
            axes[0] = 0; weights[0] = 10; // TREASURY_CONSERVATIVE = 10
            axes[1] = 1; weights[1] = 90; // TREASURY_GROWTH = 90

            vm.prank(user2);
            vault.createIdentity(80, 50, 5000 ether, "", axes, weights);
        }

        // Same proposal, different results
        (int8 recA, , , uint8 alignA,) = core.getPersonalizedInsight(user1, 42);
        (int8 recB, , , uint8 alignB,) = core.getPersonalizedInsight(user2, 42);

        // User A (conservative) should get Nay
        assertEq(recA, int8(-1));
        assertTrue(alignA <= 40);

        // User B (growth) should get Aye
        assertEq(recB, int8(1));
        assertTrue(alignB >= 60);

        // They MUST be different — this IS the value prop
        assertTrue(recA != recB, "Same proposal must produce different recs for different users");
    }

    function test_TechnicalUpgradePersonalization() public {
        // Technical upgrade proposal (categoryId=2)
        vm.prank(oracleBackend);
        oracle.publishAnalysis(99, 0, 40, 2, 1, 80, 0, 0, "QmTech");

        // User: technical progressive
        {
            uint8[] memory axes = new uint8[](2);
            uint8[] memory weights = new uint8[](2);
            axes[0] = 2; weights[0] = 95; // TECHNICAL_PROGRESSIVE
            axes[1] = 3; weights[1] = 5;  // TECHNICAL_CONSERVATIVE

            vm.prank(user1);
            vault.createIdentity(70, 50, 1000 ether, "", axes, weights);
        }

        (int8 rec, , , uint8 alignment,) = core.getPersonalizedInsight(user1, 99);

        assertEq(rec, int8(1));      // Aye — progressive user + AI Aye
        assertTrue(alignment >= 80); // Strong alignment
    }

    function test_RiskTolerancePenalty() public {
        // High-risk proposal (riskScore=90) with Aye recommendation
        vm.prank(oracleBackend);
        oracle.publishAnalysis(55, 0, 90, 0, 1, 85, 100000 ether, 500, "QmRisky");

        // Growth user BUT low risk tolerance (30)
        {
            uint8[] memory axes = new uint8[](2);
            uint8[] memory weights = new uint8[](2);
            axes[0] = 0; weights[0] = 20; // low conservative
            axes[1] = 1; weights[1] = 80; // high growth

            vm.prank(user1);
            vault.createIdentity(30, 50, 1000 ether, "", axes, weights);
        }

        (int8 rec, , , uint8 alignment,) = core.getPersonalizedInsight(user1, 55);

        // Despite being growth-oriented, risk penalty (90-30)/2 = 30 should drag alignment down
        // Base alignment would be 50 + (80-20)/2 = 80, minus 30 risk penalty = 50
        // Should land in neutral zone or below
        assertTrue(alignment <= 55, "Risk penalty should reduce alignment significantly");
    }

    function test_NeutralPreferencesKeepBaseRec() public {
        _publishAnalysis(42);

        // Perfectly balanced user — neutral on everything
        {
            uint8[] memory axes = new uint8[](2);
            uint8[] memory weights = new uint8[](2);
            axes[0] = 0; weights[0] = 50;
            axes[1] = 1; weights[1] = 50;

            vm.prank(user1);
            vault.createIdentity(70, 50, 1000 ether, "", axes, weights);
        }

        (int8 rec, , , uint8 alignment,) = core.getPersonalizedInsight(user1, 42);

        // Neutral alignment → keeps base recommendation
        assertEq(rec, int8(1));           // base AI rec was Aye
        assertTrue(alignment >= 41 && alignment <= 59, "Should be in neutral zone");
    }

    function test_AdminUpdateContracts() public {
        IdentityVault newVault = new IdentityVault();
        core.updateContracts(address(newVault), address(0));
        assertEq(address(core.identityVault()), address(newVault));
    }

    function test_ToggleXCMRelay() public {
        core.toggleXCMRelay(true);
        assertTrue(core.xcmRelayEnabled());
    }

    // ================================================================
    //                    FUZZ TESTS
    // ================================================================

    function testFuzz_CreateIdentityRiskTolerance(uint8 risk) public {
        uint8[] memory axes = new uint8[](0);
        uint8[] memory weights = new uint8[](0);

        vm.prank(user1);
        if (risk > 100) {
            vm.expectRevert(IdentityVault.InvalidRiskTolerance.selector);
        }
        vault.createIdentity(risk, 50, 1000 ether, "", axes, weights);
    }

    function testFuzz_VoteConviction(uint256 conviction) public {
        vm.prank(user1);
        if (conviction > 6) {
            vm.expectRevert(GovMindCore.InvalidConviction.selector);
        }
        core.vote(42, true, conviction, 100 ether);
    }

    function testFuzz_RequestFee(uint256 fee) public {
        vm.assume(fee < 100 ether);
        vm.deal(user1, 100 ether);
        vm.prank(user1);
        if (fee < 0.001 ether) {
            vm.expectRevert(AIOracle.InsufficientFee.selector);
        }
        oracle.requestAnalysis{value: fee}(42);
    }

    // ================================================================
    //                      HELPERS
    // ================================================================

    function _createIdentity(address user) internal {
        uint8[] memory axes = new uint8[](3);
        uint8[] memory weights = new uint8[](3);
        axes[0] = 0; weights[0] = 80;
        axes[1] = 2; weights[1] = 60;
        axes[2] = 4; weights[2] = 70;

        vm.prank(user);
        vault.createIdentity(50, 75, 1000 ether, "QmPreferences", axes, weights);
    }

    function _publishAnalysis(uint256 referendumIndex) internal {
        vm.prank(oracleBackend);
        oracle.publishAnalysis(
            referendumIndex,
            0,      // track
            65,     // riskScore
            0,      // categoryId
            1,      // recommendation (Aye)
            85,     // confidence
            50000 ether,
            230,    // treasuryImpactBps
            "QmAnalysisHash"
        );
    }
}
