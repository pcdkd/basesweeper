# Event Indexing & History Implementation Plan

## Overview

This document outlines the implementation plan for adding event indexing and game history functionality to Basesweeper.

## Current State

- ✅ Smart contract emits events: `GameWon`, `TileClicked`, `ClickPending`, `ClickRefunded`
- ✅ Frontend watches events in real-time via `useWatchContractEvent`
- ❌ No historical event storage
- ❌ History component is a placeholder

## Goals

1. Index all game events from contract deployment onwards
2. Display complete game history in the History tab
3. Show individual game details (winner, pool, tiles clicked, timeline)
4. Enable filtering/searching of past games
5. Support pagination for scalability

## Architecture Options

### Option 1: Client-Side Only (Quick MVP)

**Pros:**
- Simple, no backend infrastructure
- Fast to implement (~2-4 hours)
- No hosting costs

**Cons:**
- Limited to recent events (RPC node limits)
- Slow initial load (fetching all events)
- No search/filter capabilities
- Users can't see full history on mobile (network constraints)

**Implementation:**
```typescript
// Use wagmi's getLogs to fetch historical events
const { data: gameWonEvents } = useContractReads({
  contracts: [{
    address: BASESWEEPER_ADDRESS,
    abi: BASESWEEPER_ABI,
    functionName: 'getLogs',
    // ... fetch GameWon events
  }]
})
```

### Option 2: The Graph (Recommended for Production)

**Pros:**
- Industry standard for Web3 indexing
- GraphQL API for flexible queries
- Decentralized hosting options
- Automatic reorg handling
- Efficient pagination and filtering

**Cons:**
- Learning curve for subgraph development
- Deployment/hosting setup required
- ~1-2 days implementation time

**Tech Stack:**
- Subgraph: Graph Protocol
- Query Language: GraphQL
- Hosting: Subgraph Studio (free tier available)

**Implementation Steps:**
1. Create subgraph schema
2. Write event handlers
3. Deploy to Subgraph Studio
4. Update frontend to query GraphQL API

### Option 3: Ponder (Modern Alternative)

**Pros:**
- TypeScript-native (same language as frontend)
- Simpler than The Graph
- Local development server
- Postgres backend for SQL queries
- Better DX (developer experience)

**Cons:**
- Self-hosted only (need to deploy backend)
- Newer project (less mature than The Graph)
- ~1-2 days implementation time

**Tech Stack:**
- Indexer: Ponder
- Database: Neon DB (Serverless Postgres)
- API: GraphQL or tRPC
- Hosting: Railway, Render, or Vercel (serverless)

### Option 4: Custom Indexer

**Pros:**
- Full control over data structure
- Can optimize for specific use cases
- No vendor lock-in

**Cons:**
- Most work (~3-5 days)
- Need to handle reorgs manually
- Maintain infrastructure

## Recommended Approach: Ponder

For Basesweeper, **Ponder** is the best choice because:

1. **TypeScript-native**: Same language/tooling as frontend
2. **Fast iteration**: Local dev server with hot reload
3. **Flexible**: Easy to add custom data transformations
4. **Good DX**: Better than The Graph for small projects
5. **Production-ready**: Can scale as game grows

## Implementation Plan (Ponder + Neon DB)

### Quick Start: Neon DB Setup (5 minutes)

Before starting Phase 1, set up your Neon database:

