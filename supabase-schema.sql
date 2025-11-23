-- Basesweeper Game History Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Games table: stores all games (active and completed)
CREATE TABLE IF NOT EXISTS games (
  id BIGINT PRIMARY KEY,
  pool BIGINT NOT NULL DEFAULT 0,
  winner TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  clicked_mask BIGINT NOT NULL DEFAULT 0,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clicks table: stores all revealed clicks
CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id),
  request_id BIGINT NOT NULL,
  player TEXT NOT NULL,
  tile_index INTEGER NOT NULL,
  target_block BIGINT NOT NULL,
  clicked_at BIGINT NOT NULL,
  revealed BOOLEAN NOT NULL DEFAULT false,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  refunded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pending clicks table: stores clicks awaiting reveal
CREATE TABLE IF NOT EXISTS pending_clicks (
  id BIGINT PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id),
  player TEXT NOT NULL,
  tile_index INTEGER NOT NULL,
  target_block BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_games_active ON games(active);
CREATE INDEX IF NOT EXISTS idx_games_ended_at ON games(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_game_id ON clicks(game_id);
CREATE INDEX IF NOT EXISTS idx_clicks_player ON clicks(player);
CREATE INDEX IF NOT EXISTS idx_pending_clicks_game_id ON pending_clicks(game_id);
CREATE INDEX IF NOT EXISTS idx_pending_clicks_target_block ON pending_clicks(target_block);

-- Enable Row Level Security (RLS) but allow public read access
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_clicks ENABLE ROW LEVEL SECURITY;

-- Allow public read access (since this is game history)
CREATE POLICY "Allow public read access on games" ON games
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on clicks" ON clicks
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on pending_clicks" ON pending_clicks
  FOR SELECT USING (true);

-- Allow service role (indexer) to write
-- Note: You'll need to use the service_role key in your indexer, not the anon key
