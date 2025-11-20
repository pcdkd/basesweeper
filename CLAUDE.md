# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Basesweeper is a Farcaster Mini App that brings Minesweeper onchain using Base. The project combines:
- **Smart Contract**: Solidity contract deployed on Base for the game logic
- **Frontend**: Next.js app using Farcaster's MiniKit SDK for the UI
- **Web3 Integration**: wagmi + viem for blockchain interactions

The game uses a 16x16 grid (256 tiles) where players pay a fee to click tiles. One tile per game is the winning tile. Find it and you win the pool; miss and your fee is added to the pool.

## Commands

### Smart Contract Development (Foundry)

```bash
# Build contracts
forge build

# Run tests (currently no tests in /test directory)
forge test

# Format Solidity code
forge fmt

# Deploy contract
source env_foundry
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --account <ACCOUNT_NAME> --broadcast

# Generate ABI (automatically output to out/ directory after forge build)
forge build --extra-output-files abi

# Local development node
anvil

# Cast commands for reading contract state
cast call <CONTRACT_ADDRESS> "gameId()" --rpc-url <RPC_URL>
cast call <CONTRACT_ADDRESS> "getGameState(uint256)" <GAME_ID> --rpc-url <RPC_URL>
cast call <CONTRACT_ADDRESS> "FEE()" --rpc-url <RPC_URL>
cast call <CONTRACT_ADDRESS> "isTileClicked(uint256,uint256)" <GAME_ID> <TILE_INDEX> --rpc-url <RPC_URL>
cast call <CONTRACT_ADDRESS> "getPendingClick(uint256)" <REQUEST_ID> --rpc-url <RPC_URL>
cast call <CONTRACT_ADDRESS> "canReveal(uint256)" <REQUEST_ID> --rpc-url <RPC_URL>

# Reveal a pending click outcome
cast send <CONTRACT_ADDRESS> "revealOutcome(uint256)" <REQUEST_ID> --account <ACCOUNT_NAME> --rpc-url <RPC_URL>
```

### Frontend Development (Next.js)

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

## Architecture

### Smart Contract Layer (`src/Basesweeper.sol`)

The `Basesweeper` contract manages game state and logic using **blockhash** for randomness:

**Randomness & Security:**
- **Winning tile determination**: Uses future blockhash for randomness source
- **Cost-effective**: No external oracle costs - only gas fees
- **Async architecture**: Click creates pending request → Wait 3 blocks → Anyone reveals outcome
- **Bot-resistant**: Future blockhash cannot be predicted at time of click
- **Security trade-off**: Theoretically vulnerable to validator manipulation, but economically impractical for small stakes

**State Management:**
- **Bitmask storage**: Uses `clickedMask` to efficiently track which of 256 tiles have been clicked
- **Pending clicks**: Tracks pending reveals via `PendingClick` struct with target block
- **Game lifecycle**: Automatically starts new game when current game is won
- **Pool management**: Accumulates fees from losing clicks and pays out entire pool to winner
- **Reveal incentive**: Small reward (0.00001 ETH) paid to anyone who calls `revealOutcome()`

**Key Functions:**
- `click(uint256 tileIndex)`: Main game interaction - payable function requiring FEE (0.0008 ETH), creates pending click
- `revealOutcome(uint256 requestId)`: Anyone can call after BLOCK_DELAY blocks to reveal outcome using blockhash
- `getGameState(uint256 _gameId)`: Returns pool, winner, active status, and clickedMask
- `isTileClicked(uint256 _gameId, uint256 tileIndex)`: Helper to check if a specific tile has been clicked
- `getPendingClick(uint256 requestId)`: View pending click details including target block
- `canReveal(uint256 requestId)`: Check if a pending click is ready to be revealed

**Blockhash Configuration:**
- Block Delay: 3 blocks (~36 seconds on Base)
- Blockhash Window: 256 blocks (must reveal within this window)
- Reveal Reward: 0.00001 ETH (incentivizes timely reveals)

### Frontend Architecture

**Component Structure**:
- `app/page.tsx`: Main page with tabs for Game and History views
- `components/Grid.tsx`: 16x16 grid UI that interacts with smart contract
- `components/History.tsx`: Game history view
- `hooks/useBasesweeper.ts`: Custom hook abstracting contract interactions

**Web3 Integration**:
- Contract ABI and address stored in `contracts/abi.ts`
- `useBasesweeper` hook centralizes all contract reads/writes:
  - Reads: `gameId`, `getGameState`, `FEE`, `getPendingClick`, `canReveal`
  - Writes: `click(tileIndex)` and `revealOutcome(requestId)` with automatic transaction status tracking
  - Auto-refetch game state after confirmed transactions
  - Event watching for `ClickPending`, `GameWon`, and `TileClicked`

**State Management**:
- wagmi hooks for wallet connection and contract interaction
- React Query (via wagmi) for caching contract reads
- MiniKit SDK for Farcaster frame integration
- Frontend must track pending clicks and trigger reveals after block delay

### Farcaster MiniApp Configuration

