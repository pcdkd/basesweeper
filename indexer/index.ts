// Basesweeper Event Indexer for Supabase
// This script watches contract events and writes them to Supabase

// Load environment variables from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createPublicClient, http, parseAbiItem, decodeEventLog, getEventSelector } from 'viem';
import { baseSepolia } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { BASESWEEPER_ABI, BASESWEEPER_ADDRESS } from '../contracts/abi';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!; // Use service key for write access
const RPC_URL = process.env.PONDER_RPC_URL_84532 || 'https://sepolia.base.org';
const START_BLOCK = 34005195n; // Deployment block

// Initialize clients
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Event selectors for matching
const EVENT_SELECTORS = {
  GameStarted: getEventSelector(parseAbiItem('event GameStarted(uint256 indexed gameId)')),
  ClickPending: getEventSelector(parseAbiItem('event ClickPending(uint256 indexed gameId, uint256 requestId, address indexed player, uint256 tileIndex, uint256 targetBlock)')),
  TileClicked: getEventSelector(parseAbiItem('event TileClicked(uint256 indexed gameId, uint256 requestId, address indexed player, uint256 tileIndex, uint256 newPool)')),
  GameWon: getEventSelector(parseAbiItem('event GameWon(uint256 indexed gameId, uint256 requestId, address indexed winner, uint256 tileIndex, uint256 payout)')),
  ClickRefunded: getEventSelector(parseAbiItem('event ClickRefunded(uint256 indexed gameId, uint256 tileIndex, address indexed player)'))
};

// Track last processed block to avoid duplicates
let lastProcessedBlock = START_BLOCK;

console.log('🚀 Starting Basesweeper indexer...');
console.log(`📦 Contract: ${BASESWEEPER_ADDRESS}`);
console.log(`🔗 RPC: ${RPC_URL}`);
console.log(`💾 Supabase: ${SUPABASE_URL}`);

// Helper to get current block for initial sync
async function getCurrentBlock() {
  return await publicClient.getBlockNumber();
}

// Helper to upsert game
async function upsertGame(gameId: bigint, updates: any) {
  const { error } = await supabase
    .from('games')
    .upsert({
      id: gameId.toString(),
      ...updates,
    }, {
      onConflict: 'id'
    });

  if (error) {
    console.error('❌ Error upserting game:', error);
  } else {
    console.log(`✅ Game ${gameId} updated`);
  }
}

// Handle GameStarted event
async function handleGameStarted(log: any) {
  const { gameId } = log.args;

  await upsertGame(gameId, {
    pool: '0',
    active: true,
    clicked_mask: '0',
    started_at: log.blockNumber.toString(),
  });
}

// Handle ClickPending event
async function handleClickPending(log: any) {
  const { gameId, requestId, player, tileIndex, targetBlock } = log.args;

  const { error } = await supabase
    .from('pending_clicks')
    .insert({
      id: requestId.toString(),
      game_id: gameId.toString(),
      player: player.toLowerCase(),
      tile_index: Number(tileIndex),
      target_block: targetBlock.toString(),
      created_at: log.blockNumber.toString(),
    });

  if (error) {
    console.error('❌ Error inserting pending click:', error);
  } else {
    console.log(`⏳ Pending click ${requestId} recorded for game ${gameId}`);
  }
}

// Handle TileClicked event
async function handleTileClicked(log: any) {
  const { gameId, requestId, player, tileIndex, newPool } = log.args;

  // Insert click record
  const { error: clickError } = await supabase
    .from('clicks')
    .insert({
      id: `${gameId}-${requestId}`,
      game_id: gameId.toString(),
      request_id: requestId.toString(),
      player: player.toLowerCase(),
      tile_index: Number(tileIndex),
      target_block: '0', // We'll need to get this from pending_clicks
      clicked_at: log.blockNumber.toString(),
      revealed: true,
      is_winner: false,
      refunded: false,
    });

  if (clickError) {
    console.error('❌ Error inserting click:', clickError);
  }

  // Delete from pending clicks
  await supabase
    .from('pending_clicks')
    .delete()
    .eq('id', requestId.toString());

  // Update game pool and clicked_mask
  await upsertGame(gameId, {
    pool: newPool.toString(),
  });

  console.log(`🔍 Tile ${tileIndex} clicked in game ${gameId} (not the winner)`);
}

// Handle GameWon event
async function handleGameWon(log: any) {
  const { gameId, requestId, winner, tileIndex, payout } = log.args;

  // Insert winning click
  const { error: clickError } = await supabase
    .from('clicks')
    .insert({
      id: `${gameId}-${requestId}`,
      game_id: gameId.toString(),
      request_id: requestId.toString(),
      player: winner.toLowerCase(),
      tile_index: Number(tileIndex),
      target_block: '0',
      clicked_at: log.blockNumber.toString(),
      revealed: true,
      is_winner: true,
      refunded: false,
    });

  if (clickError) {
    console.error('❌ Error inserting winning click:', clickError);
  }

  // Delete from pending clicks
  await supabase
    .from('pending_clicks')
    .delete()
    .eq('id', requestId.toString());

  // Mark game as ended
  await upsertGame(gameId, {
    winner: winner.toLowerCase(),
    active: false,
    ended_at: log.blockNumber.toString(),
  });

  console.log(`🎉 Game ${gameId} won by ${winner}! Payout: ${payout}`);
}

