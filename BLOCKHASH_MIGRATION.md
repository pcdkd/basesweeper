# Blockhash Migration Summary

This document summarizes the migration from Chainlink VRF v2.5 to blockhash-based randomness.

## Migration Date
November 20, 2025

## Rationale
After evaluation, we decided to use blockhash instead of Chainlink VRF for the following reasons:

1. **Cost Efficiency**: Zero external oracle costs - only gas fees
2. **Simplicity**: Simpler implementation and deployment (no subscription management)
3. **Adequate Security**: For a game with modest stakes (<1 ETH pools), blockhash provides sufficient security
4. **Fast UX**: Still maintains async pattern (~36 seconds) but without oracle dependencies

## Changes Made

### Smart Contract (`src/Basesweeper.sol`)

**Removed:**
- Chainlink VRF v2.5 integration
- VRF coordinator and subscription dependencies
- `fulfillRandomWords()` callback

**Added:**
- `BLOCK_DELAY` constant (3 blocks)
- `REVEAL_REWARD` constant (0.00001 ETH)
- `nextRequestId` counter
- `targetBlock` field to `PendingClick` struct
- `revealOutcome(uint256 requestId)` public function
- `canReveal(uint256 requestId)` view function

**Modified:**
- `click()` now creates pending click with target block instead of requesting VRF
- Fee reduced from 0.001 ETH to 0.0008 ETH
- `ClickPending` event now includes targetBlock
- Anyone can reveal outcomes (incentivized with small reward)

### Deployment (`script/Deploy.s.sol`)

**Removed:**
- VRF coordinator parameter
- Subscription ID parameter
- VRF-related console output

**Added:**
- Display of game configuration (fee, block delay, reward)
- Simplified deployment (no external dependencies)

### Configuration

**foundry.toml:**
- Removed Chainlink contract remapping

**env_foundry:**
- Removed `VRF_SUBSCRIPTION_ID` variable

**Git Submodules:**
- Removed `lib/chainlink-brownie-contracts` submodule

### Documentation

**CLAUDE.md:**
- Updated architecture section with blockhash details
- Added new functions to command reference
- Updated transaction flow
- Removed VRF deployment steps
- Updated dependency management

**DEPLOYMENT.md:**
- Completely rewritten for simplified deployment
- Added blockhash-specific instructions
- Added security considerations section
- Removed VRF subscription steps

**VRF_INTEGRATION_SUMMARY.md:**
- Archived as `VRF_INTEGRATION_SUMMARY.md.archived` for reference

## Security Considerations

### Blockhash vs Chainlink VRF

| Aspect | Blockhash | Chainlink VRF |
|--------|-----------|---------------|
| Cost | Free (gas only) | ~$0.50-2.00 per request |
| Security | Good for <1 ETH | Excellent for any amount |
| Manipulation Risk | Theoretical validator manipulation | None |
| Implementation | Simple | Complex (subscription management) |
| Speed | ~36 seconds | ~2-5 seconds |

### Attack Vectors & Mitigations

1. **Validator Manipulation**
   - **Risk**: Validators could theoretically manipulate blockhash
   - **Mitigation**: Economically impractical for small stakes
   - **Action**: Monitor pool sizes; if >1 ETH, consider VRF upgrade

2. **Reveal Griefing**
   - **Risk**: Players might not reveal losing clicks
   - **Mitigation**: Anyone can reveal, small reward incentivizes participation
   - **Frontend**: Auto-reveals to ensure smooth UX

3. **256 Block Expiry**
   - **Risk**: Clicks become unrevealable after 256 blocks (~51 minutes)
   - **Mitigation**: Frontend auto-reveals within seconds
   - **Edge Case**: Fee stays in pool if no one reveals

## Frontend Updates Required

The frontend needs to be updated to handle the new reveal mechanism:

### 1. Update Contract ABI
- Copy new ABI from `out/Basesweeper.sol/Basesweeper.json`
- Update `contracts/abi.ts`

### 2. Add New Hook Functions
Update `hooks/useBasesweeper.ts`:
```typescript
// Add revealOutcome write function
const { writeContract: revealOutcome } = useWriteContract();

// Add canReveal read function
const { data: canReveal } = useReadContract({
  functionName: 'canReveal',
  args: [requestId]
});

// Add getPendingClick read function
const { data: pendingClick } = useReadContract({
  functionName: 'getPendingClick',
  args: [requestId]
});
```

### 3. Track Current Block
```typescript
import { useBlockNumber } from 'wagmi';

const { data: blockNumber } = useBlockNumber({ watch: true });
```

### 4. Watch for ClickPending Events
```typescript
import { useWatchContractEvent } from 'wagmi';

useWatchContractEvent({
  eventName: 'ClickPending',
  onLogs(logs) {
    // Track pending clicks
    // Store requestId and targetBlock
  }
});
```

### 5. Auto-Reveal Logic
```typescript
useEffect(() => {
  if (blockNumber >= targetBlock && canReveal) {
    // Automatically call revealOutcome(requestId)
    revealOutcome({
      functionName: 'revealOutcome',
      args: [requestId]
    });
  }
}, [blockNumber, targetBlock, canReveal]);
```

### 6. UI Updates
- Show "Waiting for block X..." during pending state
- Display countdown or progress bar
- Show reveal transaction status
- Handle multiple pending clicks simultaneously

## Testing Checklist

Before deploying to mainnet:

- [ ] Deploy to Base Sepolia testnet
- [ ] Test single click and reveal
- [ ] Test multiple simultaneous pending clicks
- [ ] Test auto-reveal functionality
- [ ] Verify reveal reward is paid
- [ ] Test winning scenario
- [ ] Test losing scenario
- [ ] Verify pool accumulation
- [ ] Test edge case: manual reveal by third party
- [ ] Monitor gas costs
- [ ] Verify contract on BaseScan

## Rollback Plan

If blockhash proves inadequate:

1. The VRF implementation is preserved in git history
2. VRF integration summary archived at `VRF_INTEGRATION_SUMMARY.md.archived`
3. Can restore Chainlink submodule with:
   ```bash
   git checkout <previous-commit> -- .gitmodules
   git submodule update --init --recursive
   ```
4. Revert contract changes and redeploy

## Performance Comparison

### Before (Chainlink VRF)
- Cost per click: 0.001 ETH + VRF fee (~$0.50-2.00)
- Wait time: 2-5 seconds
- External dependency: Chainlink VRF subscription
- Security: Excellent (cryptographically secure)

### After (Blockhash)
- Cost per click: 0.0008 ETH (gas only)
- Wait time: ~36 seconds (3 blocks)
- External dependency: None
- Security: Good (adequate for small stakes)

## Conclusion

The migration to blockhash-based randomness provides:
- ✅ Significant cost savings
- ✅ Simpler deployment and maintenance
- ✅ No external dependencies
- ✅ Adequate security for intended use case
- ⚠️ Slightly longer wait time (36s vs 5s)
- ⚠️ Requires frontend auto-reveal implementation

For a Farcaster Mini App game with modest stakes, this trade-off is favorable.
