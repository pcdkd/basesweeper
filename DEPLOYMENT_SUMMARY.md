# Deployment Summary - Base Sepolia

## Contract Deployment

**Network:** Base Sepolia
**Contract Address:** `0x5AC802CF0aEc6ff32720fE321ab0ce45cd85D0b4`
**BaseScan:** https://sepolia.basescan.org/address/0x5AC802CF0aEc6ff32720fE321ab0ce45cd85D0b4

**Deployment Date:** November 20, 2025

## Contract Configuration

- **Fee:** 0.0008 ETH per click
- **Block Delay:** 3 blocks (~36 seconds on Base)
- **Reveal Reward:** 0.00001 ETH
- **Randomness Source:** Blockhash

## Frontend Updates

### ✅ Completed

1. **contracts/abi.ts**
   - Updated with new contract address
   - Updated with new ABI (17 entries: 12 functions, 4 events)
   - New functions available:
     - `revealOutcome(requestId)`
     - `canReveal(requestId)`
     - `getPendingClick(requestId)`
     - `BLOCK_DELAY`
     - `REVEAL_REWARD`

2. **hooks/useBasesweeper.ts**
   - Added block number tracking (`useBlockNumber`)
   - Added event watchers:
     - `ClickPending` - Tracks new pending clicks
     - `GameWon` - Clears pending clicks and refetches state
     - `TileClicked` - Refetches game state
   - Added pending clicks state management
   - Added auto-reveal logic:
     - Automatically calls `revealOutcome()` when target block is reached
     - Removes revealed clicks from pending state
   - New exports:
     - `blockDelay` - The configured block delay
     - `blockNumber` - Current block number
     - `pendingClicks` - Array of pending clicks with their details
     - `revealOutcome(requestId)` - Manual reveal function

## How It Works

### User Flow

1. **User clicks a tile:**
   - Pays 0.0008 ETH fee
   - Contract creates pending click with target block (current + 3)
   - `ClickPending` event emitted
   - Frontend tracks pending click

2. **Waiting period (~36 seconds):**
   - Frontend watches block number
   - Shows pending state to user
   - Displays countdown/progress

3. **Target block reached:**
   - Frontend automatically calls `revealOutcome(requestId)`
   - Contract reads blockhash of target block
   - Determines if tile is winning tile
   - Emits `GameWon` or `TileClicked` event
   - Pays 0.00001 ETH reward to revealer

4. **Result displayed:**
   - Winner: Pool transferred, new game starts
   - Loser: Tile marked as clicked, game continues

### Auto-Reveal Logic

The hook includes automatic reveal functionality:

```typescript
useEffect(() => {
    if (!blockNumber) return;

    pendingClicks.forEach((click, requestId) => {
        if (blockNumber >= click.targetBlock) {
            revealOutcome(Number(requestId));
            // Remove from pending
        }
    });
}, [blockNumber, pendingClicks]);
```

This ensures:
- ✅ No manual user intervention needed
- ✅ Reveals happen as soon as possible
- ✅ User gets their reveal reward
- ✅ Smooth UX

## Testing the Contract

### Using Cast (CLI)

```bash
# Check current game
cast call 0x5AC802CF0aEc6ff32720fE321ab0ce45cd85D0b4 "gameId()" --rpc-url https://sepolia.base.org

# Get game state
cast call 0x5AC802CF0aEc6ff32720fE321ab0ce45cd85D0b4 "getGameState(uint256)" 1 --rpc-url https://sepolia.base.org

# Click a tile
cast send 0x5AC802CF0aEc6ff32720fE321ab0ce45cd85D0b4 \
  "click(uint256)" 42 \
  --value 0.0008ether \
  --account deployer \
  --rpc-url https://sepolia.base.org
```

### Using Frontend

```bash
npm run dev
```

Then:
1. Connect wallet (Base Sepolia)
2. Click a tile
3. Watch pending state
4. See auto-reveal after ~36 seconds

## Next Steps

### Recommended

1. **Test the game:**
   - Try clicking tiles
   - Verify pending state displays correctly
   - Confirm auto-reveal works
   - Test both winning and losing scenarios

2. **UI improvements:**
   - Add visual indicator for pending tiles
   - Show countdown timer (blocks remaining)
   - Display "Revealing..." state
   - Show reveal transaction confirmation

3. **Optional enhancements:**
   - Add manual reveal button (if auto-reveal fails)
   - Show all pending clicks with their target blocks
   - Display revealer reward notification
   - Add block explorer links for transactions

### Before Mainnet

- [ ] Test thoroughly on Base Sepolia
- [ ] Verify gas costs are acceptable
- [ ] Test edge cases:
  - Multiple simultaneous pending clicks
  - Network issues during reveal
  - Large pool scenarios
- [ ] Consider contract verification on BaseScan
- [ ] Monitor for any issues

## Contract Verification

To verify the contract on BaseScan:

```bash
forge verify-contract \
  0x5AC802CF0aEc6ff32720fE321ab0ce45cd85D0b4 \
  src/Basesweeper.sol:Basesweeper \
  --chain base-sepolia
```

## Resources

- **Contract:** https://sepolia.basescan.org/address/0x5AC802CF0aEc6ff32720fE321ab0ce45cd85D0b4
- **Base Sepolia Faucet:** https://faucets.chain.link/base-sepolia
- **Base Sepolia RPC:** https://sepolia.base.org
- **Documentation:** See CLAUDE.md and DEPLOYMENT.md
