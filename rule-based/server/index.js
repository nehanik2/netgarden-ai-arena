// ============================================================
// SERVER — Express + Socket.io
// Serves client files + handles real-time game events
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { GameEngine } = require('./src/gameEngine.js');

const PORT = process.env.PORT || 3001;

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// Serve client static files
app.use(express.static(path.join(__dirname, '../client')));
// Also expose shared constants to client
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// Single game engine instance (all clients share the same match)
const engine = new GameEngine(io);

// ── Socket events ─────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] client ${socket.id}`);

  // Send current state on join
  socket.emit('state_sync', engine.getState());

  // Match control
  socket.on('match_start',  () => engine.start());
  socket.on('match_pause',  () => engine.pause());
  socket.on('match_resume', () => engine.resume());
  socket.on('match_reset',  () => engine.reset());

  // Live hyperparameter update — key feature
  socket.on('update_weights', ({ agentId, weights }) => {
    console.log(`[weights] Agent ${agentId}:`, weights);
    engine.updateWeights(agentId, weights);
  });

  socket.on('disconnect', () => {
    console.log(`[-] client ${socket.id}`);
  });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, tick: engine.getState().tick, running: engine.getState().running });
});

httpServer.listen(PORT, () => {
  console.log(`🌿 netgarden-ai-arena [rule-based] running on http://localhost:${PORT}`);
});
