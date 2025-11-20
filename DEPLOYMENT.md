# Basesweeper Deployment Guide

This guide walks you through deploying Basesweeper on Base Sepolia testnet.

## Prerequisites

- Foundry installed
- MetaMask with Base Sepolia network configured
- Base Sepolia testnet ETH (get from [faucets.chain.link/base-sepolia](https://faucets.chain.link/base-sepolia))

## Step 1: Configure Environment

Load environment variables:

```bash
source env_foundry
```

The `env_foundry` file contains:
- `BASE_RPC_URL` - Base mainnet RPC
- `BASE_SEPOLIA_RPC_URL` - Base Sepolia testnet RPC

## Step 2: Deploy Contract

Deploy to Base Sepolia:

```bash
forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --account YOUR_ACCOUNT_NAME \
  --broadcast
```

The deployment script will output:
- Contract address
- Game configuration (fee, block delay, reveal reward)
- Next steps

**Save the deployed contract address!**

## Step 3: Update Frontend

1. **Update Contract Address**
   - Open `contracts/abi.ts`
   - Update `BASESWEEPER_ADDRESS` with your deployed contract address

2. **Update ABI**
   - Run `forge build` to ensure latest ABI is generated
   - Open `out/Basesweeper.sol/Basesweeper.json`
   - Copy the `abi` array
   - Paste into `contracts/abi.ts` as `BASESWEEPER_ABI`

3. **Update Frontend Logic** (if needed)
   - Ensure `useBasesweeper` hook supports new functions:
     - `revealOutcome(requestId)`
     - `getPendingClick(requestId)`
     - `canReveal(requestId)`
   - Add event listeners for `ClickPending`
   - Implement automatic reveal trigger when target block is reached

## Step 4: Test the Game

### Using Cast (CLI)

```bash
# Set contract address
CONTRACT=0xYOUR_CONTRACT_ADDRESS

# Check current game state
cast call $CONTRACT "gameId()(uint256)" --rpc-url $BASE_SEPOLIA_RPC_URL

# Get game state
cast call $CONTRACT "getGameState(uint256)(uint256,address,bool,uint256)" 1 --rpc-url $BASE_SEPOLIA_RPC_URL

# Click a tile (requires account with Base Sepolia ETH)
cast send $CONTRACT \
  "click(uint256)" \
  42 \
  --value 0.0008ether \
  --account YOUR_ACCOUNT \
  --rpc-url $BASE_SEPOLIA_RPC_URL

# Wait ~36 seconds (3 blocks), then get the request ID from the ClickPending event

# Check if ready to reveal
cast call $CONTRACT "canReveal(uint256)(bool)" REQUEST_ID --rpc-url $BASE_SEPOLIA_RPC_URL

# Reveal the outcome (anyone can call this)
cast send $CONTRACT \
  "revealOutcome(uint256)" \
  REQUEST_ID \
  --account YOUR_ACCOUNT \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

### What Happens When You Click

1. **Transaction Sent**: You pay 0.0008 ETH
2. **Pending Created**: Contract creates a pending click with target block (current + 3)
3. **ClickPending Event**: Emitted with requestId and targetBlock
4. **Wait Period**: ~36 seconds (3 blocks on Base)
5. **Reveal**: Anyone calls `revealOutcome(requestId)`
6. **Blockhash Read**: Contract reads blockhash of target block
7. **Result**:
   - If you win: GameWon event + entire pool sent to you
   - If you lose: TileClicked event + tile marked as clicked
8. **Revealer Reward**: Whoever called `revealOutcome()` gets 0.00001 ETH

### Expected Costs

**Per Click (Player):**
- Game fee: 0.0008 ETH (goes to pool)
- Gas: ~50,000-100,000 gas (~$0.01-0.05 depending on gas prices)

**Per Reveal (Anyone):**
- Gas: ~100,000-150,000 gas (~$0.02-0.07 depending on gas prices)
- Reward: 0.00001 ETH (small incentive to cover gas)

## Troubleshooting

### "Insufficient fee" Error
- Make sure you're sending at least 0.0008 ETH with the click transaction

### "Tile already clicked" Error
- That tile has already been revealed in this game
- Choose a different tile

### "Too early to reveal" Error
- The target block hasn't been reached yet
- Wait for at least 3 blocks after the click transaction

### "Blockhash expired" Error
- More than 256 blocks have passed since the target block
- The blockhash is no longer available
- This click cannot be revealed (fee is lost to pool)

### "Game not active" Error
- Someone already won the current game
- A new game should have started automatically
- Check `gameId()` to see current game

## Verification

Verify your contract on BaseScan:

```bash
forge verify-contract \
  YOUR_CONTRACT_ADDRESS \
  src/Basesweeper.sol:Basesweeper \
  --chain base-sepolia
```

## Security Considerations

### Randomness Source
- Uses **blockhash** for randomness (not Chainlink VRF)
- **Pro**: Zero external costs, simple implementation
- **Con**: Theoretically vulnerable to validator manipulation
- **Reality**: Economically impractical for validators to manipulate for small stakes
- **Acceptable for**: Games with modest pools (<1 ETH)

### Attack Vectors
1. **Validator Manipulation**: Validators could theoretically manipulate blockhash
   - **Mitigation**: Economically impractical for small stakes
   - **Recommendation**: If pools grow >1 ETH, consider upgrading to Chainlink VRF

2. **Reveal Griefing**: Players could refuse to reveal losing clicks
   - **Mitigation**: Anyone can call reveal, small reward incentivizes participation
   - **Reality**: Frontend auto-reveals, community can reveal for reward

3. **256 Block Expiry**: Clicks become unrevealable after 256 blocks
   - **Mitigation**: ~51 minutes on Base, frontend auto-reveals much sooner
   - **Edge case**: If no one reveals within 256 blocks, fee stays in pool

## Next Steps

After successful testnet deployment:

1. **Frontend Integration**: Test clicking and revealing in the UI
2. **Event Watching**: Ensure frontend properly watches for events
3. **Auto-Reveal**: Implement automatic reveal when target block is reached
4. **Block Number Tracking**: Use wagmi's `useBlockNumber()` to track current block
5. **Multiple Pending Clicks**: Test handling multiple simultaneous pending clicks
6. **Mainnet Prep**: When ready, repeat process on Base mainnet

## Resources

- [Base Sepolia Faucet](https://faucets.chain.link/base-sepolia)
- [Base Sepolia Explorer](https://sepolia.basescan.org)
- [Foundry Documentation](https://book.getfoundry.sh)
- [wagmi Documentation](https://wagmi.sh)
