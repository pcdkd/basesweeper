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
# Initialize submodules (required after cloning)
git submodule update --init --recursive

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

# Cast commands for reading contract state (CONTRACT_ADDRESS is in contracts/abi.ts)
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

### Event Indexer (Supabase)

```bash
# Run the Supabase event indexer (watches for contract events and writes to Supabase)
npm run indexer

# Alternative: Run Ponder development server (if using Ponder instead)
npm run ponder

# Run Ponder in production mode
npm run ponder:start
```

## Architecture

### Smart Contract Layer (`src/Basesweeper.sol`)

The `Basesweeper` contract manages game state and logic using **blockhash** for randomness:

**Grid Configuration:**
- **IMPORTANT**: `GRID_SIZE` is currently set to 9 (3x3 grid) for testing
- For production, change to 256 (16x16 grid)
- Remember to update frontend components when changing grid size

**Randomness & Security:**
- **Winning tile determination**: Uses future blockhash for randomness source
- **Cost-effective**: No external oracle costs - only gas fees
- **Async architecture**: Click creates pending request → Wait 3 blocks → Anyone reveals outcome
- **Bot-resistant**: Future blockhash cannot be predicted at time of click
- **Security trade-off**: Theoretically vulnerable to validator manipulation, but economically impractical for small stakes

**State Management:**
- **Bitmask storage**: Uses `clickedMask` to efficiently track which tiles have been clicked
- **Pending clicks**: Tracks pending reveals via `PendingClick` struct with target block
- **Game lifecycle**: Automatically starts new game when current game is won
- **Pool management**: Accumulates fees from losing clicks and pays out entire pool to winner
- **Reveal incentive**: Small reward (0.00001 ETH) paid to anyone who calls `revealOutcome()`

**Key Functions:**
- `click(uint256 tileIndex)`: Main game interaction - payable function requiring FEE (0.0008 ETH), creates pending click
- `revealOutcome(uint256 requestId)`: Anyone can call after BLOCK_DELAY blocks to reveal outcome using blockhash
- `rescueExpiredClick(uint256 requestId)`: Refunds player when pending click expires (>256 blocks), prevents fund lock
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
- `app/page.tsx`: Main page with tabs for Game, History, and Mechanics views
- `components/Grid.tsx`: Grid UI that interacts with smart contract (currently 3x3 for testing)
- `components/History.tsx`: Game history view querying Supabase
- `components/Mechanics.tsx`: Explains game rules and mechanics
- `hooks/useBasesweeper.ts`: Custom hook abstracting contract interactions

**Web3 Integration**:
- Contract ABI and address stored in `contracts/abi.ts`
- `useBasesweeper` hook centralizes all contract reads/writes:
  - Reads: `gameId`, `getGameState`, `FEE`, `blockDelay`, `blockNumber`
  - Writes: `click(tileIndex)`, `revealOutcome(requestId)`, `rescueExpiredClick(requestId)`
  - Auto-refetch game state after confirmed transactions
  - Event watching for `ClickPending`, `GameWon`, `TileClicked`, and `ClickRefunded`

**Auto-Reveal Mechanism**:
- Hook watches current block number via `useBlockNumber({ watch: true })`
- Maintains map of pending clicks with their target blocks
- Automatically calls `revealOutcome()` when target block is reached
- Calls `rescueExpiredClick()` if pending click exceeds 256-block window
- **Critical**: Must prevent duplicate reveal attempts to avoid endless transaction pop-ups

**State Management**:
- wagmi hooks for wallet connection and contract interaction
- React Query (via wagmi) for caching contract reads
- MiniKit SDK for Farcaster frame integration
- Local state tracks pending clicks and coordinates auto-reveals

### Farcaster MiniApp Configuration

The `minikit.config.ts` file defines the MiniApp manifest following the Farcaster specification:
- App metadata (name, description, icons)
- URLs for screenshots, splash screens, OG images
- Category: "games" with relevant tags
- Webhook endpoint at `/api/webhook`

When updating the MiniApp, modify this config and ensure all referenced assets exist in `/public`.

### Event Indexing Architecture

The project uses a **Supabase-based event indexer** (with Ponder configuration available as alternative):

**Supabase Indexer (`indexer/index.ts`):**
- Real-time event watcher using viem's `watchEvent`
- Historical sync from deployment block (34115650)
- Writes to Supabase PostgreSQL database
- Tables: `games`, `clicks`, `pending_clicks`
- Batch processing (10k blocks) to avoid RPC limits
- Automatic retry on errors

**Events Tracked:**
- `GameStarted`: Initializes new game record
- `ClickPending`: Tracks pending reveals
- `TileClicked`: Records losing clicks, updates pool
- `GameWon`: Marks game as complete, records winner
- `ClickRefunded`: Handles expired/refunded clicks

