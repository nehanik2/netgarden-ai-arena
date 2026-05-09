// ============================================================
// SERVER ENTRY POINT
// Express + Socket.io + World/Player systems
// ============================================================

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initDatabase } from './db/database.js';
import { WorldManager } from './systems/worldManager.js';
import { PlayerManager } from './systems/playerManager.ts';
import type { C2S, S2C } from '../../shared/src/types.js';
import { PLANT_DEFS, tileToChunk } from '../../shared/src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '3001');
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ── Init systems ───────────────────────────────────────────

const db = initDatabase();
const world = new WorldManager(db);
const players = new PlayerManager(db);

// ── Express app ────────────────────────────────────────────

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    online: players.getOnlineCount(),
    weather: world.weather,
    season: world.season,
    uptime: process.uptime(),
  });
});

// ── HTTP + Socket.io server ────────────────────────────────

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
  pingTimeout: 30000,
  pingInterval: 10000,
});

// Rate limiter per socket (events per second)
const rateLimits = new Map<string, { count: number; reset: number }>();

function isRateLimited(socketId: string, limit = 20): boolean {
  const now = Date.now();
  let state = rateLimits.get(socketId);
  if (!state || now > state.reset) {
    state = { count: 0, reset: now + 1000 };
    rateLimits.set(socketId, state);
  }
  state.count++;
  return state.count > limit;
}

// ── Socket.io event handlers ───────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Create player
  const player = players.createPlayer(socket.id);
  const nearbyPlayers = players.getNearbyPlayers(player.x, player.y);
  const { cx, cy } = tileToChunk(player.x, player.y);
  const chunk = world.serializeChunk(cx, cy);

  // Welcome packet
  socket.emit('welcome', { player, nearbyPlayers, chunk });

  // Notify others
  socket.broadcast.emit('player_joined', player);

  // Send weather + season
  socket.emit('weather', { type: world.weather, intensity: 0.6 });
  socket.emit('season', { season: world.season });

  // ── Move ──────────────────────────────────────────────────
  socket.on('move', (data: C2S['move']) => {
    if (isRateLimited(socket.id, 30)) return;
    const ok = players.movePlayer(socket.id, data.x, data.y);
    if (!ok) return;

    // Broadcast to nearby sockets
    socket.broadcast.emit('player_moved', { id: socket.id, x: data.x, y: data.y });

    // Check if player crossed a chunk boundary → send new chunk
    const p = players.getPlayer(socket.id)!;
    const { cx, cy } = tileToChunk(p.x, p.y);
    socket.emit('chunk_data', world.serializeChunk(cx, cy));
  });

  // ── Plant ─────────────────────────────────────────────────
  socket.on('plant', (data: C2S['plant']) => {
    if (isRateLimited(socket.id, 5)) return;
    const player = players.getPlayer(socket.id);
    if (!player) return;

    const def = PLANT_DEFS[data.plantType];
    if (!def) return;

    // Deduct seeds
    const ok = players.consumeSeeds(socket.id, def.seedCost);
    if (!ok) {
      socket.emit('error', { code: 'NO_SEEDS', message: 'Not enough seeds' });
      return;
    }

    const result = world.plantAt(data.x, data.y, data.plantType, player);
    if (!result.success || !result.tile) {
      // Refund seeds
      players.consumeSeeds(socket.id, -def.seedCost);
      socket.emit('error', { code: 'PLANT_FAIL', message: result.error ?? 'Failed' });
      return;
    }

    // Broadcast tile update
    io.emit('world_update', { type: 'tile_changed', tile: result.tile });

    // Send updated seed count
    socket.emit('welcome', {
      player: players.getPlayer(socket.id)!,
      nearbyPlayers: [],
      chunk: { cx: 0, cy: 0, tiles: {} },
    });
  });

  // ── Remove ────────────────────────────────────────────────
  socket.on('remove', (data: C2S['remove']) => {
    if (isRateLimited(socket.id)) return;
    const result = world.removePlantAt(data.x, data.y, socket.id);
    if (!result.success || !result.tile) {
      socket.emit('error', { code: 'REMOVE_FAIL', message: result.error ?? 'Failed' });
      return;
    }
    io.emit('world_update', { type: 'tile_removed', tile: result.tile });
    // Return some seeds for removing
    players.consumeSeeds(socket.id, -1);
  });

  // ── Chat ──────────────────────────────────────────────────
  socket.on('chat', (data: C2S['chat']) => {
    if (isRateLimited(socket.id, 3)) return;
    const player = players.getPlayer(socket.id);
    if (!player) return;

    const text = data.text.trim().slice(0, 120);
    if (!text) return;

    const message = {
      id: `${socket.id}-${Date.now()}`,
      playerId: socket.id,
      playerName: player.name,
      text,
      x: player.x,
      y: player.y,
      timestamp: Date.now(),
      worldMessage: data.worldMessage,
    };

    io.emit('chat_message', message);
  });

  // ── Request chunk ─────────────────────────────────────────
  socket.on('request_chunk', (data: C2S['request_chunk']) => {
    if (isRateLimited(socket.id, 10)) return;
    socket.emit('chunk_data', world.serializeChunk(data.cx, data.cy));
  });

  // ── Disconnect ────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    players.removePlayer(socket.id);
    io.emit('player_left', { id: socket.id });
    rateLimits.delete(socket.id);
  });
});

// ── Weather broadcast loop ─────────────────────────────────

setInterval(() => {
  io.emit('weather', { type: world.weather, intensity: 0.6 });
}, 60000);

httpServer.listen(PORT, () => {
  console.log(`🌐 Cyberpunk Garden server running on port ${PORT}`);
});
