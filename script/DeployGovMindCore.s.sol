// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/GovMindCore.sol";

contract DeployGovMindCore is Script {
    function run() external {
        vm.startBroadcast();
        GovMindCore core = new GovMindCore(
            0xCC6d8B7896E451cD3c3a34adA0dE55885519aDA1, // IdentityVault
            0xB9364a7Be7be4598BBb4edb812aFbe25a85ebB2A  // AIOracle
        );
        // Wire XCM relay
        core.setXCMRelay(payable(0x83d49Ec8d914cBf43b22e253b03abDe151931aec));
        // Wire PVM scorer
        core.setPVMScorer(0x12AdbaAbE8409fF2f7B8f12e680a6E5698a7D2eE, true);
        // Authorize new core on the relay
        XCMGovernanceRelay(payable(0x83d49Ec8d914cBf43b22e253b03abDe151931aec)).authorizeCaller(address(core));
        vm.stopBroadcast();
        console.log("New GovMindCore:", address(core));
    }
}
