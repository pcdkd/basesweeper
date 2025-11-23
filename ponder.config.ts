import { createConfig } from "ponder";
import { http } from "viem";
import { BASESWEEPER_ABI, BASESWEEPER_ADDRESS } from "./contracts/abi";

export default createConfig({
  networks: {
    baseSepolia: {
      chainId: 84532,
      transport: http(process.env.PONDER_RPC_URL_84532),
    },
  },
  contracts: {
    Basesweeper: {
      network: "baseSepolia",
      abi: BASESWEEPER_ABI,
      address: BASESWEEPER_ADDRESS,
      startBlock: 34005195, // Deployment block
    },
  },
});
