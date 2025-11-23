import { ponder } from "@/generated";

// GameStarted: New game created
ponder.on("Basesweeper:GameStarted", async ({ event, context }) => {
  await context.db.Game.create({
    id: event.args.gameId,
    data: {
      pool: 0n,
      winner: undefined,
      active: true,
      clickedMask: 0n,
      startedAt: event.block.timestamp,
      endedAt: undefined,
    },
  });
});

// ClickPending: Player clicked a tile, waiting for reveal
ponder.on("Basesweeper:ClickPending", async ({ event, context }) => {
  const { gameId, requestId, player, tileIndex, targetBlock } = event.args;

  // Create pending click record
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
      refunded: false,
    },
  });
});

// TileClicked: Reveal shows player lost (not winning tile)
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

  // Mark all clicks on this tile as revealed
  const clicks = await context.db.Click.findMany({
    where: {
      gameId,
      tileIndex: Number(tileIndex),
      player,
    },
  });

  for (const click of clicks.items) {
    await context.db.Click.update({
      id: click.id,
      data: { revealed: true },
    });
  }

  // Remove from pending clicks
  const pendingClicks = await context.db.PendingClick.findMany({
    where: {
      gameId,
      tileIndex: Number(tileIndex),
      player,
    },
  });

  for (const pending of pendingClicks.items) {
    await context.db.PendingClick.delete({ id: pending.id });
  }
});

// GameWon: Player found the winning tile
ponder.on("Basesweeper:GameWon", async ({ event, context }) => {
  const { gameId, winner, payout } = event.args;

  // Update game record
  await context.db.Game.update({
    id: gameId,
    data: {
      winner,
      pool: payout,
      active: false,
      endedAt: event.block.timestamp,
    },
  });

  // Find and mark the winning click
  const clicks = await context.db.Click.findMany({
    where: {
      gameId,
      player: winner,
    },
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

  // Clear all pending clicks for this game
  const pendingClicks = await context.db.PendingClick.findMany({
    where: { gameId },
  });

  for (const pending of pendingClicks.items) {
    await context.db.PendingClick.delete({ id: pending.id });
  }
});

// ClickRefunded: Game ended before reveal, player refunded
ponder.on("Basesweeper:ClickRefunded", async ({ event, context }) => {
  const { gameId, tileIndex, player } = event.args;

  // Mark clicks as refunded
  const clicks = await context.db.Click.findMany({
    where: {
      gameId,
      player,
      tileIndex: Number(tileIndex),
    },
  });

  for (const click of clicks.items) {
    await context.db.Click.update({
      id: click.id,
      data: {
        revealed: true,
        refunded: true,
      },
    });
  }

  // Remove from pending
  const pendingClicks = await context.db.PendingClick.findMany({
    where: {
      gameId,
      player,
      tileIndex: Number(tileIndex),
    },
  });

  for (const pending of pendingClicks.items) {
    await context.db.PendingClick.delete({ id: pending.id });
  }
});
