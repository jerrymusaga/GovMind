// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/GovMindCore.sol";
import "../src/XCMGovernanceRelay.sol";

/// @notice Wire PVM contracts to EVM contracts after deployment.
///         Run: forge script script/WirePVM.s.sol --rpc-url $RPC_URL --broadcast
contract WirePVM is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address govMindCore = 0x9738ceE50C7ce9E45d32a27D43886D61EF7D3f6a;
        address xcmRelay = 0xFf63bF7E3e0eB21BFB552B6e32de08a98Ad01faF;
        address scaleCodecPVM = 0x9c0E4B07f26726d6646C8465cfA39f9662550cDb;
        address alignmentScorerPVM = 0x60B9D9D2097963ADf51Cf6c1E1b80309c2959238;

        console.log("Wiring PVM contracts...");

        vm.startBroadcast(deployerPrivateKey);

        // Wire ScaleCodecPVM to XCMGovernanceRelay
        XCMGovernanceRelay(xcmRelay).setPVMCodec(scaleCodecPVM, true);
        console.log("ScaleCodecPVM wired to XCMRelay");

        // Wire AlignmentScorerPVM to GovMindCore
        GovMindCore(govMindCore).setPVMScorer(alignmentScorerPVM, true);
        console.log("AlignmentScorerPVM wired to GovMindCore");

        vm.stopBroadcast();

        console.log("\nPVM wiring complete! Both modules now active.");
    }
}
