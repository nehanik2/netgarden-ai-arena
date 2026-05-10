// ============================================================
// Q-LEARNING AGENT
//
// Tabular Q-learning with:
//   - Discretized state space (zone + context features)
//   - ε-greedy action selection
//   - Reward shaping for planting, expansion, blocking
//   - Q-table serialization for browser visualization
//   - Live hyperparameter updates (α, γ, ε) mid-training
//
// Q(s,a) ← Q(s,a) + α [ r + γ·max Q(s',a') − Q(s,a) ]
// ============================================================

const {
  GRID_W, GRID_H, TERRAIN, PLANTS, COMMON_PLANTS, RARE_PLANTS,
  ACTIONS, ZONE_W, ZONE_H, N_ZONES_X, N_ZONES_H,
  DIST_BUCKETS, REWARDS, QL_DEFAULTS,
} = require('../../shared/constants.js');

class QLearningAgent {
  constructor(id, name, color, startX, startY, params = {}) {
    this.id      = id;
    this.name    = name;
    this.color   = color;
    this.startX  = startX;
    this.startY  = startY;

    // Position (reset each episode)
    this.x = startX;
    this.y = startY;

    // Hyperparameters — user-controllable
    this.alpha        = params.alpha        ?? QL_DEFAULTS.alpha;
    this.gamma        = params.gamma        ?? QL_DEFAULTS.gamma;
    this.epsilon      = params.epsilon      ?? QL_DEFAULTS.epsilon;
    this.epsilonDecay = params.epsilonDecay ?? QL_DEFAULTS.epsilonDecay;
    this.epsilonMin   = params.epsilonMin   ?? QL_DEFAULTS.epsilonMin;

    // Q-table: Map<stateKey, Float32Array(nActions)>
    // Using a plain object for JSON-serialisability
    this.qTable = {};

    // Stats
    this.totalEpisodes   = 0;
    this.totalReward     = 0;
    this.episodeRewards  = [];   // reward per episode (for chart)
    this.score           = 0;
    this.plantCount      = 0;

    // Last transition (for UI)
    this.lastState  = null;
    this.lastAction = null;
    this.lastReward = null;
    this.lastQ      = null;
  }

  // ── State encoding ────────────────────────────────────────
  // Encodes world observations into a discrete state key string

  encodeState(world, opponent) {
    // Zone position
    const zx = Math.min(Math.floor(this.x / ZONE_W), N_ZONES_X - 1);
    const zy = Math.min(Math.floor(this.y / ZONE_H), N_ZONES_H - 1);

    // Is current tile plantable?
    const tile = world.getTile(this.x, this.y);
    const canPlant = tile && !tile.plant &&
      tile.terrain !== TERRAIN.WATER &&
      tile.terrain !== TERRAIN.ROCK ? 1 : 0;

    // Distance to nearest rare plant (bucketed)
    const rareDist = this._nearestRareDist(world);
    const rareB = Math.min(Math.floor(rareDist / 5), DIST_BUCKETS - 1);

    // Distance to opponent (bucketed)
    const oppDist = Math.sqrt((this.x - opponent.x) ** 2 + (this.y - opponent.y) ** 2);
    const oppB = Math.min(Math.floor(oppDist / 5), DIST_BUCKETS - 1);

    return `${zx},${zy},${canPlant},${rareB},${oppB}`;
  }

  // ── Q-table access ────────────────────────────────────────

  _getQ(state) {
    if (!this.qTable[state]) {
      // Optimistic initialization: small positive values encourage exploration
      this.qTable[state] = new Array(ACTIONS.length).fill(0).map(() => Math.random() * 0.1);
    }
    return this.qTable[state];
  }

  _maxQ(state) {
    return Math.max(...this._getQ(state));
  }

  _bestAction(state) {
    const qs = this._getQ(state);
    return qs.indexOf(Math.max(...qs));
  }

  // ── Action selection (ε-greedy) ───────────────────────────

  selectAction(state) {
    if (Math.random() < this.epsilon) {
      // Explore: random action
      return Math.floor(Math.random() * ACTIONS.length);
    }
    // Exploit: greedy
    return this._bestAction(state);
  }

  // ── Q-update (Bellman equation) ───────────────────────────

  update(state, actionIdx, reward, nextState) {
    const qs = this._getQ(state);
    const oldQ = qs[actionIdx];
    const maxNextQ = this._maxQ(nextState);

    // Q(s,a) ← Q(s,a) + α [ r + γ·max Q(s',a') − Q(s,a) ]
    qs[actionIdx] = oldQ + this.alpha * (reward + this.gamma * maxNextQ - oldQ);

    this.lastQ = { state, action: ACTIONS[actionIdx], oldQ, newQ: qs[actionIdx], reward };
    return qs[actionIdx];
  }

  // ── Execute action in world ───────────────────────────────
  // Returns { moved, planted, reward }

