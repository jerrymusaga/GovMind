// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/XCMGovernanceRelay.sol";
import "../src/GovMindCore.sol";

contract RedeployXCMRelay is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address govMindCore = vm.envAddress("GOVMIND_CORE_ADDRESS");

        // PVM addresses (current deployed)
        address scaleCodecPVM = 0x6a2a740b76261e40aDc0114047d64081534414B3;

        console.log("Redeploying XCMGovernanceRelay with receive() function");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new XCM relay (now has receive() for DOT deposits)
        XCMGovernanceRelay xcmRelay = new XCMGovernanceRelay();
        console.log("New XCMGovernanceRelay:", address(xcmRelay));

        // 2. Authorize GovMindCore to call the relay
        xcmRelay.authorizeCaller(govMindCore);
        console.log("GovMindCore authorized as caller");

        // 3. Wire PVM codec
        xcmRelay.setPVMCodec(scaleCodecPVM, true);
        console.log("PVM ScaleCodec wired");

        // 4. Update GovMindCore to point to new relay
        GovMindCore(govMindCore).setXCMRelay(address(xcmRelay));
        console.log("GovMindCore updated to new XCM relay");

        // 5. Fund the relay with 10 DOT for XCM fees
        payable(address(xcmRelay)).transfer(10 ether);
        console.log("Funded relay with 10 DOT");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("  XCM Relay Redeployed & Funded");
        console.log("  Address:", address(xcmRelay));
        console.log("========================================");
    }
}