1. Go to https://neon.tech
2. Sign up (free, no credit card required)
3. Create a new project: "basesweeper-indexer"
4. Copy the connection string from the dashboard:
   - Click "Connection string"
   - Select "Pooled connection" (recommended for serverless)
   - Copy the full string (looks like: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
5. Save it in your `.env.local` as `DATABASE_URL`

**Why Neon?**
- ✅ Generous free tier (0.5GB storage, always available)
- ✅ Serverless Postgres (scales to zero, instant wake)
- ✅ Branch databases (great for dev/staging/prod)
- ✅ No auto-pause issues like Heroku/Railway Postgres

### Phase 1: Setup Ponder (2 hours)

**Tasks:**
1. Create Neon DB project at https://neon.tech (free tier)
2. Copy connection string from Neon dashboard
3. Install Ponder: `npm install ponder`
4. Initialize Ponder config: `ponder.config.ts`
5. Define contract sources (Basesweeper contract + events)

**Files to create:**
```
/ponder/
  ponder.config.ts    # Config for networks, contracts
  ponder.schema.ts    # Database schema
  src/
    index.ts          # Event handlers
  .env.local          # Neon DB connection string
```

**Ponder Config (ponder.config.ts):**
```typescript
import { createConfig } from "ponder";
import { http } from "viem";
import { BASESWEEPER_ABI, BASESWEEPER_ADDRESS } from "../contracts/abi";

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
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
});
```

**Environment Variables (.env.local):**
```bash
# Get this from Neon dashboard
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Base Sepolia RPC (use public or Alchemy/Infura)
PONDER_RPC_URL_84532=https://sepolia.base.org
```

**Schema (ponder.schema.ts):**
```typescript
import { createSchema } from "ponder";

export default createSchema((p) => ({
  Game: p.createTable({
    id: p.bigint(), // gameId
    pool: p.bigint(),
    winner: p.string(),
    active: p.boolean(),
    clickedMask: p.bigint(),
    startedAt: p.bigint(), // block timestamp
    endedAt: p.bigint().optional(),
  }),

  Click: p.createTable({
    id: p.string(), // `${gameId}-${requestId}`
    gameId: p.bigint(),
    requestId: p.bigint(),
    player: p.string(),
    tileIndex: p.int(),
    targetBlock: p.bigint(),
    clickedAt: p.bigint(), // block timestamp
    revealed: p.boolean(),
    isWinner: p.boolean(),
  }),

  PendingClick: p.createTable({
    id: p.bigint(), // requestId
    gameId: p.bigint(),
    player: p.string(),
    tileIndex: p.int(),
    targetBlock: p.bigint(),
    createdAt: p.bigint(),
  }),
}));
```

### Phase 2: Event Handlers (3 hours)

**GameStarted handler:**
```typescript
ponder.on("Basesweeper:GameStarted", async ({ event, context }) => {
  await context.db.Game.create({
    id: event.args.gameId,
    data: {
      pool: 0n,
      winner: null,
      active: true,
      clickedMask: 0n,
      startedAt: event.block.timestamp,
    },
  });
});
```

**ClickPending handler:**
```typescript
ponder.on("Basesweeper:ClickPending", async ({ event, context }) => {
  const { gameId, requestId, player, tileIndex, targetBlock } = event.args;

  // Create pending click
  await context.db.PendingClick.create({
    id: requestId,
    data: {
      gameId,
      player,
      tileIndex: Number(tileIndex),
      targetBlock,
      createdAt: event.block.timestamp,
    },
  });

  // Create click record
  await context.db.Click.create({
    id: `${gameId}-${requestId}`,
    data: {
      gameId,
      requestId,
      player,
      tileIndex: Number(tileIndex),
      targetBlock,
      clickedAt: event.block.timestamp,
      revealed: false,
      isWinner: false,
    },
  });
});
```

**TileClicked handler:**
```typescript
ponder.on("Basesweeper:TileClicked", async ({ event, context }) => {
  const { gameId, tileIndex, player } = event.args;

  // Update game clickedMask
  const game = await context.db.Game.findUnique({ id: gameId });
  if (game) {
    await context.db.Game.update({
      id: gameId,
      data: {
        clickedMask: game.clickedMask | (1n << BigInt(tileIndex)),
      },
    });
  }

  // Mark click as revealed
  const clicks = await context.db.Click.findMany({
    where: { gameId, tileIndex: Number(tileIndex) },
  });

  for (const click of clicks.items) {
    await context.db.Click.update({
      id: click.id,
      data: { revealed: true },
    });
  }

  // Remove from pending
  await context.db.PendingClick.deleteMany({
    where: { gameId, tileIndex: Number(tileIndex) },
  });
});
```

**GameWon handler:**
```typescript
ponder.on("Basesweeper:GameWon", async ({ event, context }) => {
  const { gameId, winner, payout } = event.args;

  // Update game
  await context.db.Game.update({
    id: gameId,
    data: {
      winner,
      pool: payout,
      active: false,
      endedAt: event.block.timestamp,
    },
  });

  // Mark winning click
  const clicks = await context.db.Click.findMany({
    where: { gameId, player: winner },
  });

  for (const click of clicks.items) {
    await context.db.Click.update({
      id: click.id,
      data: {
        revealed: true,
        isWinner: true,
      },
    });
  }
});
```

**ClickRefunded handler:**
```typescript
ponder.on("Basesweeper:ClickRefunded", async ({ event, context }) => {
  const { gameId, tileIndex, player } = event.args;

  // Mark click as revealed (but refunded)
  const clicks = await context.db.Click.findMany({
    where: { gameId, player, tileIndex: Number(tileIndex) },
  });

  for (const click of clicks.items) {
    await context.db.Click.update({
      id: click.id,
      data: { revealed: true },
    });
  }
});
```

### Phase 3: API Endpoint (1 hour)

Ponder automatically creates a GraphQL API. Create custom queries:

```typescript
// ponder/src/api/index.ts
export function createAPI({ ponder }) {
  // Get all completed games
  ponder.get("/api/games", async (req, res) => {
    const games = await req.context.db.Game.findMany({
      where: { active: false },
      orderBy: { id: "desc" },
      limit: 50,
    });
    return res.json(games);
  });

  // Get game details
  ponder.get("/api/games/:id", async (req, res) => {
    const gameId = BigInt(req.params.id);

    const game = await req.context.db.Game.findUnique({ id: gameId });
    const clicks = await req.context.db.Click.findMany({
      where: { gameId },
    });

    return res.json({ game, clicks });
  });

  // Get user stats
  ponder.get("/api/users/:address", async (req, res) => {
    const address = req.params.address;

    const clicks = await req.context.db.Click.findMany({
      where: { player: address },
    });

    const wins = clicks.items.filter(c => c.isWinner).length;
    const totalSpent = BigInt(clicks.items.length) * 800000000000000n; // FEE

    return res.json({
      address,
      totalClicks: clicks.items.length,
      wins,
      totalSpent: totalSpent.toString(),
    });
  });
}
```

### Phase 4: Frontend Integration (2 hours)

**Create API client:**
```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069";

export async function getGameHistory() {
  const res = await fetch(`${API_URL}/api/games`);
  return res.json();
}

export async function getGameDetails(gameId: number) {
  const res = await fetch(`${API_URL}/api/games/${gameId}`);
  return res.json();
}

export async function getUserStats(address: string) {
  const res = await fetch(`${API_URL}/api/users/${address}`);
  return res.json();
}
```

**Update History component:**
```typescript
// components/History.tsx
import { useState, useEffect } from 'react';
import { getGameHistory } from '../lib/api';

export default function History() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGameHistory().then(data => {
      setGames(data.items);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div>Loading history...</div>;
  }

  return (
    <div className="w-full max-w-2xl mt-8 p-4 border rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Game History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Game ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Winner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Pool (ETH)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {games.map((game) => (
              <tr key={game.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  #{game.id.toString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                  {game.winner.slice(0, 6)}...{game.winner.slice(-4)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {(Number(game.pool) / 1e18).toFixed(4)} ETH
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Phase 5: Deployment (1 hour)

**Setup:**

1. **Neon DB (Already created in Phase 1)**
   - Free tier: 0.5GB storage, 10GB/month transfer
   - No sleep/auto-pause on free tier (always available)
   - Copy production connection string

2. **Deploy Ponder to Railway:**
   - Create Railway project
   - Link GitHub repo
   - Set environment variables:
     ```
     DATABASE_URL=postgresql://...  # From Neon
     PONDER_RPC_URL_84532=https://sepolia.base.org
     PORT=42069
     ```
   - Deploy:
     ```bash
     railway up
     ```

3. **Update Frontend Environment:**
   ```bash
   # .env.local
   NEXT_PUBLIC_PONDER_URL=https://your-ponder.railway.app
   ```

**Alternative: Deploy to Vercel (Serverless)**

Ponder can also run serverless on Vercel:
```bash
# vercel.json
{
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "env": {
    "DATABASE_URL": "@database_url",  # Add as Vercel secret
    "PONDER_RPC_URL_84532": "https://sepolia.base.org"
  }
}
```

## Timeline Summary

| Phase | Task | Time |
|-------|------|------|
| 1 | Setup Ponder | 2h |
| 2 | Event Handlers | 3h |
| 3 | API Endpoints | 1h |
| 4 | Frontend Integration | 2h |
| 5 | Deployment | 1h |
| **Total** | | **9h** |

## Additional Features (Optional)

### Leaderboard (2 hours)
```typescript
ponder.get("/api/leaderboard", async (req, res) => {
  // SQL query to get top winners
  const query = `
    SELECT player, COUNT(*) as wins
    FROM "Click"
    WHERE "isWinner" = true
    GROUP BY player
    ORDER BY wins DESC
    LIMIT 10
  `;

  const results = await req.context.db.executeQuery(query);
  return res.json(results);
});
```

### Real-time Updates via WebSocket (3 hours)
- Use Ponder's subscription API
- Frontend listens for new GameWon events
- Auto-refresh history when new game completes

### Game Replay (4 hours)
- Show tile-by-tile click sequence
- Animate the game progression
- Highlight winning tile

## Cost Analysis

**The Graph (Hosted Service):**
- Free tier: 100k queries/month
- Paid: ~$100/month for 1M queries

**Ponder + Neon DB + Railway:**
- **Neon DB Free Tier:**
  - 0.5GB storage
  - 10GB/month data transfer
  - No auto-pause (always available)
  - **Cost: $0/month** ✅

- **Railway Free Tier:**
  - $5 credit/month
  - Enough for Ponder instance (~512MB RAM)
  - **Cost: $0/month** ✅

- **Paid (if needed):**
  - Neon Pro: $19/month (3GB storage, 100GB transfer)
  - Railway: $5-15/month (depends on usage)
  - **Total: ~$24-34/month**

**Recommendation:** Start with free tiers (Neon + Railway), should handle 1000s of games/month at zero cost.

## Migration Path

1. **Week 1-2:** Implement Ponder indexer
2. **Week 3:** Test on Base Sepolia
3. **Week 4:** Deploy to production (Base mainnet)
4. **Later:** Consider The Graph if scaling beyond 10k+ games

## Open Questions

1. How far back should history go? (All games or last N games?)
2. Do we need real-time updates in History tab?
3. Should we store game grid state (which tiles were clicked)?
4. Do we want user profiles/stats pages?

## Next Steps

1. ✅ Review this plan
2. ⬜ Set up Ponder locally
3. ⬜ Implement Phase 1-2 (schema + handlers)
4. ⬜ Test with existing Base Sepolia deployment
5. ⬜ Implement frontend (Phase 4)
6. ⬜ Deploy to Railway (Phase 5)
