// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/ScaleCodec.sol";
import "../src/XCMGovernanceRelay.sol";

/// @title XCMRelayTest - Tests for SCALE encoding, XCM message construction, and vote relay
/// @dev Tests verify byte-level correctness of SCALE encoding and XCM message structure.
///      XCM precompile calls are tested via mock since the precompile isn't available in forge.
contract XCMRelayTest is Test {
    XCMGovernanceRelay public relay;

    address public owner;
    address public govMindCore;
    address public voter1;

    function setUp() public {
        owner = address(this);
        govMindCore = makeAddr("govMindCore");
        voter1 = makeAddr("voter1");

        relay = new XCMGovernanceRelay();
        relay.authorizeCaller(govMindCore);
    }

    // ================================================================
    //                    SCALE CODEC TESTS
    // ================================================================

    function test_CompactU32_SingleByte() public pure {
        // Values 0-63 → single byte, val << 2
        bytes memory result = ScaleCodec.encodeCompactU32(0);
        assertEq(result.length, 1);
        assertEq(uint8(result[0]), 0x00); // 0 << 2

        result = ScaleCodec.encodeCompactU32(1);
        assertEq(uint8(result[0]), 0x04); // 1 << 2

        result = ScaleCodec.encodeCompactU32(42);
        assertEq(uint8(result[0]), 0xA8); // 42 << 2 = 168

        result = ScaleCodec.encodeCompactU32(63);
        assertEq(uint8(result[0]), 0xFC); // 63 << 2 = 252
    }

    function test_CompactU32_TwoByte() public pure {
        // Values 64-16383 → two bytes, (val << 2) | 0x01, LE
        bytes memory result = ScaleCodec.encodeCompactU32(64);
        assertEq(result.length, 2);
        // (64 << 2) | 1 = 257 = 0x0101, LE: 0x01 0x01
        assertEq(uint8(result[0]), 0x01);
        assertEq(uint8(result[1]), 0x01);

        // Referendum index 1836
        result = ScaleCodec.encodeCompactU32(1836);
        assertEq(result.length, 2);
        // (1836 << 2) | 1 = 7345 = 0x1CB1, LE: 0xB1 0x1C
        assertEq(uint8(result[0]), 0xB1);
        assertEq(uint8(result[1]), 0x1C);
    }

    function test_CompactU32_FourByte() public pure {
        // Values 16384+ → four bytes, (val << 2) | 0x02, LE
        bytes memory result = ScaleCodec.encodeCompactU32(16384);
        assertEq(result.length, 4);
        // (16384 << 2) | 2 = 65538 = 0x00010002, LE: 0x02 0x00 0x01 0x00
        assertEq(uint8(result[0]), 0x02);
        assertEq(uint8(result[1]), 0x00);
        assertEq(uint8(result[2]), 0x01);
        assertEq(uint8(result[3]), 0x00);
    }

    function test_U128LE_Encoding() public pure {
        // 10 DOT = 100_000_000_000 plancks (10 * 10^10)
        uint128 tenDOT = 100_000_000_000;
        bytes memory result = ScaleCodec.encodeU128LE(tenDOT);
        assertEq(result.length, 16);

        // 100_000_000_000 = 0x174876E800
        // LE: 0x00 0xE8 0x76 0x48 0x17 0x00 ... 0x00
        assertEq(uint8(result[0]), 0x00);
        assertEq(uint8(result[1]), 0xE8);
        assertEq(uint8(result[2]), 0x76);
        assertEq(uint8(result[3]), 0x48);
        assertEq(uint8(result[4]), 0x17);
        // Remaining bytes should be zero
        for (uint8 i = 5; i < 16; i++) {
            assertEq(uint8(result[i]), 0x00);
        }
    }

    function test_U128LE_Zero() public pure {
        bytes memory result = ScaleCodec.encodeU128LE(0);
        assertEq(result.length, 16);
        for (uint8 i = 0; i < 16; i++) {
            assertEq(uint8(result[i]), 0x00);
        }
    }

    function test_VecU8_Encoding() public pure {
        bytes memory data = hex"1400";
        bytes memory result = ScaleCodec.encodeVecU8(data);
        // Length 2 → compact(2) = 0x08, then the data
        assertEq(uint8(result[0]), 0x08); // compact(2)
        assertEq(uint8(result[1]), 0x14);
        assertEq(uint8(result[2]), 0x00);
    }

    // ================================================================
    //         CONVICTION VOTE ENCODING TESTS
    // ================================================================

    function test_EncodeConvictionVote_AyeConviction1() public view {
        // Aye vote, conviction 1, 10 DOT, referendum #1836
        bytes memory encoded = relay.previewEncodedCall(
            1836,    // referendum index
            true,    // aye
            1,       // conviction 1x
            100_000_000_000 // 10 DOT in plancks
        );

        // Expected structure:
        // [0x14]        pallet index 20
        // [0x00]        call index 0 (vote)
        // [0xB1 0x1C]   compact(1836) = (1836<<2)|1 = 7345 LE
        // [0x00]        AccountVote::Standard
        // [0x81]        Vote byte: 0x80 (aye) | 0x01 (conviction 1)
        // [16 bytes]    balance u128 LE

        assertEq(uint8(encoded[0]), 0x14, "pallet index should be 20");
        assertEq(uint8(encoded[1]), 0x00, "call index should be 0");
        // compact(1836) = 2 bytes
        assertEq(uint8(encoded[2]), 0xB1, "compact poll_index byte 0");
        assertEq(uint8(encoded[3]), 0x1C, "compact poll_index byte 1");
        // AccountVote::Standard
        assertEq(uint8(encoded[4]), 0x00, "AccountVote::Standard variant");
        // Vote byte: aye(0x80) | conviction(1) = 0x81
        assertEq(uint8(encoded[5]), 0x81, "vote byte: aye + conviction 1");
    }

    function test_EncodeConvictionVote_NayConviction3() public view {
        bytes memory encoded = relay.previewEncodedCall(
            42,       // small referendum index
            false,    // nay
            3,        // conviction 3x
            50_000_000_000 // 5 DOT
        );

        // compact(42) = single byte: 42 << 2 = 168 = 0xA8
        assertEq(uint8(encoded[0]), 0x14, "pallet index");
        assertEq(uint8(encoded[1]), 0x00, "call index");
        assertEq(uint8(encoded[2]), 0xA8, "compact(42)");
        // AccountVote::Standard
        assertEq(uint8(encoded[3]), 0x00, "Standard variant");
        // Vote byte: nay(0x00) | conviction(3) = 0x03
        assertEq(uint8(encoded[4]), 0x03, "vote byte: nay + conviction 3");
    }

    function test_EncodeConvictionVote_NoConviction() public view {
        bytes memory encoded = relay.previewEncodedCall(1, true, 0, 10_000_000_000);

        // compact(1) = 0x04
        assertEq(uint8(encoded[2]), 0x04, "compact(1)");
        // Vote byte: aye(0x80) | conviction(0) = 0x80
        assertEq(uint8(encoded[4]), 0x80, "vote byte: aye + no conviction");
    }

    function test_EncodeConvictionVote_MaxConviction() public view {
        bytes memory encoded = relay.previewEncodedCall(1, true, 6, 10_000_000_000);

        // Vote byte: aye(0x80) | conviction(6) = 0x86
        assertEq(uint8(encoded[4]), 0x86, "vote byte: aye + conviction 6");
    }

    // ================================================================
    //              XCM MESSAGE CONSTRUCTION TESTS
    // ================================================================

    function test_RelayChainDestination() public view {
        bytes memory dest = relay.previewDestination();
        // VersionedLocation::V5(Location { parents: 1, interior: Here })
        assertEq(uint8(dest[0]), 0x05, "V5 version prefix");
        assertEq(uint8(dest[1]), 0x01, "parents: 1 (relay chain)");
        assertEq(uint8(dest[2]), 0x00, "interior: Here");
        assertEq(dest.length, 3);
    }

    function test_XcmMessageStructure() public view {
        bytes memory msg_ = relay.previewXcmMessage(1836, true, 1, 100_000_000_000);

        // First byte: V5 prefix
        assertEq(uint8(msg_[0]), 0x05, "XCM V5 prefix");
        // Second byte: compact(5) = 5 instructions = 0x14
        assertEq(uint8(msg_[1]), 0x14, "5 instructions compact");
        // Third byte: WithdrawAsset instruction discriminant
        assertEq(uint8(msg_[2]), 0x00, "WithdrawAsset discriminant");

        // Verify message is non-trivial (has real content)
        assertTrue(msg_.length > 30, "XCM message should have substantial content");
    }

    function test_XcmMessageContainsBuyExecution() public view {
        bytes memory msg_ = relay.previewXcmMessage(1836, true, 1, 100_000_000_000);

        // Search for BuyExecution discriminant (19 = 0x13)
        bool foundBuy = false;
        for (uint256 i = 2; i < msg_.length; i++) {
            if (uint8(msg_[i]) == 0x13) {
                foundBuy = true;
                break;
            }
        }
        assertTrue(foundBuy, "XCM message should contain BuyExecution instruction");
    }

    function test_XcmMessageContainsTransact() public view {
        bytes memory msg_ = relay.previewXcmMessage(1836, true, 1, 100_000_000_000);

        // Search for Transact discriminant (6 = 0x06 in V5) followed by SovereignAccount origin (1)
        bool foundTransact = false;
        for (uint256 i = 2; i < msg_.length - 1; i++) {
            if (uint8(msg_[i]) == 0x06 && uint8(msg_[i + 1]) == 0x01) {
                foundTransact = true;
                break;
            }
        }
        assertTrue(foundTransact, "XCM message should contain Transact instruction");
    }

    function test_XcmMessageContainsRefundAndDeposit() public view {
        bytes memory msg_ = relay.previewXcmMessage(1836, true, 1, 100_000_000_000);

        // Search for RefundSurplus (20 = 0x14 in V5) followed by DepositAsset (13 = 0x0D)
        bool foundRefund = false;
        for (uint256 i = 2; i < msg_.length - 1; i++) {
            if (uint8(msg_[i]) == 0x14 && uint8(msg_[i + 1]) == 0x0D) {
                foundRefund = true;
                break;
            }
        }
        assertTrue(foundRefund, "XCM message should contain RefundSurplus + DepositAsset");
    }

    // ================================================================
    //              RELAY VOTE EXECUTION TESTS
    // ================================================================

    function test_RevertRelayDisabled() public {
        relay.setRelayEnabled(false);

        vm.prank(govMindCore);
        vm.expectRevert(XCMGovernanceRelay.RelayDisabled.selector);
        relay.relayVote(voter1, 1836, true, 1, 100_000_000_000);
    }

    function test_RevertNotAuthorized() public {
        vm.prank(voter1); // Not authorized
        vm.expectRevert(XCMGovernanceRelay.NotAuthorized.selector);
        relay.relayVote(voter1, 1836, true, 1, 100_000_000_000);
    }

    function test_RevertInvalidConviction() public {
        vm.prank(govMindCore);
        vm.expectRevert(XCMGovernanceRelay.InvalidConviction.selector);
        relay.relayVote(voter1, 1836, true, 7, 100_000_000_000);
    }

    function test_RevertZeroAmount() public {
        vm.prank(govMindCore);
        vm.expectRevert(XCMGovernanceRelay.ZeroAmount.selector);
        relay.relayVote(voter1, 1836, true, 1, 0);
    }

    function test_AuthorizeCaller() public {
        address newCaller = makeAddr("newCaller");
        relay.authorizeCaller(newCaller);
        assertTrue(relay.authorizedCallers(newCaller));
    }

    function test_RevokeCaller() public {
        relay.revokeCaller(govMindCore);
        assertFalse(relay.authorizedCallers(govMindCore));
    }

    function test_UpdateWeight() public {
        relay.updateWeight(1_000_000_000, 50_000);
        assertEq(relay.transactRefTime(), 1_000_000_000);
        assertEq(relay.transactProofSize(), 50_000);
    }

    function test_UpdateFee() public {
        relay.updateFee(5_000_000_000);
        assertEq(relay.xcmFeeAmount(), 5_000_000_000);
    }

    function test_OwnerCanRelay() public {
        // Owner should be able to relay without being in authorizedCallers
        // Mock the XCM precompile call since it won't exist in forge test
        vm.mockCall(
            address(0x0A0000),
            abi.encodeWithSelector(IXcm.send.selector),
            ""
        );

        relay.relayVote(voter1, 1836, true, 1, 100_000_000_000);
        assertEq(relay.totalRelayedVotes(), 1);
    }

    function test_RelayRecordsVote() public {
        vm.mockCall(
            address(0x0A0000),
            abi.encodeWithSelector(IXcm.send.selector),
            ""
        );

        vm.prank(govMindCore);
        relay.relayVote(voter1, 1836, true, 1, 100_000_000_000);

        XCMGovernanceRelay.RelayedVote[] memory votes = relay.getRelayedVotes(1836);
        assertEq(votes.length, 1);
        assertEq(votes[0].voter, voter1);
        assertEq(votes[0].referendumIndex, 1836);
        assertTrue(votes[0].aye);
        assertEq(votes[0].conviction, 1);
        assertEq(votes[0].amount, 100_000_000_000);
    }

    function test_RelayEmitsEvent() public {
        vm.mockCall(
            address(0x0A0000),
            abi.encodeWithSelector(IXcm.send.selector),
            ""
        );

        vm.prank(govMindCore);
        vm.expectEmit(true, true, false, false);
        emit XCMGovernanceRelay.VoteRelayed(
            voter1, 1836, true, 1, 100_000_000_000, ""
        );
        relay.relayVote(voter1, 1836, true, 1, 100_000_000_000);
    }

    function test_MultipleRelays() public {
        vm.mockCall(
            address(0x0A0000),
            abi.encodeWithSelector(IXcm.send.selector),
            ""
        );

        vm.startPrank(govMindCore);
        relay.relayVote(voter1, 1836, true, 1, 100_000_000_000);
        relay.relayVote(makeAddr("voter2"), 1836, false, 2, 50_000_000_000);
        relay.relayVote(voter1, 1831, true, 3, 200_000_000_000);
        vm.stopPrank();

        assertEq(relay.totalRelayedVotes(), 3);

        XCMGovernanceRelay.RelayedVote[] memory votes1836 = relay.getRelayedVotes(1836);
        assertEq(votes1836.length, 2);

        XCMGovernanceRelay.RelayedVote[] memory votes1831 = relay.getRelayedVotes(1831);
        assertEq(votes1831.length, 1);
    }

    function test_U64LE_Encoding() public pure {
        // 500_000_000 = 0x1DCD6500
        uint64 val = 500_000_000;
        bytes memory result = ScaleCodec.encodeU64LE(val);
        assertEq(result.length, 8, "u64 LE must be exactly 8 bytes");
        // LE: 0x00 0x65 0xCD 0x1D 0x00 0x00 0x00 0x00
        assertEq(uint8(result[0]), 0x00);
        assertEq(uint8(result[1]), 0x65);
        assertEq(uint8(result[2]), 0xCD);
        assertEq(uint8(result[3]), 0x1D);
        assertEq(uint8(result[4]), 0x00);
        assertEq(uint8(result[5]), 0x00);
        assertEq(uint8(result[6]), 0x00);
        assertEq(uint8(result[7]), 0x00);
    }

    function test_TransactWeightIsCompact() public view {
        // The XCM V5 Transact weight uses compact encoding.
        // With transactRefTime = 500_000_000 and transactProofSize = 20_000:
        // compact(500_000_000) = 4-byte mode: (500M << 2) | 2 = 0xEE6B2802, LE: 02 28 6B EE
        // compact(20_000) = 4-byte mode: (20000 << 2) | 2 = 0x13882, LE: 82 38 01 00
        bytes memory msg_ = relay.previewXcmMessage(1, true, 1, 10_000_000_000);

        // Find Transact: 0x06 followed by 0x01 (SovereignAccount)
        for (uint256 i = 2; i < msg_.length - 10; i++) {
            if (uint8(msg_[i]) == 0x06 && uint8(msg_[i + 1]) == 0x01) {
                // i+2 should be Option::Some = 0x01
                assertEq(uint8(msg_[i + 2]), 0x01, "Option::Some byte");
                // i+3..i+6: compact refTime (500M) = 02 28 6B EE
                assertEq(uint8(msg_[i + 3]), 0x02, "compact refTime byte 0");
                assertEq(uint8(msg_[i + 4]), 0x28, "compact refTime byte 1");
                assertEq(uint8(msg_[i + 5]), 0x6B, "compact refTime byte 2");
                assertEq(uint8(msg_[i + 6]), 0xEE, "compact refTime byte 3");
                // i+7..i+10: compact proofSize (20K) = 82 38 01 00
                assertEq(uint8(msg_[i + 7]), 0x82, "compact proofSize byte 0");
                assertEq(uint8(msg_[i + 8]), 0x38, "compact proofSize byte 1");
                assertEq(uint8(msg_[i + 9]), 0x01, "compact proofSize byte 2");
                assertEq(uint8(msg_[i + 10]), 0x00, "compact proofSize byte 3");
                return;
            }
        }
        revert("Transact instruction not found in XCM message");
    }

    // ================================================================
    //                    FUZZ TESTS
    // ================================================================

    function testFuzz_CompactU32(uint32 value) public pure {
        bytes memory result = ScaleCodec.encodeCompactU32(value);

        if (value <= 63) {
            assertEq(result.length, 1);
        } else if (value <= 16383) {
            assertEq(result.length, 2);
        } else {
            assertEq(result.length, 4);
        }
    }

    function testFuzz_U128LE_AlwaysSixteenBytes(uint128 value) public pure {
        bytes memory result = ScaleCodec.encodeU128LE(value);
        assertEq(result.length, 16);
    }

    function testFuzz_ConvictionVoteEncoding(
        uint32 refIndex,
        bool aye,
        uint8 conviction
    ) public view {
        conviction = uint8(bound(conviction, 0, 6));

        bytes memory encoded = relay.previewEncodedCall(
            refIndex, aye, conviction, 10_000_000_000
        );

        // First two bytes always pallet + call index
        assertEq(uint8(encoded[0]), 0x14, "pallet index");
        assertEq(uint8(encoded[1]), 0x00, "call index");

        // Encoded should be at least 20 bytes (2 + compact + 1 + 1 + 16)
        assertTrue(encoded.length >= 20, "minimum encoded length");
    }

    function testFuzz_XcmMessageLength(uint32 refIndex, bool aye) public view {
        bytes memory msg_ = relay.previewXcmMessage(refIndex, aye, 1, 10_000_000_000);
        // XCM message should always be substantial
        assertTrue(msg_.length > 30, "XCM message should be at least 30 bytes");
        // First byte is always V5 prefix
        assertEq(uint8(msg_[0]), 0x05, "V5 prefix");
    }
}
