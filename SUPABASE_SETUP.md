# Supabase Indexer Setup Guide

This guide walks you through setting up the Supabase-based event indexer for Basesweeper game history.

## What is This Setup?

Instead of using Ponder (which had API compatibility issues), we've built a custom indexer that:
- Watches smart contract events using viem
- Stores event data in Supabase (PostgreSQL)
- Provides direct database access from the frontend
- Runs as a simple Node.js process

## Prerequisites

1. **Supabase Account** (free): https://supabase.com
2. **Base Sepolia RPC URL**: Use public endpoint or get one from Alchemy/Infura

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up (no credit card required)
2. Click **"New Project"**
3. Configure your project:
   - **Name**: `basesweeper-indexer`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is sufficient
4. Click **"Create new project"** (takes ~2 minutes to provision)

## Step 2: Run Database Schema

1. In your Supabase project dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy the contents of `supabase-schema.sql` from this repo
4. Paste into the SQL editor
5. Click **"Run"** (bottom right)
6. You should see: ✅ Success. No rows returned

This creates three tables:
- `games` - All games (active and completed)
- `clicks` - All revealed clicks
- `pending_clicks` - Clicks awaiting reveal

## Step 3: Get Supabase Credentials

1. In your Supabase dashboard, click **"Settings"** (gear icon)
2. Click **"API"** in the left sidebar
3. Copy the following values:

   **Project URL** (looks like `https://xxxxx.supabase.co`)
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
   ```

   **anon public** key (for frontend)
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

   **service_role** key (for indexer - has write permissions)
   ```
   SUPABASE_SERVICE_KEY=<your-service-role-key>
   ```

   ⚠️ **Important**: Never commit the service_role key to git! It has full database access.

## Step 4: Configure Environment Variables

Update `.env.local` in the project root:

```bash
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Base Sepolia RPC (use public endpoint or Alchemy)
PONDER_RPC_URL_84532=https://sepolia.base.org
```

## Step 5: Run the Indexer

Start the indexer in a separate terminal:

```bash
npm run indexer
```

You should see output like:
```
🚀 Starting Basesweeper indexer...
📦 Contract: 0x9d5C13f2B13a13773607D4F96eb1915A87777309
🔗 RPC: https://sepolia.base.org
💾 Supabase: https://xxxxx.supabase.co
📊 Current block: 34025000
🔄 Starting from block: 34005195
📜 Syncing historical events from 34005195 to 34025000...
  📥 Fetching events from block 34005195 to 34015195...
  Found 15 events
✅ Game 1 updated
⏳ Pending click 1 recorded for game 1
🔍 Tile 5 clicked in game 1 (not the winner)
🎉 Game 1 won by 0xc7a0b5e5e2f68d70e5d40b730500972ecfd56ad0! Payout: 1590000000000000
✅ Historical sync complete
👀 Watching for new events...
```

**First run will take a few minutes** to sync all historical events from the contract deployment.

## Step 6: Run the Frontend

In a separate terminal, run the Next.js frontend:

```bash
npm run dev
```

Navigate to http://localhost:3000 and click the **"History"** tab. You should see past games!

## Development Workflow

### Running Both Services

You'll need **two terminals**:

**Terminal 1: Indexer**
```bash
npm run indexer
```

**Terminal 2: Next.js Frontend**
```bash
npm run dev
```

### Restarting the Indexer

The indexer tracks which events it has processed. If you need to restart:
- Stop the indexer (`Ctrl+C`)
- Just run `npm run indexer` again
- It will resume from where it left off

### Clearing All Data (Fresh Start)

If you want to re-index from scratch:

1. Go to Supabase dashboard → **"Table Editor"**
2. Delete all rows from: `pending_clicks`, `clicks`, `games` (in that order)
3. Restart the indexer: `npm run indexer`

The indexer will re-sync all events from block 34005195.

## Verifying Data in Supabase

1. In Supabase dashboard, click **"Table Editor"**
2. Click on each table to see the data:
   - **games**: All games with pool amounts and winners
   - **clicks**: All tile clicks with outcomes
   - **pending_clicks**: Clicks waiting to be revealed

You can run SQL queries in the **SQL Editor**:

```sql
-- Get all completed games
SELECT * FROM games WHERE active = false ORDER BY id DESC;

-- Get all winning clicks
SELECT * FROM clicks WHERE is_winner = true;

-- Get pending clicks for current game
SELECT * FROM pending_clicks WHERE game_id = (
  SELECT id FROM games WHERE active = true LIMIT 1
);

-- Get stats for a specific player
SELECT
  COUNT(*) as total_clicks,
  COUNT(*) FILTER (WHERE is_winner = true) as wins,
  COUNT(*) FILTER (WHERE refunded = true) as refunds
FROM clicks
WHERE player = '0xc7a0b5e5e2f68d70e5d40b730500972ecfd56ad0';
```

## Architecture

### How It Works

```
┌─────────────────┐
│  Base Sepolia   │
│  Smart Contract │
└────────┬────────┘
         │ Events
         ▼
