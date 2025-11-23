# Ponder Indexer Setup Guide

This guide walks you through setting up the Ponder indexer for Basesweeper game history.

## What is Ponder?

Ponder is a TypeScript-native blockchain indexer that:
- Indexes smart contract events into a PostgreSQL database
- Provides a GraphQL/REST API for querying indexed data
- Runs locally for development, deploys to production easily

## Prerequisites

1. **Neon DB Account** (free): https://neon.tech
2. **Base Sepolia RPC URL**: Use public endpoint or get one from Alchemy/Infura

## Step 1: Create Neon Database

1. Go to https://neon.tech and sign up (no credit card required)
2. Create a new project called `basesweeper-indexer`
3. In your project dashboard:
   - Click "Connection string"
   - Select **"Pooled connection"** (recommended for serverless)
   - Copy the full connection string

Example connection string:
```
postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

## Step 2: Configure Environment Variables

Create or update `.env.local` in the project root:

```bash
# Neon DB connection (from Step 1)
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Base Sepolia RPC (use public endpoint)
PONDER_RPC_URL_84532=https://sepolia.base.org

# Ponder API URL (for frontend to connect)
NEXT_PUBLIC_PONDER_URL=http://localhost:42069
```

## Step 3: Run Ponder Locally

Start the Ponder indexer in development mode:

```bash
npm run ponder
```

This will:
1. Connect to your Neon database
2. Create necessary tables automatically
3. Start indexing from block 34005195 (contract deployment)
4. Start a local API server on port 42069

**First run will take a few minutes** to index all historical events.

## Step 4: Verify Indexer is Working

Check the Ponder logs. You should see:

```
✓ Database schema synced
✓ Started indexing from block 34005195
✓ Indexed GameStarted event (gameId: 1)
✓ Indexed GameWon event (gameId: 1)
...
✓ API server listening on http://localhost:42069
```

## Step 5: Test the API

Open your browser or use curl:

```bash
# Get all completed games
curl http://localhost:42069/api/games

# Get specific game details
curl http://localhost:42069/api/games/1

# Get leaderboard
curl http://localhost:42069/api/leaderboard

# Get current active game
curl http://localhost:42069/api/current-game
```

## Step 6: Run Frontend

In a separate terminal, run the Next.js frontend:

```bash
npm run dev
```

Navigate to http://localhost:3001 and click the "History" tab. You should see past games!

## Development Workflow

### Running Both Services

You'll need two terminals:

**Terminal 1: Ponder Indexer**
```bash
npm run ponder
```

**Terminal 2: Next.js Frontend**
```bash
npm run dev
```

### Resetting the Database

If you want to re-index from scratch:

```bash
# Stop Ponder (Ctrl+C)
# Delete .ponder directory
rm -rf .ponder

# Restart Ponder
npm run ponder
```

Ponder will recreate tables and re-index all events.

## API Endpoints

Ponder exposes the following endpoints:

### GET /api/games
Returns last 50 completed games (most recent first)

**Response:**
```json
[
  {
    "id": "1",
    "pool": "1590000000000000",
    "winner": "0xc7a0b5E5E2F68D70e5D40b730500972ecfd56aD0",
    "active": false,
    "clickedMask": "1",
    "startedAt": "1737508847",
    "endedAt": "1737509000"
  }
]
```

### GET /api/games/:id
Returns detailed info for a specific game including all clicks

**Response:**
```json
{
  "game": { ...game data... },
  "clicks": [
    {
      "id": "1-3",
      "gameId": "1",
      "requestId": "3",
      "player": "0xc7a0...",
      "tileIndex": 0,
      "clickedAt": "1737508900",
      "revealed": true,
      "isWinner": true,
      "refunded": false
    }
  ]
}
```

### GET /api/users/:address
Returns stats for a specific player

**Response:**
```json
{
  "address": "0xc7a0b5e5e2f68d70e5d40b730500972ecfd56ad0",
  "totalClicks": 5,
  "wins": 1,
  "totalSpent": "4000000000000000",
  "totalWinnings": "1590000000000000",
  "netProfit": "-2410000000000000"
}
```

### GET /api/leaderboard
Returns top 10 winners

**Response:**
```json
[
  {
    "player": "0xc7a0b5e5e2f68d70e5d40b730500972ecfd56ad0",
    "wins": 1
  }
]
```

### GET /api/current-game
Returns the currently active game with pending clicks

## Deployment

See `HISTORY_IMPLEMENTATION_PLAN.md` Phase 5 for production deployment to Railway + Neon.

## Troubleshooting

### "Failed to connect to database"
- Check your `DATABASE_URL` in `.env.local`
- Make sure the Neon database is not paused (free tier doesn't pause)
- Test connection string in a Postgres client

### "RPC error: Too many requests"
- Public RPC may be rate-limited
- Consider using Alchemy or Infura for better reliability
- Update `PONDER_RPC_URL_84532` with your RPC URL

### "Port 42069 already in use"
- Kill existing Ponder process: `pkill -f ponder`
- Or change port in environment variables

### History tab shows "Failed to load"
- Make sure Ponder is running: `npm run ponder`
- Check console for API errors
- Verify `NEXT_PUBLIC_PONDER_URL` points to running Ponder instance

### Slow indexing
- First run takes longer (indexing all historical events)
- Subsequent runs are faster (only new blocks)
- Consider increasing RPC rate limits or using paid RPC

## Files Structure

```
/basesweeper
  ponder.config.ts           # Ponder configuration
  ponder.schema.ts           # Database schema
  src/ponder/
    index.ts                 # Event handlers
    api.ts                   # API endpoints
  lib/
    api.ts                   # Frontend API client
  components/
    History.tsx              # History UI component
  .env.local                 # Environment variables (not in git)
  .env.local.example         # Example env file (in git)
```

## Next Steps

- Add user profile pages
- Implement leaderboard component
- Add game replay feature
- Deploy to Railway for production

For detailed implementation plan, see `HISTORY_IMPLEMENTATION_PLAN.md`.
