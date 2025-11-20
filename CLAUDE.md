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
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --account <ACCOUNT_NAME> --broadcast

# Local development node
anvil
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

The `Basesweeper` contract manages game state and logic:
- **Winning tile determination**: Uses `keccak256(abi.encodePacked(seed, gameId)) % 256` - NOTE: This is for demo purposes only. Production should use Chainlink VRF or commit-reveal for security.
- **State storage**: Uses bitmask (`clickedMask`) to efficiently store which of 256 tiles have been clicked
- **Game lifecycle**: Automatically starts new game when current game is won
- **Pool management**: Accumulates fees from losing clicks and pays out entire pool to winner

Key functions:
- `click(uint256 tileIndex)`: Main game interaction - payable function requiring FEE (0.0008 ETH)
- `getGameState(uint256 _gameId)`: Returns pool, winner, active status, and clickedMask
- `isTileClicked(uint256 _gameId, uint256 tileIndex)`: Helper to check individual tile state

### Frontend Architecture

**Component Structure**:
- `app/page.tsx`: Main page with tabs for Game and History views
- `components/Grid.tsx`: 16x16 grid UI that interacts with smart contract
- `components/History.tsx`: Game history view
- `hooks/useBasesweeper.ts`: Custom hook abstracting contract interactions

**Web3 Integration**:
- Contract ABI and address stored in `contracts/abi.ts`
- `useBasesweeper` hook centralizes all contract reads/writes:
  - Reads: `gameId`, `getGameState`, `FEE`
  - Write: `click(tileIndex)` with automatic transaction status tracking
  - Auto-refetch game state after confirmed transactions

**State Management**:
- wagmi hooks for wallet connection and contract interaction
- React Query (via wagmi) for caching contract reads
- MiniKit SDK for Farcaster frame integration

### Farcaster MiniApp Configuration

The `minikit.config.ts` file defines the MiniApp manifest following the Farcaster specification:
- App metadata (name, description, icons)
- URLs for screenshots, splash screens, OG images
- Category: "games" with relevant tags
- Webhook endpoint at `/api/webhook`

When updating the MiniApp, modify this config and ensure all referenced assets exist in `/public`.

## Key Integration Points

### Contract → Frontend Flow

1. **Contract deployment**: Deploy with `Deploy.s.sol`, update `BASESWEEPER_ADDRESS` in `contracts/abi.ts`
2. **ABI sync**: After contract changes, regenerate ABI and update `contracts/abi.ts`
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

### Transaction Flow

1. User clicks tile in Grid component
2. `clickTile(index)` called from `useBasesweeper` hook
3. wagmi's `writeContract` sends transaction with FEE value
4. `useWaitForTransactionReceipt` tracks confirmation
5. On confirmation, `refetchGameState()` updates UI
6. Grid automatically reflects new game state (new clicked tiles or game-over state)

## Development Notes

- The project uses Foundry's `forge-std` as a git submodule in `lib/`
- Environment variables should be configured in `.env` (see `.example.env`)
- The `env_foundry` file is used by Foundry for RPC configuration during deployments
- Contract seed value is hardcoded in `Deploy.s.sol` (12345) - consider making this configurable for production
- Base Sepolia testnet is likely the deployment target given the Base focus
