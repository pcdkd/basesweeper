// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Basesweeper} from "../src/Basesweeper.sol";

contract Deploy is Script {
    function run() external {
        // Retrieve the private key from the 'deployer' account (handled by --account flag)
        // Start broadcasting transactions
        vm.startBroadcast();

        // Deploy Basesweeper with a seed (e.g., 12345)
        // In production, you might want to generate this or pass it in differently
        uint256 seed = 12345;
        new Basesweeper(seed);

        vm.stopBroadcast();
    }
}
