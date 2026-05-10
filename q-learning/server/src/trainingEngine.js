// ============================================================
// TRAINING ENGINE
//
// Two modes:
//   TRAINING — run episodes fast (no tick delay), stream stats
//   MATCH    — slow tick, agents use learned policy, live view
//
// Architecture:
//   - Training loop runs in setImmediate bursts (non-blocking)
//   - Every BROADCAST_EVERY episodes → emit training_update
//   - Match mode uses same agents but at human-viewable speed
// ============================================================

const { QLearningAgent } = require('./agent.js');
const { World } = require('./world.js');
const {
  WIN_SCORE, TICK_MS, GRID_W, GRID_H,
  MAX_STEPS_PER_EP, EPISODES_PER_BURST, REWARDS, QL_DEFAULTS,
} = require('../../shared/constants.js');

const AGENT_A_START = { x: 2,         y: 2 };
const AGENT_B_START = { x: GRID_W-3,  y: GRID_H-3 };
const BROADCAST_EVERY = 10;  // emit to clients every N training episodes
const HEATMAP_EVERY   = 20;  // send heatmap (more expensive) every N episodes

class TrainingEngine {
  constructor(io) {
    this.io = io;
    this.world      = new World();
    this.trainWorld = new World(); // separate world for training runs

    this.agentA = new QLearningAgent('A', 'ALPHA', '#00ffff',
      AGENT_A_START.x, AGENT_A_START.y);
    this.agentB = new QLearningAgent('B', 'BETA', '#ff00ff',
      AGENT_B_START.x, AGENT_B_START.y);

    // State machine: 'idle' | 'training' | 'match'
    this.mode        = 'idle';
    this.matchTick   = 0;
    this.matchTimer  = null;
    this.trainHandle = null;   // setImmediate handle
    this.totalEpisodes = 0;

    // Cumulative reward tracking for chart (smoothed)
    this.rewardHistoryA = [];
    this.rewardHistoryB = [];
  }

  // ── Public controls ───────────────────────────────────────

  startTraining() {
    if (this.mode === 'training') return;
    this._stopMatch();
    this.mode = 'training';
    this.io.emit('mode_change', { mode: 'training' });
    this._scheduleBurst();
  }

  stopTraining() {
    if (this.trainHandle) { clearImmediate(this.trainHandle); this.trainHandle = null; }
    this.mode = 'idle';
    this.io.emit('mode_change', { mode: 'idle' });
  }

  startMatch() {
    this._stopTraining();
    this.mode = 'match';
    this.matchTick = 0;
    this.world.reset();
    this.agentA.startEpisode();
    this.agentB.startEpisode();
    this.io.emit('mode_change', { mode: 'match' });
    this.io.emit('match_start', this._matchState());
    this.matchTimer = setInterval(() => this._matchTick(), TICK_MS);
  }

  resetAll() {
    this._stopTraining();
    this._stopMatch();
    this.agentA = new QLearningAgent('A', 'ALPHA', '#00ffff',
      AGENT_A_START.x, AGENT_A_START.y);
    this.agentB = new QLearningAgent('B', 'BETA', '#ff00ff',
      AGENT_B_START.x, AGENT_B_START.y);
    this.world.reset();
    this.trainWorld.reset();
    this.totalEpisodes = 0;
    this.mode = 'idle';
    this.io.emit('full_reset', this._fullState());
  }

  updateParams(agentId, params) {
    const agent = agentId === 'A' ? this.agentA : this.agentB;
    agent.updateParams(params);
    this.io.emit('params_updated', { agentId, params });
  }

  // ── Training loop ─────────────────────────────────────────
  // Runs EPISODES_PER_BURST episodes per setImmediate call
  // so the Node.js event loop stays responsive for Socket.io

  _scheduleBurst() {
    if (this.mode !== 'training') return;
    this.trainHandle = setImmediate(() => this._runBurst());
  }

  _runBurst() {
    const start = Date.now();

    for (let e = 0; e < EPISODES_PER_BURST; e++) {
      this._runEpisode();
      this.totalEpisodes++;
    }

    // Broadcast every BROADCAST_EVERY episodes
    if (this.totalEpisodes % BROADCAST_EVERY === 0) {
      const includeHeatmap = this.totalEpisodes % HEATMAP_EVERY === 0;
      this.io.emit('training_update', this._trainingState(includeHeatmap));
    }

    // Continue burst if still training
    this._scheduleBurst();
  }

  // ── Single training episode ───────────────────────────────

