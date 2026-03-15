// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/IdentityVault.sol";
import "../src/AIOracle.sol";
import "../src/GovMindCore.sol";
import "../src/XCMGovernanceRelay.sol";
import "../src/CollectiveRegistry.sol";

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

        // 8. Deploy CollectiveRegistry and seed collectives
        CollectiveRegistry collectiveRegistry = new CollectiveRegistry();
        console.log("CollectiveRegistry deployed to:", address(collectiveRegistry));

        // Seed: Sustainability Guardians
        collectiveRegistry.createCollective(
            1,
            "Sustainability Guardians",
            "Protect the treasury, fund proven teams, minimize risk",
            [uint8(70), 40, 40, 70, 80, 60],
            35
        );

        // Seed: Innovation Accelerators
        collectiveRegistry.createCollective(
            2,
            "Innovation Accelerators",
            "Fund bold experiments, embrace technical change, grow fast",
            [uint8(20), 90, 90, 10, 50, 80],
            75
        );

        // Seed: Security Maximalists
        collectiveRegistry.createCollective(
            3,
            "Security Maximalists",
            "Stability above all, rigorous review, conservative upgrades",
            [uint8(60), 30, 30, 95, 30, 70],
            20
        );

        // Seed: Treasury Efficiency
        collectiveRegistry.createCollective(
            4,
            "Treasury Efficiency",
            "Every DOT must have measurable ROI, cut waste ruthlessly",
            [uint8(95), 10, 50, 60, 40, 50],
            30
        );
        console.log("4 collectives seeded on-chain");

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
        console.log("  CollectiveRegistry:  ", address(collectiveRegistry));
        console.log("========================================");
    }
}
