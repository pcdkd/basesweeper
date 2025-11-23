# Bug Fixes - Basesweeper Contract

## Summary

Fixed 3 critical bugs that prevented the game from working correctly with a 3x3 grid.

## Root Cause of Game 2 Issue

Game 2 had:
- 12 pending clicks (requests 4-15) for a 9-tile grid
- All 9 tiles marked as clicked (clickedMask = 511 = 0b111111111)
- No winner found
- Game still active

This was caused by the three bugs below working in combination.

---

## BUG #1: Duplicate Tile Clicks

### **Location:** `src/Basesweeper.sol:72`

### **Problem:**
The `click()` function checked if a tile was already clicked using `clickedMask`, but the mask was only updated AFTER the reveal (in `revealOutcome()`), not immediately when clicked.

```solidity
// OLD CODE (BROKEN)
function click(uint256 tileIndex) external payable {
    // ...
    require((currentGame.clickedMask >> tileIndex) & 1 == 0, "Tile already clicked");

    // clickedMask NOT updated here! ❌

    pendingClicks[requestId] = PendingClick({ ... });
}
```

### **Impact:**
Multiple players could click the same tile before it was revealed, creating duplicate pending clicks for the same tile.

**Result:** 12 pending clicks for 9 tiles in game 2.

### **Fix:**
Mark the tile as clicked immediately when `click()` is called:

```solidity
// NEW CODE (FIXED)
function click(uint256 tileIndex) external payable {
    // ...
    require((currentGame.clickedMask >> tileIndex) & 1 == 0, "Tile already clicked");

    // Mark tile as clicked immediately to prevent duplicate clicks ✅
    currentGame.clickedMask |= (uint256(1) << tileIndex);

    pendingClicks[requestId] = PendingClick({ ... });
}
```

---

## BUG #2: Missing Event Parameters

### **Location:** `src/Basesweeper.sol:49-50` (event definitions) and `src/Basesweeper.sol:144,164` (emit statements)

### **Problem:**
The `GameWon` and `TileClicked` events were missing critical parameters:

```solidity
// OLD EVENTS (BROKEN)
event GameWon(uint256 indexed gameId, address indexed winner, uint256 payout);
event TileClicked(uint256 indexed gameId, uint256 tileIndex, address indexed player);
```

Missing:
- `requestId` - Can't correlate reveals with pending clicks
- `tileIndex` (GameWon) - Don't know which tile was the winner
- `newPool` (TileClicked) - Don't know the updated pool amount

### **Impact:**
The indexer couldn't properly track which pending clicks were revealed, making history tracking broken.

### **Fix:**
Added missing parameters to events:

```solidity
// NEW EVENTS (FIXED)
event GameWon(uint256 indexed gameId, uint256 requestId, address indexed winner, uint256 tileIndex, uint256 payout);
event TileClicked(uint256 indexed gameId, uint256 requestId, address indexed player, uint256 tileIndex, uint256 newPool);
```

Updated emit statements:
```solidity
// In revealOutcome()
emit GameWon(pending.gameId, requestId, pending.player, pending.tileIndex, payout);
emit TileClicked(pending.gameId, requestId, pending.player, pending.tileIndex, currentGame.pool);
```

---

## BUG #3: Redundant clickedMask Update in Loser Branch

### **Location:** `src/Basesweeper.sol:160` (removed line)

### **Problem:**
After fixing Bug #1, the `revealOutcome()` function was updating `clickedMask` again in the loser branch:

```solidity
// OLD CODE (REDUNDANT)
} else {
    // LOSER
    currentGame.pool += FEE;
    currentGame.clickedMask |= (uint256(1) << pending.tileIndex); // ❌ REDUNDANT
}
```

This was redundant because the tile was already marked as clicked in `click()`.

### **Impact:**
Not a bug per se, but wastes gas and is confusing.

### **Fix:**
Removed the redundant update and added a comment:

```solidity
// NEW CODE (FIXED)
} else {
    // LOSER - Add fee to pool (tile already marked as clicked in click() function)
    currentGame.pool += FEE;
}
```

---

## Additional Changes

### **Frontend ABI Update**
Updated `contracts/abi.ts` to include the new event signatures with `requestId`, `tileIndex`, and `newPool` parameters.

### **Indexer Compatibility**
The indexer (`indexer/index.ts`) already uses viem's `decodeEventLog()` which automatically handles the new event structure. No changes needed to the indexer code.

---

## Testing Plan

1. **Deploy new contract** to Base Sepolia
2. **Update contract address** in `contracts/abi.ts`
3. **Play a full game** with 3-4 players clicking different tiles
4. **Verify**:
   - No duplicate clicks allowed on same tile
   - Exactly 1 pending click per tile
   - Game ends when winning tile is found
   - Events include all required parameters
   - Indexer correctly tracks all clicks and reveals

---

## Deployment Checklist

- [x] Bug fixes implemented in `src/Basesweeper.sol`
- [x] Contract compiled successfully (`forge build`)
- [x] ABI updated in `contracts/abi.ts`
- [ ] Deploy to Base Sepolia
- [ ] Update `BASESWEEPER_ADDRESS` in `contracts/abi.ts`
- [ ] Clear Supabase database tables (fresh start)
- [ ] Restart indexer to sync new contract
- [ ] Test full game flow end-to-end