  _runEpisode() {
    this.trainWorld.reset();
    this.agentA.startEpisode();
    this.agentB.startEpisode();

    let epRewardA = 0, epRewardB = 0;

    for (let step = 0; step < MAX_STEPS_PER_EP; step++) {
      // Agent A turn
      const stateA  = this.agentA.encodeState(this.trainWorld, this.agentB);
      const actionA = this.agentA.selectAction(stateA);
      const resultA = this.agentA.executeAction(actionA, this.trainWorld, this.agentB);
      const nextSA  = this.agentA.encodeState(this.trainWorld, this.agentB);

      let rewardA = resultA.reward;
      if (this.agentA.score >= WIN_SCORE) rewardA += REWARDS.win;
      this.agentA.update(stateA, actionA, rewardA, nextSA);
      epRewardA += rewardA;

      // Agent B turn
      const stateB  = this.agentB.encodeState(this.trainWorld, this.agentA);
      const actionB = this.agentB.selectAction(stateB);
      const resultB = this.agentB.executeAction(actionB, this.trainWorld, this.agentA);
      const nextSB  = this.agentB.encodeState(this.trainWorld, this.agentA);

      let rewardB = resultB.reward;
      if (this.agentB.score >= WIN_SCORE) rewardB += REWARDS.win;
      if (this.agentA.score >= WIN_SCORE) rewardB += REWARDS.lose;
      this.agentB.update(stateB, actionB, rewardB, nextSB);
      epRewardB += rewardB;

      // Early exit on win
      if (this.agentA.score >= WIN_SCORE || this.agentB.score >= WIN_SCORE) break;
    }

    this.agentA.endEpisode(epRewardA);
    this.agentB.endEpisode(epRewardB);
  }

  // ── Match tick (human-viewable) ───────────────────────────

  _matchTick() {
    this.matchTick++;

    // Agents use greedy policy (ε = 0 effectively) during match
    const savedEpA = this.agentA.epsilon;
    const savedEpB = this.agentB.epsilon;
    this.agentA.epsilon = 0.05;
    this.agentB.epsilon = 0.05;

    const stateA  = this.agentA.encodeState(this.world, this.agentB);
    const actionA = this.agentA.selectAction(stateA);
    this.agentA.executeAction(actionA, this.world, this.agentB);

    const stateB  = this.agentB.encodeState(this.world, this.agentA);
    const actionB = this.agentB.selectAction(stateB);
    this.agentB.executeAction(actionB, this.world, this.agentA);

    this.agentA.epsilon = savedEpA;
    this.agentB.epsilon = savedEpB;

    const winner = this.agentA.score >= WIN_SCORE ? 'A'
      : this.agentB.score >= WIN_SCORE ? 'B' : null;

    // Emit heatmaps every 5 match ticks (manageable)
    const includeHeatmap = this.matchTick % 5 === 0;
    this.io.emit('match_tick', {
      ...this._matchState(),
      actionA: { action: this.agentA.lastQ?.action, ...this.agentA.lastQ },
      actionB: { action: this.agentB.lastQ?.action, ...this.agentB.lastQ },
      heatmapA: includeHeatmap ? this.agentA.exportQHeatmap(this.world, this.agentB) : null,
      heatmapB: includeHeatmap ? this.agentB.exportQHeatmap(this.world, this.agentA) : null,
      winner,
    });

    if (winner) {
      clearInterval(this.matchTimer);
      this.mode = 'idle';
      this.io.emit('match_over', {
        winner,
        agentA: this.agentA.getState(),
        agentB: this.agentB.getState(),
        totalTicks: this.matchTick,
      });
    }
  }

  // ── State builders ────────────────────────────────────────

  _trainingState(includeHeatmap = false) {
    return {
      totalEpisodes: this.totalEpisodes,
      agentA: this.agentA.getState(),
      agentB: this.agentB.getState(),
      heatmapA: includeHeatmap
        ? this.agentA.exportQHeatmap(this.trainWorld, this.agentB) : null,
      heatmapB: includeHeatmap
        ? this.agentB.exportQHeatmap(this.trainWorld, this.agentA) : null,
    };
  }

  _matchState() {
    return {
      tick: this.matchTick,
      world: this.world.serialize(),
      agentA: this.agentA.getState(),
      agentB: this.agentB.getState(),
      stats: this.world.getStats('A', 'B'),
      winScore: WIN_SCORE,
    };
  }

  _fullState() {
    return {
      mode: this.mode,
      totalEpisodes: this.totalEpisodes,
      agentA: this.agentA.getState(),
      agentB: this.agentB.getState(),
      world: this.world.serialize(),
      winScore: WIN_SCORE,
    };
  }

  _stopTraining() {
    if (this.trainHandle) { clearImmediate(this.trainHandle); this.trainHandle = null; }
  }

  _stopMatch() {
    if (this.matchTimer) { clearInterval(this.matchTimer); this.matchTimer = null; }
  }

  getFullState() { return this._fullState(); }
}

module.exports = { TrainingEngine };