// Handle ClickRefunded event
async function handleClickRefunded(log: any) {
  const { gameId, tileIndex, player } = log.args;

  // Find the pending click and mark as refunded
  // We need to find the requestId from the player/tileIndex/gameId combination
  const { data: pendingClicks } = await supabase
    .from('pending_clicks')
    .select('id')
    .eq('game_id', gameId.toString())
    .eq('player', player.toLowerCase())
    .eq('tile_index', Number(tileIndex))
    .limit(1);

  if (pendingClicks && pendingClicks.length > 0) {
    const requestId = pendingClicks[0].id;

    // Insert refunded click
    const { error: clickError } = await supabase
      .from('clicks')
      .insert({
        id: `${gameId}-${requestId}`,
        game_id: gameId.toString(),
        request_id: requestId,
        player: player.toLowerCase(),
        tile_index: Number(tileIndex),
        target_block: '0',
        clicked_at: log.blockNumber.toString(),
        revealed: false,
        is_winner: false,
        refunded: true,
      });

    if (clickError) {
      console.error('❌ Error inserting refunded click:', clickError);
    }

    // Delete from pending clicks
    await supabase
      .from('pending_clicks')
      .delete()
      .eq('id', requestId);

    console.log(`💸 Click refunded for game ${gameId}, player ${player}`);
  }
}

// Helper to process a single log
async function processLog(log: any) {
  if (!log.topics || !log.topics[0]) return;

  const eventTopic = log.topics[0];

  // Decode the event log using the full ABI
  const decoded = decodeEventLog({
    abi: BASESWEEPER_ABI,
    data: log.data,
    topics: log.topics as any,
  });

  // Create a log object with decoded args
  const logWithArgs = {
    ...log,
    args: decoded.args,
    eventName: decoded.eventName,
  };

  // Handle based on event type
  if (eventTopic === EVENT_SELECTORS.GameStarted) {
    await handleGameStarted(logWithArgs);
  } else if (eventTopic === EVENT_SELECTORS.ClickPending) {
    await handleClickPending(logWithArgs);
  } else if (eventTopic === EVENT_SELECTORS.TileClicked) {
    await handleTileClicked(logWithArgs);
  } else if (eventTopic === EVENT_SELECTORS.GameWon) {
    await handleGameWon(logWithArgs);
  } else if (eventTopic === EVENT_SELECTORS.ClickRefunded) {
    await handleClickRefunded(logWithArgs);
  }
}

// Watch for events
async function watchEvents() {
  try {
    const currentBlock = await getCurrentBlock();
    console.log(`📊 Current block: ${currentBlock}`);
    console.log(`🔄 Starting from block: ${START_BLOCK}`);

    // First, do historical sync if needed
    if (START_BLOCK < currentBlock) {
      console.log(`📜 Syncing historical events from ${START_BLOCK} to ${currentBlock}...`);
      await syncHistoricalEvents(START_BLOCK, currentBlock);
    }

    // Then watch for new events
    console.log('👀 Watching for new events...');

    // Watch all events
    publicClient.watchEvent({
      address: BASESWEEPER_ADDRESS,
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            await processLog(log);
          } catch (error) {
            console.error('❌ Error processing log:', error);
          }
        }
      },
    });

  } catch (error) {
    console.error('❌ Error watching events:', error);
    // Retry after delay
    setTimeout(watchEvents, 10000);
  }
}

// Sync historical events
async function syncHistoricalEvents(fromBlock: bigint, toBlock: bigint) {
  const BATCH_SIZE = 10000n; // Process in batches to avoid RPC limits

  for (let start = fromBlock; start <= toBlock; start += BATCH_SIZE) {
    const end = start + BATCH_SIZE - 1n > toBlock ? toBlock : start + BATCH_SIZE - 1n;

    console.log(`  📥 Fetching events from block ${start} to ${end}...`);

    try {
      const logs = await publicClient.getLogs({
        address: BASESWEEPER_ADDRESS,
        fromBlock: start,
        toBlock: end,
      });

      console.log(`  Found ${logs.length} events`);

      for (const log of logs) {
        await processLog(log);
      }
    } catch (error) {
      console.error(`  ❌ Error fetching logs for batch ${start}-${end}:`, error);
    }
  }

  console.log('✅ Historical sync complete');
}

// Start the indexer
watchEvents().catch(console.error);
