// ============================================================
// PLAYER MANAGER — tracks online players and their state
// ============================================================

import { v4 as uuid } from 'uuid';
import type Database from 'better-sqlite3';
import type { Player } from '../../../shared/src/types.js';
import { PLAYER_COLORS, PLAYER_AVATARS, MAX_SEEDS } from '../../../shared/src/types.js';
import { upsertPlayer, getPlayer } from '../db/database.js';

// Cyberpunk name generator
const PREFIXES = ['Neo', 'Ghost', 'Null', 'Void', 'Neon', 'Hex', 'Byte', 'Syn', 'Rogue', 'Data', 'Zero', 'Xen', 'Arc', 'Flux'];
const SUFFIXES = ['Runner', 'Hacker', 'Blade', 'Wire', 'Drift', 'Link', 'Shade', 'Core', 'Pulse', 'Node', 'Grid', 'Echo'];

function generateName(): string {
  const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const s = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  const n = Math.floor(Math.random() * 99);
  return `${p}${s}${n}`;
}

export class PlayerManager {
  private online = new Map<string, Player>(); // socketId → Player
  private db: Database.Database;
  private seedRegenInterval: ReturnType<typeof setInterval>;

  constructor(db: Database.Database) {
    this.db = db;
    // Regenerate 1 seed every 30s for all online players
    this.seedRegenInterval = setInterval(() => {
      for (const player of this.online.values()) {
        if (player.seeds < MAX_SEEDS) {
          player.seeds = Math.min(player.seeds + 1, MAX_SEEDS);
        }
      }
    }, 30000);
  }

  createPlayer(socketId: string): Player {
    const colorIdx = Math.floor(Math.random() * PLAYER_COLORS.length);
    const avatarIdx = Math.floor(Math.random() * PLAYER_AVATARS.length);

    // Spread spawns around origin
    const spawnX = Math.floor((Math.random() - 0.5) * 20);
    const spawnY = Math.floor((Math.random() - 0.5) * 20);

    const player: Player = {
      id: socketId,
      name: generateName(),
      x: spawnX,
      y: spawnY,
      color: PLAYER_COLORS[colorIdx],
      avatar: PLAYER_AVATARS[avatarIdx],
      seeds: 14,
      lastSeen: Date.now(),
      isOnline: true,
    };

    this.online.set(socketId, player);
    upsertPlayer(this.db, player);
    return player;
  }

  getPlayer(socketId: string): Player | undefined {
    return this.online.get(socketId);
  }

  removePlayer(socketId: string): Player | undefined {
    const player = this.online.get(socketId);
    if (player) {
      player.lastSeen = Date.now();
      player.isOnline = false;
      upsertPlayer(this.db, player);
      this.online.delete(socketId);
    }
    return player;
  }

  movePlayer(socketId: string, x: number, y: number): boolean {
    const player = this.online.get(socketId);
    if (!player) return false;

    // Anti-speed-hack: max 2 tiles per move
    const dx = Math.abs(x - player.x);
    const dy = Math.abs(y - player.y);
    if (dx > 2 || dy > 2) return false;

    player.x = x;
    player.y = y;
    player.lastSeen = Date.now();
    return true;
  }

  consumeSeeds(socketId: string, amount: number): boolean {
    const player = this.online.get(socketId);
    if (!player || player.seeds < amount) return false;
    player.seeds -= amount;
    return true;
  }

  getNearbyPlayers(x: number, y: number, radius = 40): Player[] {
    const nearby: Player[] = [];
    for (const player of this.online.values()) {
      const dx = Math.abs(player.x - x);
      const dy = Math.abs(player.y - y);
      if (dx <= radius && dy <= radius) {
        nearby.push({ ...player });
      }
    }
    return nearby;
  }

  getOnlineCount(): number {
    return this.online.size;
  }

  getAllOnline(): Player[] {
    return Array.from(this.online.values()).map(p => ({ ...p }));
  }
}
