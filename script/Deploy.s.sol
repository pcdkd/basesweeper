// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Basesweeper} from "../src/Basesweeper.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        Basesweeper basesweeper = new Basesweeper();

        vm.stopBroadcast();

        console.log("=========================================");
        console.log("Basesweeper deployed to:", address(basesweeper));
        console.log("=========================================");
        console.log("");
        console.log("Game Configuration:");
        console.log("- Fee per click:", basesweeper.FEE());
        console.log("- Block delay:", basesweeper.BLOCK_DELAY());
        console.log("- Reveal reward:", basesweeper.REVEAL_REWARD());
        console.log("=========================================");
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Update contract address in contracts/abi.ts");
        console.log("2. Run 'forge build' to generate ABI");
        console.log("3. Copy ABI from out/Basesweeper.sol/Basesweeper.json");
        console.log("4. Update frontend to handle revealOutcome() calls");
        console.log("=========================================");
    }
}