The `minikit.config.ts` file defines the MiniApp manifest following the Farcaster specification:
- App metadata (name, description, icons)
- URLs for screenshots, splash screens, OG images
- Category: "games" with relevant tags
- Webhook endpoint at `/api/webhook`

When updating the MiniApp, modify this config and ensure all referenced assets exist in `/public`.

## Key Integration Points

### Contract → Frontend Flow

1. **Contract deployment**: Deploy with `Deploy.s.sol`, note the deployed contract address from output
2. **ABI sync**: After contract changes:
   - Run `forge build` to regenerate ABI in `out/Basesweeper.sol/Basesweeper.json`
   - Copy the ABI array from the JSON file to `contracts/abi.ts` (update `BASESWEEPER_ABI`)
   - Update `BASESWEEPER_ADDRESS` in `contracts/abi.ts` with the deployed contract address
3. **Hook usage**: Components use `useBasesweeper()` hook, never call wagmi hooks directly for contract interactions

### Tile State Management

The contract uses a `uint256 clickedMask` as a bitmap where bit `i` represents tile `i`:
- Bit set (1): Tile has been clicked
- Bit unset (0): Tile is available

Frontend mirrors this with:
```typescript
const isClicked = (index: number) => {
    return (clickedMask & (1n << BigInt(index))) !== 0n;
};
```

### Transaction Flow (with Blockhash)

**Flow with blockhash-based randomness:**

1. User clicks tile in Grid component
2. `clickTile(index)` called from `useBasesweeper` hook
3. wagmi's `writeContract` sends transaction with 0.0008 ETH FEE value
4. Contract receives click:
   - Adds fee to game pool
   - Creates pending click with target block (current + 3 blocks)
   - Assigns a unique requestId
   - Emits `ClickPending` event with requestId and targetBlock
5. Frontend tracks pending click:
   - Shows pending state (waiting ~36 seconds)
   - Watches for target block to be reached
6. After target block is mined:
   - Anyone can call `revealOutcome(requestId)` (frontend can auto-trigger)
   - Contract reads blockhash of target block
   - Determines winning tile from blockhash
   - Emits either `GameWon` or `TileClicked` event
   - Pays small reward to revealer
7. Frontend watches for events and updates UI:
   - Winner: Shows celebration, refreshes for new game
   - Loser: Marks tile as clicked, continues game

**Important Frontend Considerations:**
- Frontend should automatically call `revealOutcome()` when target block is reached
- Can use `useBlockNumber()` hook to track current block
- Can use `canReveal(requestId)` to check if ready to reveal
- Multiple pending clicks can exist simultaneously

## Environment Setup

### Frontend Environment Variables (`.env`)
Copy `.example.env` to `.env` and configure:
```bash
NEXT_PUBLIC_URL=https://your-app-url.com
```

### Foundry Environment Variables (`env_foundry`)
RPC URLs for deployment:
```bash
BASE_RPC_URL="https://mainnet.base.org"
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
```

**Deployment Steps:**
1. Ensure you have Base Sepolia ETH in your deployer account
2. Deploy contract:
   ```bash
   source env_foundry
   forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --account deployer --broadcast
   ```
3. Copy deployed contract address
4. Update `contracts/abi.ts` with new address
5. Generate and copy ABI from `out/Basesweeper.sol/Basesweeper.json`

See `DEPLOYMENT.md` for detailed deployment instructions.

## Monorepo Structure

This project combines both frontend (Next.js) and smart contract (Foundry) development in a single repository:

**Smart Contract Layer (Foundry):**
- `src/` - Solidity contracts
- `script/` - Deployment scripts
- `test/` - Contract tests (currently empty)
- `lib/` - Dependencies as git submodules
  - `forge-std` - Foundry standard library
- `out/` - Compiled artifacts (including ABIs)
- `foundry.toml` - Foundry configuration

**Frontend Layer (Next.js):**
- `app/` - Next.js app directory with pages and API routes
- `components/` - React components (Grid, History)
- `hooks/` - Custom React hooks (useBasesweeper)
- `contracts/` - Contract ABI and address constants
- `public/` - Static assets
- `package.json` - Node dependencies

## Development Notes

### Dependency Management
- Foundry dependencies are **git submodules** in `lib/` directory
- After cloning, initialize submodules: `git submodule update --init --recursive`
- Only dependency is `forge-std` (Foundry standard library)

### Critical ABI Sync Workflow
The ABI in `contracts/abi.ts` must be **manually synced** after any contract changes:
1. Modify `src/Basesweeper.sol`
2. Run `forge build` (generates new ABI in `out/Basesweeper.sol/Basesweeper.json`)
3. Copy ABI array from JSON to `contracts/abi.ts`
4. Update `BASESWEEPER_ADDRESS` if redeployed
5. Frontend will now use the updated contract interface

**Missing this sync will cause frontend errors!**

### Testing
- Base Sepolia is the recommended testnet for deployment
- No tests currently in `/test` directory - consider adding before mainnet
- Test VRF integration thoroughly on testnet before mainnet deployment
