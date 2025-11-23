import { ponder } from "@/generated";

// Get all completed games (history)
ponder.get("/api/games", async (c) => {
  const games = await c.db.Game.findMany({
    where: { active: false },
    orderBy: { id: "desc" },
    limit: 50,
  });

  return c.json(games.items);
});

// Get specific game details with all clicks
ponder.get("/api/games/:id", async (c) => {
  const gameId = BigInt(c.req.param("id"));

  const game = await c.db.Game.findUnique({ id: gameId });

  if (!game) {
    return c.json({ error: "Game not found" }, 404);
  }

  const clicks = await c.db.Click.findMany({
    where: { gameId },
    orderBy: { clickedAt: "asc" },
  });

  return c.json({
    game,
    clicks: clicks.items,
  });
});

// Get user statistics
ponder.get("/api/users/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();

  const clicks = await c.db.Click.findMany({
    where: { player: address },
  });

  const wins = clicks.items.filter((click) => click.isWinner).length;
  const totalClicks = clicks.items.length;
  const totalSpent = BigInt(totalClicks) * 800000000000000n; // FEE = 0.0008 ETH

  // Calculate total winnings
  let totalWinnings = 0n;
  const winningClicks = clicks.items.filter((click) => click.isWinner);

  for (const click of winningClicks) {
    const game = await c.db.Game.findUnique({ id: click.gameId });
    if (game && game.pool) {
      totalWinnings += game.pool;
    }
  }

  return c.json({
    address,
    totalClicks,
    wins,
    totalSpent: totalSpent.toString(),
    totalWinnings: totalWinnings.toString(),
    netProfit: (totalWinnings - totalSpent).toString(),
  });
});

// Get leaderboard (top winners)
ponder.get("/api/leaderboard", async (c) => {
  const allClicks = await c.db.Click.findMany({
    where: { isWinner: true },
  });

  // Group by player and count wins
  const playerWins = new Map<string, number>();

  for (const click of allClicks.items) {
    const player = click.player.toLowerCase();
    playerWins.set(player, (playerWins.get(player) || 0) + 1);
  }

  // Convert to array and sort
  const leaderboard = Array.from(playerWins.entries())
    .map(([player, wins]) => ({ player, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10);

  return c.json(leaderboard);
});

// Get current game status
ponder.get("/api/current-game", async (c) => {
  const currentGame = await c.db.Game.findMany({
    where: { active: true },
    orderBy: { id: "desc" },
    limit: 1,
  });

  if (currentGame.items.length === 0) {
    return c.json({ error: "No active game" }, 404);
  }

  const game = currentGame.items[0];

  const clicks = await c.db.Click.findMany({
    where: { gameId: game.id },
  });

  const pendingClicks = await c.db.PendingClick.findMany({
    where: { gameId: game.id },
  });

  return c.json({
    game,
    clicks: clicks.items,
    pendingClicks: pendingClicks.items,
  });
});