┌─────────────────┐
│     Indexer     │  (npm run indexer)
│   (Node.js)     │  - Watches events with viem
│                 │  - Writes to Supabase
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │
│   PostgreSQL    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Next.js App   │  (npm run dev)
│   (Frontend)    │  - Queries Supabase directly
│                 │  - Displays history
└─────────────────┘
```

### Events Indexed

The indexer watches for these contract events:

1. **GameStarted** - New game begins
2. **ClickPending** - Player clicks tile, waiting for reveal
3. **TileClicked** - Reveal shows losing tile
4. **GameWon** - Reveal shows winning tile
5. **ClickRefunded** - Late reveal after game ended

### Database Schema

**games table:**
- `id` - Game ID (bigint)
- `pool` - Current pool amount in wei (bigint as string)
- `winner` - Winning address (text, nullable)
- `active` - Is game still active? (boolean)
- `clicked_mask` - Bitmask of clicked tiles (bigint as string)
- `started_at` - Block number when started (bigint as string)
- `ended_at` - Block number when ended (bigint as string, nullable)

**clicks table:**
- `id` - Composite key: `{gameId}-{requestId}`
- `game_id` - Reference to game
- `request_id` - Unique request ID
- `player` - Player address (lowercase)
- `tile_index` - Tile that was clicked (0-8 for 3x3 grid)
- `target_block` - Block used for randomness
- `clicked_at` - Block number of click
- `revealed` - Has this been revealed?
- `is_winner` - Did this win the game?
- `refunded` - Was this refunded?

**pending_clicks table:**
- `id` - Request ID
- `game_id` - Reference to game
- `player` - Player address
- `tile_index` - Tile that was clicked
- `target_block` - Block when reveal can happen
- `created_at` - Block number of click

## Troubleshooting

### "Failed to fetch game history"

**Check if indexer is running:**
```bash
# Should show indexer process
ps aux | grep indexer
```

**Check indexer logs** - Look for error messages in the terminal running `npm run indexer`

**Verify Supabase connection:**
- Check your `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Test in Supabase dashboard → Table Editor (should see tables)

### "Error inserting into Supabase"

**Check service key:**
- Indexer needs `SUPABASE_SERVICE_KEY` (not the anon key!)
- Verify it's set in `.env.local`

**Check Row Level Security:**
- The schema should have created policies allowing public reads
- Service key should allow all operations

### "RPC error: Too many requests"

**Public RPC rate limiting:**
- Consider using Alchemy or Infura for better reliability
- Update `PONDER_RPC_URL_84532` in `.env.local`

### Indexer crashes or stops

**Memory issues:**
- Reduce batch size in `indexer/index.ts` (currently 10000 blocks)
- Change `BATCH_SIZE = 10000n` to `BATCH_SIZE = 1000n`

**RPC errors:**
- Add retry logic (indexer already retries after 10 seconds)
- Check RPC endpoint is responsive

### History tab shows old data

**Clear browser cache:**
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

**Verify indexer is running and processing new events:**
- Watch indexer terminal for new event logs

## Production Deployment

### Deploying the Indexer

You can deploy the indexer to any Node.js hosting service:

**Option 1: Railway**
1. Push your code to GitHub
2. Create new project on Railway.app
3. Connect GitHub repo
4. Add environment variables (SUPABASE_SERVICE_KEY, PONDER_RPC_URL_84532, etc.)
5. Set start command: `npm run indexer`

**Option 2: Render**
1. Create new Web Service on render.com
2. Connect GitHub repo
3. Build command: `npm install`
4. Start command: `npm run indexer`
5. Add environment variables

**Option 3: VPS (Digital Ocean, AWS EC2, etc.)**
```bash
# SSH into server
git clone <your-repo>
cd basesweeper
npm install
# Add .env with production values
npm install -g pm2
pm2 start npm --name basesweeper-indexer -- run indexer
pm2 save
pm2 startup
```

### Frontend Deployment

Deploy Next.js app to Vercel (recommended):
```bash
vercel
```

Make sure to set environment variables in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Cost Estimate

**Free tier is sufficient for development and low-traffic production:**

- **Supabase**: Free tier includes
  - 500MB database
  - 50,000 monthly active users
  - 2GB bandwidth
  - Unlimited API requests

- **RPC**: Public Base Sepolia endpoint is free (rate limited)

- **Hosting** (for production):
  - Railway: $5/month credit (enough for indexer)
  - Render: Free tier available
  - Vercel: Free for frontend

**Total cost: $0/month** (using free tiers)

## Files Reference

```
/basesweeper
  supabase-schema.sql        # Database schema (run in Supabase SQL Editor)
  indexer/
    index.ts                 # Main indexer script
  lib/
    api.ts                   # Frontend Supabase queries
  components/
    History.tsx              # History UI component
  .env.local                 # Environment variables (not in git)
  package.json               # Added "indexer" script
```

## Next Steps

Now that you have event indexing working:

1. **Add user profile pages** - Show individual player stats
2. **Add leaderboard component** - Display top winners
3. **Add game replay** - Visualize tile clicks for past games
4. **Add real-time updates** - Use Supabase Realtime for live updates
5. **Deploy to production** - Railway + Vercel

## Comparison: Supabase vs Ponder

| Feature | Ponder | Supabase |
|---------|--------|----------|
| **Setup complexity** | Medium | Easy |
| **API compatibility** | Breaking changes in v0.15 | Stable |
| **Query flexibility** | GraphQL + REST | Direct SQL + REST |
| **Learning curve** | Ponder-specific | Standard PostgreSQL |
| **Realtime updates** | Limited | Built-in (Supabase Realtime) |
| **Control** | Abstracted | Full SQL access |
| **Status** | ✅ Simple custom indexer | ✅ Production-ready |

We chose Supabase because:
- ✅ More control over data and queries
- ✅ Stable API (no breaking changes)
- ✅ Easier to debug (direct SQL access)
- ✅ Built-in realtime subscriptions
- ✅ Standard PostgreSQL (transferable knowledge)

## Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **Viem Docs** (for event watching): https://viem.sh/docs/contract/watchEvent
- **Base Sepolia Explorer**: https://sepolia.basescan.org
