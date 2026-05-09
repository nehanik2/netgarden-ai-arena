// ============================================================
// GAME ENGINE — orchestrates the match loop
// Manages agents, ticks, win detection, state broadcast
// ============================================================

const { RuleBasedAgent } = require('./agent.js');
const { World } = require('./world.js');
const { WIN_SCORE, TICK_MS, PRESETS, GRID_W, GRID_H } = require('../../shared/constants.js');

const AGENT_A_START = { x: 2, y: 2 };
const AGENT_B_START = { x: GRID_W - 3, y: GRID_H - 3 };

class GameEngine {
  constructor(io) {
    this.io = io;
    this.world = new World();
    this.tickTimer = null;
    this.tick = 0;
    this.running = false;
    this.winner = null;
    this.tickLog = []; // full match event history

    // Init agents with balanced preset
    this.agentA = new RuleBasedAgent(
      'A', 'ALPHA', '#00ffff',
      AGENT_A_START.x, AGENT_A_START.y,
      { ...PRESETS.balanced.weights }
    );
    this.agentB = new RuleBasedAgent(
      'B', 'BETA', '#ff00ff',
      AGENT_B_START.x, AGENT_B_START.y,
      { ...PRESETS.territorial.weights }
    );
  }

  // ── Match control ─────────────────────────────────────────

  start() {
    if (this.running) return;
    this.running = true;
    this.winner = null;
    this.tick = 0;
    this.tickLog = [];
    this.io.emit('match_start', this._fullState());
    this.tickTimer = setInterval(() => this._doTick(), TICK_MS);
  }

  pause() {
    if (!this.running) return;
    clearInterval(this.tickTimer);
    this.running = false;
    this.io.emit('match_paused', { tick: this.tick });
  }

  resume() {
    if (this.running || this.winner) return;
    this.running = true;
    this.tickTimer = setInterval(() => this._doTick(), TICK_MS);
    this.io.emit('match_resumed', { tick: this.tick });
  }

  reset() {
    clearInterval(this.tickTimer);
    this.running = false;
    this.winner = null;
    this.tick = 0;
    this.tickLog = [];
    this.world.reset();
    this.agentA.x = AGENT_A_START.x; this.agentA.y = AGENT_A_START.y;
    this.agentA.score = 0; this.agentA.plantCount = 0; this.agentA.decisionLog = [];
    this.agentB.x = AGENT_B_START.x; this.agentB.y = AGENT_B_START.y;
    this.agentB.score = 0; this.agentB.plantCount = 0; this.agentB.decisionLog = [];
    this.io.emit('match_reset', this._fullState());
  }

  // ── Tick ──────────────────────────────────────────────────

  _doTick() {
    this.tick++;

    // Each agent decides and acts
    const actionA = this.agentA.decide(this.world, this.agentB);
    const actionB = this.agentB.decide(this.world, this.agentA);

    this.agentA.applyAction(actionA, this.world);
    this.agentB.applyAction(actionB, this.world);

    // Build tick event
    const event = {
      tick: this.tick,
      agentA: this.agentA.getState(),
      agentB: this.agentB.getState(),
      actionA,
      actionB,
      world: this.world.serialize(),
      stats: this.world.getStats('A', 'B'),
    };

    this.tickLog.push({ tick: this.tick, actionA, actionB });

    // Win check
    if (this.agentA.score >= WIN_SCORE || this.agentB.score >= WIN_SCORE) {
      this.winner = this.agentA.score >= WIN_SCORE ? 'A' : 'B';
      clearInterval(this.tickTimer);
      this.running = false;
      this.io.emit('tick', event);
      this.io.emit('match_over', {
        winner: this.winner,
        winnerName: this.winner === 'A' ? this.agentA.name : this.agentB.name,
        agentA: this.agentA.getState(),
        agentB: this.agentB.getState(),
        totalTicks: this.tick,
        log: this.tickLog,
      });
      return;
    }

    this.io.emit('tick', event);
  }

  // ── Hyperparameter updates (live, mid-match) ───────────────

  updateWeights(agentId, weights) {
    if (agentId === 'A') this.agentA.updateWeights(weights);
    if (agentId === 'B') this.agentB.updateWeights(weights);
    this.io.emit('weights_updated', { agentId, weights });
  }

  // ── State helpers ─────────────────────────────────────────

  _fullState() {
    return {
      running: this.running,
      tick: this.tick,
      winner: this.winner,
      agentA: this.agentA.getState(),
      agentB: this.agentB.getState(),
      world: this.world.serialize(),
      winScore: WIN_SCORE,
    };
  }

  getState() {
    return this._fullState();
  }
}

module.exports = { GameEngine };
