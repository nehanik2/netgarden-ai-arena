// ============================================================
// SERVER — Express + Socket.io / Q-learning phase
// ============================================================

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const { TrainingEngine } = require('./src/trainingEngine.js');

const PORT = process.env.PORT || 3002;

const app  = express();
const httpServer = http.createServer(app);
const io   = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

const engine = new TrainingEngine(io);

io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);
  socket.emit('state_sync', engine.getFullState());

  socket.on('start_training', () => engine.startTraining());
  socket.on('stop_training',  () => engine.stopTraining());
  socket.on('start_match',    () => engine.startMatch());
  socket.on('reset_all',      () => engine.resetAll());

  socket.on('update_params', ({ agentId, params }) => {
    console.log(`[params] Agent ${agentId}`, params);
    engine.updateParams(agentId, params);
  });

  socket.on('disconnect', () => console.log(`[-] ${socket.id}`));
});

app.get('/api/health', (_req, res) => {
  const s = engine.getFullState();
  res.json({ ok: true, mode: s.mode, episodes: s.totalEpisodes });
});

httpServer.listen(PORT, () => {
  console.log(`🧠 netgarden-ai-arena [q-learning] on http://localhost:${PORT}`);
});