**Database Schema (`supabase-schema.sql`):**
- Row Level Security (RLS) enabled
- Public read access for game history
- Service role key required for writes (indexer)
- Indexed on common query patterns (active games, player history)

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

### Indexer → Frontend Flow

1. **Setup**: Run `supabase-schema.sql` in Supabase SQL Editor to create tables
2. **Start indexer**: `npm run indexer` to watch for contract events
3. **Historical sync**: Indexer automatically syncs from deployment block (34115650)
4. **Real-time updates**: Watches for new events and writes to database
5. **Frontend queries**: History component queries Supabase directly via the anon key
6. **Public access**: RLS policies allow public reads, only service role can write

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

### Frontend Environment Variables (`.env.local`)
Copy `.env.local.example` to `.env.local` and configure:
```bash
# Frontend
NEXT_PUBLIC_URL=http://localhost:3001

# Supabase (for event indexer and history)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Base Sepolia RPC
PONDER_RPC_URL_84532=https://sepolia.base.org
```

### Foundry Environment Variables (`env_foundry`)
RPC URLs for deployment:
```bash
BASE_RPC_URL="https://mainnet.base.org"
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
```

### Supabase Setup
1. Create a new Supabase project at https://supabase.com
2. Run the SQL schema from `supabase-schema.sql` in the SQL Editor
3. Copy your project URL and keys to `.env.local`
4. Start the indexer with `npm run indexer`

## Deployment

**Automated (Recommended):**
```bash
# Deploy contract and get address
./deploy.sh

# Update frontend with deployed address and ABI
node update-frontend.js <CONTRACT_ADDRESS>
```

The `deploy.sh` script handles contract deployment with verification, and `update-frontend.js` automatically:
- Reads ABI from `out/Basesweeper.sol/Basesweeper.json`
- Updates `contracts/abi.ts` with new ABI and address
- Verifies all new functions are present in ABI

**Manual:**
1. Ensure you have Base Sepolia ETH in your deployer account
2. Deploy contract:
   ```bash
   source env_foundry
   forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --account deployer --broadcast
   ```
3. Copy deployed contract address
4. Update frontend: `node update-frontend.js <CONTRACT_ADDRESS>`
   - Or manually: Update `contracts/abi.ts` with new address and ABI from `out/Basesweeper.sol/Basesweeper.json`

**Post-Deployment:**
- Update `BASESWEEPER_ADDRESS` in `ponder.config.ts` if using indexer
- Update `START_BLOCK` in `indexer/index.ts` to the deployment block
- Restart indexer to begin tracking events from new contract

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
- `components/` - React components (Grid, History, GameInfo, Mechanics)
- `hooks/` - Custom React hooks (useBasesweeper)
- `contracts/` - Contract ABI and address constants
- `public/` - Static assets
- `package.json` - Node dependencies

**Event Indexer Layer:**
- `indexer/` - Supabase event indexer script
- `ponder.config.ts` - Ponder configuration (alternative indexer)
- `ponder.schema.ts` - Ponder schema definitions
- `supabase-schema.sql` - Database schema for Supabase

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
- Test blockhash randomness thoroughly on testnet before mainnet deployment

### Event Indexing & History
- **Implementation complete**: Supabase-based indexer running in `indexer/index.ts`
- Tracks all contract events in real-time
- Historical sync from deployment block
- Database schema with RLS policies for public read access
- See `HISTORY_IMPLEMENTATION_PLAN.md` and `SUPABASE_SETUP.md` for details
- Alternative Ponder setup available in `ponder.config.ts` (not currently active)

### Common Development Workflows

**Full-Stack Development:**
```bash
# Terminal 1: Run frontend dev server
npm run dev

# Terminal 2: Run event indexer (if working with history)
npm run indexer

# Terminal 3: Watch contract events with cast (optional debugging)
cast logs --address <CONTRACT_ADDRESS> --rpc-url <RPC_URL> --follow
```

**After Contract Changes:**
1. Modify contract in `src/Basesweeper.sol`
2. Run `forge build` to compile
3. Run `forge test` if tests exist
4. Deploy: `./deploy.sh`
5. Update frontend: `node update-frontend.js <NEW_ADDRESS>`
6. Update indexer start block in `indexer/index.ts`
7. Restart indexer

**Debugging Event Indexing:**
- Check indexer logs for errors
- Verify Supabase credentials in `.env.local`
- Query Supabase directly to verify data is being written
- Use cast to verify contract is emitting events:
  ```bash
  cast logs --address <CONTRACT_ADDRESS> --from-block <START_BLOCK> --rpc-url <RPC_URL>
  ```
