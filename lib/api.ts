import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface Game {
  id: string;
  pool: string;
  winner?: string;
  active: boolean;
  clicked_mask: string;
  started_at: string;
  ended_at?: string;
}

export interface Click {
  id: string;
  game_id: string;
  request_id: string;
  player: string;
  tile_index: number;
  target_block: string;
  clicked_at: string;
  revealed: boolean;
  is_winner: boolean;
  refunded: boolean;
}

export interface UserStats {
  address: string;
  totalClicks: number;
  wins: number;
  totalSpent: string;
  totalWinnings: string;
  netProfit: string;
}

export interface LeaderboardEntry {
  player: string;
  wins: number;
}

export async function getGameHistory(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('active', false)
    .order('id', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to fetch game history: ${error.message}`);
  return data || [];
}

export async function getGameDetails(gameId: string): Promise<{ game: Game; clicks: Click[] }> {
  // Fetch game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameError) throw new Error(`Failed to fetch game: ${gameError.message}`);

  // Fetch clicks for this game
  const { data: clicks, error: clicksError } = await supabase
    .from('clicks')
    .select('*')
    .eq('game_id', gameId)
    .order('clicked_at', { ascending: true });

  if (clicksError) throw new Error(`Failed to fetch clicks: ${clicksError.message}`);

  return { game, clicks: clicks || [] };
}

export async function getUserStats(address: string): Promise<UserStats> {
  const lowerAddress = address.toLowerCase();

  // Get all clicks by this user
  const { data: clicks, error: clicksError } = await supabase
    .from('clicks')
    .select('*')
    .eq('player', lowerAddress);

  if (clicksError) throw new Error(`Failed to fetch user clicks: ${clicksError.message}`);

  if (!clicks || clicks.length === 0) {
    return {
      address: lowerAddress,
      totalClicks: 0,
      wins: 0,
      totalSpent: '0',
      totalWinnings: '0',
      netProfit: '0',
    };
  }

  // Calculate stats
  const totalClicks = clicks.length;
  const wins = clicks.filter(c => c.is_winner).length;
  const FEE = BigInt('800000000000000'); // 0.0008 ETH in wei

  // Total spent = number of non-refunded clicks * FEE
  const nonRefundedClicks = clicks.filter(c => !c.refunded).length;
  const totalSpent = (BigInt(nonRefundedClicks) * FEE).toString();

  // Total winnings = sum of pools from won games
  let totalWinnings = 0n;
  for (const click of clicks) {
    if (click.is_winner) {
      const { data: game } = await supabase
        .from('games')
        .select('pool')
        .eq('id', click.game_id)
        .single();

      if (game) {
        totalWinnings += BigInt(game.pool);
      }
    }
  }

  const netProfit = (totalWinnings - BigInt(totalSpent)).toString();

  return {
    address: lowerAddress,
    totalClicks,
    wins,
    totalSpent,
    totalWinnings: totalWinnings.toString(),
    netProfit,
  };
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  // Get all winning clicks
  const { data: winningClicks, error } = await supabase
    .from('clicks')
    .select('player')
    .eq('is_winner', true);

  if (error) throw new Error(`Failed to fetch leaderboard: ${error.message}`);

  if (!winningClicks || winningClicks.length === 0) {
    return [];
  }

  // Count wins per player
  const winsByPlayer: Record<string, number> = {};
  for (const click of winningClicks) {
    winsByPlayer[click.player] = (winsByPlayer[click.player] || 0) + 1;
  }

  // Convert to array and sort
  const leaderboard = Object.entries(winsByPlayer)
    .map(([player, wins]) => ({ player, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10);

  return leaderboard;
}

export async function getCurrentGame() {
  // Get the active game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('active', true)
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (gameError) {
    // No active game
    return { game: null, pendingClicks: [] };
  }

  // Get pending clicks for this game
  const { data: pendingClicks, error: pendingError } = await supabase
    .from('pending_clicks')
    .select('*')
    .eq('game_id', game.id)
    .order('created_at', { ascending: true });

  if (pendingError) throw new Error(`Failed to fetch pending clicks: ${pendingError.message}`);

  return { game, pendingClicks: pendingClicks || [] };
}
