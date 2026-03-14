// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/IdentityVault.sol";
import "../src/AIOracle.sol";
import "../src/GovMindCore.sol";
import "../src/XCMGovernanceRelay.sol";

contract DeployGovMind is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        uint256 requestFee = 0.001 ether;

        console.log("Deploying GovMind contracts with account:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy IdentityVault
        IdentityVault identityVault = new IdentityVault();
        console.log("IdentityVault deployed to:", address(identityVault));

        // 2. Deploy AIOracle (deployer is initial oracle)
        AIOracle aiOracle = new AIOracle(deployer, requestFee);
        console.log("AIOracle deployed to:", address(aiOracle));

        // 3. Deploy GovMindCore
        GovMindCore govMindCore = new GovMindCore(
            address(identityVault),
            address(aiOracle)
        );
        console.log("GovMindCore deployed to:", address(govMindCore));

        // 4. Deploy XCMGovernanceRelay
        XCMGovernanceRelay xcmRelay = new XCMGovernanceRelay();
        console.log("XCMGovernanceRelay deployed to:", address(xcmRelay));

        // 5. Wire up: Authorize GovMindCore to call XCM relay
        xcmRelay.authorizeCaller(address(govMindCore));
        console.log("GovMindCore authorized as XCM relay caller");

        // 6. Wire up: Set XCM relay on GovMindCore
        govMindCore.setXCMRelay(address(xcmRelay));
        console.log("XCM relay set on GovMindCore");

        // 7. Wire PVM contracts
        address scaleCodecPVM = 0x9c0E4B07f26726d6646C8465cfA39f9662550cDb;
        address alignmentScorerPVM = 0x60B9D9D2097963ADf51Cf6c1E1b80309c2959238;

        xcmRelay.setPVMCodec(scaleCodecPVM, true);
        console.log("PVM ScaleCodec wired to XCMRelay");

        govMindCore.setPVMScorer(alignmentScorerPVM, true);
        console.log("PVM AlignmentScorer wired to GovMindCore");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("  GovMind v3 Deployment Complete!");
        console.log("  Cross-VM Pipeline Fully Wired!");
        console.log("========================================");
        console.log("  IdentityVault:       ", address(identityVault));
        console.log("  AIOracle:            ", address(aiOracle));
        console.log("  GovMindCore:         ", address(govMindCore));
        console.log("  XCMGovernanceRelay:  ", address(xcmRelay));
        console.log("  ScaleCodecPVM:       ", scaleCodecPVM);
        console.log("  AlignmentScorerPVM:  ", alignmentScorerPVM);
        console.log("========================================");
    }
}
