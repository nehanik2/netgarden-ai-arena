// ============================================================
// WORLD MANAGER — authoritative server-side world state
// Merges DB persistence with procedural generation
// ============================================================

import type Database from 'better-sqlite3';
import type { Tile, Player, SerializedChunk, WeatherType, Season } from '../../../shared/src/types.js';
import { CHUNK_SIZE, tileKey, chunkKey, tileToChunk, PLANT_DEFS } from '../../../shared/src/types.js';
import { generateChunk } from './worldGen.js';
import { getChunkTiles, upsertTile, removePlant, getTile } from '../db/database.js';

interface LoadedChunk {
  tiles: Map<string, Tile>;
  lastAccessed: number;
}

export class WorldManager {
  private chunks = new Map<string, LoadedChunk>();
  private db: Database.Database;
  
  // Weather & season cycle
  public weather: WeatherType = 'clear';
  public season: Season = 'spring';
  private weatherTimer = 0;

  constructor(db: Database.Database) {
    this.db = db;
    this.startWeatherCycle();
    this.startSeasonCycle();
    this.startChunkUnloader();
  }

  // ── Chunk loading ──────────────────────────────────────────

  getChunk(cx: number, cy: number): LoadedChunk {
    const key = chunkKey(cx, cy);
    if (this.chunks.has(key)) {
      const chunk = this.chunks.get(key)!;
      chunk.lastAccessed = Date.now();
      return chunk;
    }

    // Load from DB, overlay on procedural generation
    const generated = generateChunk(cx, cy, CHUNK_SIZE);
    const dbTiles = getChunkTiles(this.db, cx, cy, CHUNK_SIZE);

    // DB tiles override generated ones
    for (const tile of dbTiles) {
      generated.set(tileKey(tile.x, tile.y), tile);
    }

    const chunk: LoadedChunk = { tiles: generated, lastAccessed: Date.now() };
    this.chunks.set(key, chunk);
    return chunk;
  }

  serializeChunk(cx: number, cy: number): SerializedChunk {
    const chunk = this.getChunk(cx, cy);
    const tiles: Record<string, Tile> = {};
    for (const [key, tile] of chunk.tiles) {
      tiles[key] = tile;
    }
    return { cx, cy, tiles };
  }

  // ── Tile access ────────────────────────────────────────────

  getTile(x: number, y: number): Tile | undefined {
    const { cx, cy } = tileToChunk(x, y);
    const chunk = this.getChunk(cx, cy);
    return chunk.tiles.get(tileKey(x, y));
  }

  setTile(tile: Tile): void {
    const { cx, cy } = tileToChunk(tile.x, tile.y);
    const chunk = this.getChunk(cx, cy);
    chunk.tiles.set(tileKey(tile.x, tile.y), tile);
    upsertTile(this.db, tile); // persist
  }

  // ── Plant operations ───────────────────────────────────────

  plantAt(
    x: number,
    y: number,
    plantType: keyof typeof PLANT_DEFS,
    player: Player
  ): { success: boolean; error?: string; tile?: Tile } {
    const tile = this.getTile(x, y);
    if (!tile) return { success: false, error: 'Invalid tile' };
    if (tile.terrain === '#' || tile.terrain === '~') {
      return { success: false, error: 'Cannot plant here' };
    }
    if (tile.plant) return { success: false, error: 'Tile occupied' };

    const def = PLANT_DEFS[plantType];
    if (!def) return { success: false, error: 'Unknown plant' };
    if (player.seeds < def.seedCost) return { success: false, error: 'Not enough seeds' };

    const updated: Tile = {
      ...tile,
      plant: plantType,
      ownerId: player.id,
      ownerName: player.name,
      timestamp: Date.now(),
      glowing: def.rare,
      rare: def.rare,
    };

    this.setTile(updated);
    return { success: true, tile: updated };
  }

  removePlantAt(
    x: number,
    y: number,
    playerId: string
  ): { success: boolean; error?: string; tile?: Tile } {
    const tile = this.getTile(x, y);
    if (!tile) return { success: false, error: 'Invalid tile' };
    if (!tile.plant) return { success: false, error: 'Nothing to remove' };
    if (tile.ownerId && tile.ownerId !== playerId) {
      return { success: false, error: "Cannot remove another player's plant" };
    }

    const updated: Tile = {
      ...tile,
      plant: undefined,
      ownerId: undefined,
      ownerName: undefined,
      timestamp: undefined,
      message: undefined,
      glowing: false,
      rare: false,
    };

    this.setTile(updated);
    removePlant(this.db, x, y);
    return { success: true, tile: updated };
  }

  // ── Nearby chunk serialization for initial join ────────────

  getNearbyChunks(playerX: number, playerY: number, radius = 1): SerializedChunk[] {
    const { cx, cy } = tileToChunk(playerX, playerY);
    const chunks: SerializedChunk[] = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        chunks.push(this.serializeChunk(cx + dx, cy + dy));
      }
    }
    return chunks;
  }

  // ── Weather system ─────────────────────────────────────────

  private startWeatherCycle() {
    const weathers: WeatherType[] = ['clear', 'clear', 'clear', 'rain', 'snow', 'storm', 'glitch'];
    const cycle = () => {
      const roll = Math.random();
      if (roll < 0.6) this.weather = 'clear';
      else this.weather = weathers[Math.floor(Math.random() * weathers.length)];
      this.weatherTimer = setTimeout(cycle, 60000 + Math.random() * 120000);
    };
    this.weatherTimer = setTimeout(cycle, 30000) as unknown as number;
  }

  private startSeasonCycle() {
    const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % 4;
      this.season = seasons[idx];
    }, 10 * 60 * 1000); // change every 10 minutes
  }

  // ── Chunk unloader (memory management) ────────────────────

  private startChunkUnloader() {
    setInterval(() => {
      const threshold = Date.now() - 5 * 60 * 1000; // unload after 5min idle
      for (const [key, chunk] of this.chunks) {
        if (chunk.lastAccessed < threshold) {
          this.chunks.delete(key);
        }
      }
    }, 60000);
  }
}
