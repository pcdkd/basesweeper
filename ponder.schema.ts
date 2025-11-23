import { onchainTable } from "ponder";

export const game = onchainTable("game", (t) => ({
  id: t.bigint().primaryKey(), // gameId
  pool: t.bigint().notNull(),
  winner: t.text(),
  active: t.boolean().notNull(),
  clickedMask: t.bigint().notNull(),
  startedAt: t.bigint().notNull(), // block timestamp
  endedAt: t.bigint(),
}));

export const click = onchainTable("click", (t) => ({
  id: t.text().primaryKey(), // `${gameId}-${requestId}`
  gameId: t.bigint().notNull(),
  requestId: t.bigint().notNull(),
  player: t.text().notNull(),
  tileIndex: t.integer().notNull(),
  targetBlock: t.bigint().notNull(),
  clickedAt: t.bigint().notNull(), // block timestamp
  revealed: t.boolean().notNull(),
  isWinner: t.boolean().notNull(),
  refunded: t.boolean().notNull(),
}));

export const pendingClick = onchainTable("pending_click", (t) => ({
  id: t.bigint().primaryKey(), // requestId
  gameId: t.bigint().notNull(),
  player: t.text().notNull(),
  tileIndex: t.integer().notNull(),
  targetBlock: t.bigint().notNull(),
  createdAt: t.bigint().notNull(),
}));