  executeAction(actionIdx, world, opponent) {
    const action = ACTIONS[actionIdx];
    let reward = 0;
    let moved = false, planted = false;

    const moves = {
      move_n: [0, -1], move_s: [0,  1],
      move_e: [1,  0], move_w: [-1, 0],
    };

    if (action === 'idle') {
      reward = REWARDS.idle;

    } else if (action === 'plant') {
      const tile = world.getTile(this.x, this.y);
      if (tile && !tile.plant &&
          tile.terrain !== TERRAIN.WATER &&
          tile.terrain !== TERRAIN.ROCK) {
        // Choose rare vs common based on context
        const nearRare = this._nearestRareDist(world) < 4;
        const plantSym = nearRare && Math.random() < 0.4
          ? RARE_PLANTS[Math.floor(Math.random() * RARE_PLANTS.length)]
          : COMMON_PLANTS[Math.floor(Math.random() * COMMON_PLANTS.length)];

        tile.plant   = plantSym;
        tile.ownerId = this.id;
        planted = true;

        const pts = PLANTS[plantSym].points;
        this.score += pts;
        this.plantCount++;

        reward = PLANTS[plantSym].rare ? REWARDS.plantRare : REWARDS.plantCommon;

        // Bonus for blocking opponent
        const oppDist = Math.sqrt((this.x - opponent.x) ** 2 + (this.y - opponent.y) ** 2);
        if (oppDist < 5) reward += REWARDS.opponentBlock;

      } else {
        reward = -0.3; // tried to plant on bad tile
      }

    } else if (moves[action]) {
      const [dx, dy] = moves[action];
      const nx = this.x + dx;
      const ny = this.y + dy;
      if (nx >= 0 && ny >= 0 && nx < GRID_W && ny < GRID_H) {
        const tile = world.getTile(nx, ny);
        if (tile && tile.terrain !== TERRAIN.WATER && tile.terrain !== TERRAIN.ROCK) {
          this.x = nx; this.y = ny;
          moved = true;
          reward = tile.ownerId === this.id ? REWARDS.moveToOwned : REWARDS.moveToEmpty;
        } else {
          reward = -0.4; // wall penalty
        }
      } else {
        reward = -0.4; // out of bounds
      }
    }

    this.totalReward += reward;
    return { moved, planted, reward };
  }

  // ── Episode management ────────────────────────────────────

  startEpisode() {
    this.x = this.startX;
    this.y = this.startY;
    this.score = 0;
    this.plantCount = 0;
    this._episodeReward = 0;
  }

  endEpisode(epReward) {
    this.totalEpisodes++;
    this.episodeRewards.push(parseFloat(epReward.toFixed(2)));
    // Keep last 200 episodes for the chart
    if (this.episodeRewards.length > 200) this.episodeRewards.shift();
    // Decay epsilon
    this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
  }

  // ── Helpers ───────────────────────────────────────────────

  _nearestRareDist(world) {
    let minDist = 999;
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const tile = world.getTile(this.x + dx, this.y + dy);
        if (tile?.plant && PLANTS[tile.plant]?.rare) {
          minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
        }
      }
    }
    return minDist === 999 ? 20 : minDist;
  }

  // ── Hyperparameter hot-swap ───────────────────────────────

  updateParams(params) {
    if (params.alpha        !== undefined) this.alpha        = params.alpha;
    if (params.gamma        !== undefined) this.gamma        = params.gamma;
    if (params.epsilon      !== undefined) this.epsilon      = params.epsilon;
    if (params.epsilonDecay !== undefined) this.epsilonDecay = params.epsilonDecay;
  }

  // ── Q-table export for heatmap visualization ──────────────
  // Returns max Q-value per grid cell (agent's "desire" for each tile)

  exportQHeatmap(world, opponent) {
    const heatmap = new Array(GRID_W * GRID_H).fill(0);
    const saved = { x: this.x, y: this.y };

    // Sample Q-values by temporarily placing agent at each tile
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const tile = world.getTile(tx, ty);
        if (!tile || tile.terrain === TERRAIN.WATER || tile.terrain === TERRAIN.ROCK) continue;
        this.x = tx; this.y = ty;
        const state = this.encodeState(world, opponent);
        heatmap[ty * GRID_W + tx] = this._maxQ(state);
      }
    }

    this.x = saved.x; this.y = saved.y;
    return heatmap;
  }

  getState() {
    return {
      id: this.id, name: this.name, color: this.color,
      x: this.x, y: this.y,
      score: this.score, plantCount: this.plantCount,
      alpha: this.alpha, gamma: this.gamma, epsilon: this.epsilon,
      totalEpisodes: this.totalEpisodes,
      episodeRewards: this.episodeRewards,
      lastQ: this.lastQ,
      qTableSize: Object.keys(this.qTable).length,
    };
  }
}

module.exports = { QLearningAgent };
