// ============================================================
// CLIENT WORLD MANAGER — stores tiles received from server
// ============================================================

import type { Tile, SerializedChunk } from '../../../shared/src/types.js';
import { tileKey, tileToChunk, chunkKey, CHUNK_SIZE } from '../../../shared/src/types.js';

export class ClientWorldManager {
  private tiles = new Map<string, Tile>();
  private loadedChunks = new Set<string>();

  ingestChunk(chunk: SerializedChunk): void {
    const key = chunkKey(chunk.cx, chunk.cy);
    this.loadedChunks.add(key);

    for (const [k, tile] of Object.entries(chunk.tiles)) {
      this.tiles.set(k, tile);
    }
  }

  setTile(tile: Tile): void {
    this.tiles.set(tileKey(tile.x, tile.y), tile);
  }

  removePlant(tile: Tile): void {
    const existing = this.tiles.get(tileKey(tile.x, tile.y));
    if (existing) {
      this.tiles.set(tileKey(tile.x, tile.y), {
        ...existing,
        plant: undefined,
        ownerId: undefined,
        ownerName: undefined,
        glowing: false,
        rare: false,
      });
    }
  }

  getTile(x: number, y: number): Tile | undefined {
    return this.tiles.get(tileKey(x, y));
  }

  // Returns all tiles in view rect
  getTilesInRect(
    minX: number, maxX: number,
    minY: number, maxY: number
  ): Tile[] {
    const result: Tile[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = this.tiles.get(tileKey(x, y));
        if (tile) result.push(tile);
      }
    }
    return result;
  }

  hasChunk(cx: number, cy: number): boolean {
    return this.loadedChunks.has(chunkKey(cx, cy));
  }

  chunkAt(x: number, y: number): { cx: number; cy: number } {
    return tileToChunk(x, y);
  }
}

export const clientWorld = new ClientWorldManager();
