// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/CollectiveRegistry.sol";

contract DeployCollectives is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Read IdentityVault address from env
        address identityVault = vm.envAddress("IDENTITY_VAULT_ADDRESS");

        console.log("Deploying CollectiveRegistry with account:", deployer);
        console.log("IdentityVault:", identityVault);

        vm.startBroadcast(deployerPrivateKey);

        CollectiveRegistry registry = new CollectiveRegistry(identityVault);
        console.log("CollectiveRegistry deployed to:", address(registry));

        // Seed: Sustainability Guardians
        registry.createCollective(
            1,
            "Sustainability Guardians",
            "Protect the treasury, fund proven teams, minimize risk",
            [uint8(70), 40, 40, 70, 80, 60],
            35
        );

        // Seed: Innovation Accelerators
        registry.createCollective(
            2,
            "Innovation Accelerators",
            "Fund bold experiments, embrace technical change, grow fast",
            [uint8(20), 90, 90, 10, 50, 80],
            75
        );

        // Seed: Security Maximalists
        registry.createCollective(
            3,
            "Security Maximalists",
            "Stability above all, rigorous review, conservative upgrades",
            [uint8(60), 30, 30, 95, 30, 70],
            20
        );

        // Seed: Treasury Efficiency
        registry.createCollective(
            4,
            "Treasury Efficiency",
            "Every DOT must have measurable ROI, cut waste ruthlessly",
            [uint8(95), 10, 50, 60, 40, 50],
            30
        );

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("  CollectiveRegistry v2 Deployed!");
        console.log("  Dynamic profiles + IdentityVault linked");
        console.log("  4 collectives seeded on-chain");
        console.log("  Seed weight: 30%% (70%% member influence)");
        console.log("  Address:", address(registry));
        console.log("========================================");
    }
}
