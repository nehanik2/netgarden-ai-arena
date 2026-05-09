// ============================================================
// DATABASE — SQLite persistence layer via better-sqlite3
// Handles: tiles, players, messages
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Tile, Player } from '../../shared/src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/garden.db');

// Initialize DB + run migrations
export function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // better write performance
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tiles (
      x         INTEGER NOT NULL,
      y         INTEGER NOT NULL,
      terrain   TEXT    NOT NULL DEFAULT '.',
      plant     TEXT,
      owner_id  TEXT,
      owner_name TEXT,
      timestamp INTEGER,
      message   TEXT,
      glowing   INTEGER DEFAULT 0,
      rare      INTEGER DEFAULT 0,
      PRIMARY KEY (x, y)
    );

    CREATE TABLE IF NOT EXISTS players (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL,
      avatar     TEXT NOT NULL,
      seeds      INTEGER DEFAULT 14,
      last_x     INTEGER DEFAULT 0,
      last_y     INTEGER DEFAULT 0,
      last_seen  INTEGER,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT PRIMARY KEY,
      player_id  TEXT NOT NULL,
      player_name TEXT NOT NULL,
      text       TEXT NOT NULL,
      x          INTEGER NOT NULL,
      y          INTEGER NOT NULL,
      timestamp  INTEGER NOT NULL,
      world_msg  INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tiles_chunk
      ON tiles (x / 32, y / 32);
  `);

  return db;
}

// ── Tile operations ──────────────────────────────────────────

export function getChunkTiles(
  db: Database.Database,
  cx: number,
  cy: number,
  chunkSize = 32
): Tile[] {
  const minX = cx * chunkSize;
  const maxX = minX + chunkSize - 1;
  const minY = cy * chunkSize;
  const maxY = minY + chunkSize - 1;

  const rows = db
    .prepare(
      `SELECT x, y, terrain, plant, owner_id, owner_name, timestamp, message, glowing, rare
       FROM tiles
       WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?`
    )
    .all(minX, maxX, minY, maxY) as any[];

  return rows.map(rowToTile);
}

export function upsertTile(db: Database.Database, tile: Tile): void {
  db.prepare(`
    INSERT INTO tiles (x, y, terrain, plant, owner_id, owner_name, timestamp, message, glowing, rare)
    VALUES (@x, @y, @terrain, @plant, @ownerId, @ownerName, @timestamp, @message, @glowing, @rare)
    ON CONFLICT(x, y) DO UPDATE SET
      terrain    = excluded.terrain,
      plant      = excluded.plant,
      owner_id   = excluded.owner_id,
      owner_name = excluded.owner_name,
      timestamp  = excluded.timestamp,
      message    = excluded.message,
      glowing    = excluded.glowing,
      rare       = excluded.rare
  `).run({
    x: tile.x,
    y: tile.y,
    terrain: tile.terrain,
    plant: tile.plant ?? null,
    ownerId: tile.ownerId ?? null,
    ownerName: tile.ownerName ?? null,
    timestamp: tile.timestamp ?? null,
    message: tile.message ?? null,
    glowing: tile.glowing ? 1 : 0,
    rare: tile.rare ? 1 : 0,
  });
}

export function removePlant(db: Database.Database, x: number, y: number): void {
  db.prepare(
    `UPDATE tiles SET plant = NULL, owner_id = NULL, owner_name = NULL,
     timestamp = NULL, message = NULL, glowing = 0, rare = 0
     WHERE x = ? AND y = ?`
  ).run(x, y);
}

export function getTile(db: Database.Database, x: number, y: number): Tile | null {
  const row = db
    .prepare('SELECT * FROM tiles WHERE x = ? AND y = ?')
    .get(x, y) as any;
  return row ? rowToTile(row) : null;
}

// ── Player operations ────────────────────────────────────────

export function upsertPlayer(db: Database.Database, player: Player): void {
  db.prepare(`
    INSERT INTO players (id, name, color, avatar, seeds, last_x, last_y, last_seen, created_at)
    VALUES (@id, @name, @color, @avatar, @seeds, @x, @y, @lastSeen, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      name      = excluded.name,
      seeds     = excluded.seeds,
      last_x    = excluded.last_x,
      last_y    = excluded.last_y,
      last_seen = excluded.last_seen
  `).run({
    id: player.id,
    name: player.name,
    color: player.color,
    avatar: player.avatar,
    seeds: player.seeds,
    x: player.x,
    y: player.y,
    lastSeen: player.lastSeen,
    createdAt: Date.now(),
  });
}

export function getPlayer(db: Database.Database, id: string): Player | null {
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    avatar: row.avatar,
    seeds: row.seeds,
    x: row.last_x,
    y: row.last_y,
    lastSeen: row.last_seen,
    isOnline: false,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function rowToTile(row: any): Tile {
  return {
    x: row.x,
    y: row.y,
    terrain: row.terrain,
    plant: row.plant ?? undefined,
    ownerId: row.owner_id ?? undefined,
    ownerName: row.owner_name ?? undefined,
    timestamp: row.timestamp ?? undefined,
    message: row.message ?? undefined,
    glowing: row.glowing === 1,
    rare: row.rare === 1,
  };
}
