// ============================================================
// RULE-BASED AGENT — heuristic scoring engine
//
// Each agent scores every candidate tile using a weighted
// linear combination of features. Weights = hyperparameters.
// The agent always picks the highest-scoring valid action.
//
// This is intentionally transparent so the user can see
// exactly WHY the agent made each decision.
// ============================================================

const { TERRAIN, PLANTS, COMMON_PLANTS, RARE_PLANTS, GRID_W, GRID_H } = require('../../shared/constants.js');

class RuleBasedAgent {
  constructor(id, name, color, startX, startY, weights) {
    this.id = id;           // 'A' or 'B'
    this.name = name;
    this.color = color;
    this.x = startX;
    this.y = startY;
    this.weights = { ...weights };
    this.score = 0;
    this.plantCount = 0;
    this.lastAction = null;     // for UI display
    this.lastReason = null;     // explanation string
    this.decisionLog = [];      // last N decisions for transparency panel
  }

  // ── Main decision function ────────────────────────────────
  // Returns { type, x, y, plant, reason, scoreBreakdown }

  decide(world, opponent) {
    const candidates = this._getCandidateActions(world, opponent);
    if (candidates.length === 0) {
      return this._moveRandom(world);
    }

    // Score every candidate
    const scored = candidates.map(action => ({
      ...action,
      totalScore: this._scoreAction(action, world, opponent),
      breakdown: this._scoreBreakdown(action, world, opponent),
    }));

    // Sort descending
    scored.sort((a, b) => b.totalScore - a.totalScore);
    const best = scored[0];

    this.lastAction = best;
    this.lastReason = best.reason;

    // Keep last 5 decisions for the log panel
    this.decisionLog.unshift({
      tick: Date.now(),
      action: best.type,
      pos: `(${best.x},${best.y})`,
      score: best.totalScore.toFixed(2),
      breakdown: best.breakdown,
      reason: best.reason,
    });
    if (this.decisionLog.length > 5) this.decisionLog.pop();

    return best;
  }

  // ── Candidate action generation ───────────────────────────
  // Considers: planting on adjacent/current tile, moving toward best tile

  _getCandidateActions(world, opponent) {
    const actions = [];
    const neighbors = this._getNeighbors(this.x, this.y);

    // Option 1: plant on current tile if empty
    const current = world.getTile(this.x, this.y);
    if (current && this._isPlantable(current)) {
      const plant = this._choosePlant(current, world, opponent);
      actions.push({
        type: 'plant',
        x: this.x, y: this.y,
        plant,
        reason: `Plant ${PLANTS[plant].name} at current position`,
      });
    }

    // Option 2: move to a neighboring tile (with potential plant next turn)
    for (const [nx, ny] of neighbors) {
      const tile = world.getTile(nx, ny);
      if (!tile || tile.terrain === TERRAIN.WATER || tile.terrain === TERRAIN.ROCK) continue;
      actions.push({
        type: 'move',
        x: nx, y: ny,
        plant: null,
        reason: `Move to (${nx},${ny})`,
      });
    }

    return actions;
  }

  // ── Action scoring — the core heuristic ──────────────────

  _scoreAction(action, world, opponent) {
    const { x, y } = action;
    const w = this.weights;
    let score = 0;

    // 1. Territory: prefer tiles far from opponent's cluster
    const distToOpponent = this._dist(x, y, opponent.x, opponent.y);
    const territoryScore = Math.min(distToOpponent / 20, 1.0);
    score += w.territory * territoryScore;

    // 2. Rare plant: is there a rare plant opportunity nearby?
    const nearbyRare = this._countNearbyRare(x, y, world, 4);
    const rarePlantScore = action.plant && PLANTS[action.plant]?.rare ? 1.0
      : nearbyRare / 4;
    score += w.rarePlant * rarePlantScore;

    // 3. Aggression: prefer tiles adjacent to opponent's plants
    const adjacentOpponent = this._countNearbyOwned(x, y, world, opponent.id, 2);
    score += w.aggression * (adjacentOpponent / 4);

    // 4. Expansion: prefer tiles far from agent's own center of mass
    const ownCenter = this._ownCenterOfMass(world);
    const distFromOwn = this._dist(x, y, ownCenter.x, ownCenter.y);
    const expansionScore = Math.min(distFromOwn / 15, 1.0);
    score += w.expansion * expansionScore;

    // 5. Clustering: prefer tiles near own plants
    const nearbyOwn = this._countNearbyOwned(x, y, world, this.id, 3);
    score += w.clustering * (nearbyOwn / 6);

    // Bonus: planting always better than moving to empty tile (if plantable)
    if (action.type === 'plant') score += 0.15;

    // Penalty: don't walk into water/rock
    const tile = world.getTile(x, y);
    if (!tile || tile.terrain === TERRAIN.WATER || tile.terrain === TERRAIN.ROCK) score = -999;

    return score;
  }

  _scoreBreakdown(action, world, opponent) {
    const { x, y } = action;
    const w = this.weights;
    const distToOpponent = this._dist(x, y, opponent.x, opponent.y);
    const nearbyRare = this._countNearbyRare(x, y, world, 4);
    const adjacentOpponent = this._countNearbyOwned(x, y, world, opponent.id, 2);
    const ownCenter = this._ownCenterOfMass(world);
    const distFromOwn = this._dist(x, y, ownCenter.x, ownCenter.y);
    const nearbyOwn = this._countNearbyOwned(x, y, world, this.id, 3);

    return {
      territory:  +(w.territory  * Math.min(distToOpponent / 20, 1.0)).toFixed(2),
      rarePlant:  +(w.rarePlant  * (action.plant && PLANTS[action.plant]?.rare ? 1.0 : nearbyRare / 4)).toFixed(2),
      aggression: +(w.aggression * (adjacentOpponent / 4)).toFixed(2),
      expansion:  +(w.expansion  * Math.min(distFromOwn / 15, 1.0)).toFixed(2),
      clustering: +(w.clustering * (nearbyOwn / 6)).toFixed(2),
    };
  }

  // ── Plant selection ───────────────────────────────────────

  _choosePlant(tile, world, opponent) {
    // If rare plant hunting is weighted high, always try rare
    if (this.weights.rarePlant > 0.7 && Math.random() < this.weights.rarePlant) {
      return RARE_PLANTS[Math.floor(Math.random() * RARE_PLANTS.length)];
    }
    return COMMON_PLANTS[Math.floor(Math.random() * COMMON_PLANTS.length)];
  }

  // ── Utility helpers ───────────────────────────────────────

  _isPlantable(tile) {
    return tile &&
      tile.terrain !== TERRAIN.WATER &&
      tile.terrain !== TERRAIN.ROCK &&
      !tile.plant;
  }

  _getNeighbors(x, y) {
    return [
      [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y],
      [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1],
    ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < GRID_W && ny < GRID_H);
  }

  _dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  _countNearbyRare(x, y, world, radius) {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tile = world.getTile(x + dx, y + dy);
        if (tile?.plant && PLANTS[tile.plant]?.rare) count++;
      }
    }
    return count;
  }

  _countNearbyOwned(x, y, world, ownerId, radius) {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tile = world.getTile(x + dx, y + dy);
        if (tile?.ownerId === ownerId) count++;
      }
    }
    return count;
  }

  _ownCenterOfMass(world) {
    let sumX = this.x, sumY = this.y, count = 1;
    world.forEachTile(tile => {
      if (tile.ownerId === this.id) { sumX += tile.x; sumY += tile.y; count++; }
    });
    return { x: sumX / count, y: sumY / count };
  }

  _moveRandom(world) {
    const neighbors = this._getNeighbors(this.x, this.y)
      .filter(([nx, ny]) => {
        const t = world.getTile(nx, ny);
        return t && t.terrain !== TERRAIN.WATER && t.terrain !== TERRAIN.ROCK;
      });
    if (neighbors.length === 0) return { type: 'idle', x: this.x, y: this.y };
    const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
    return { type: 'move', x: nx, y: ny, reason: 'Random fallback move' };
  }

  // Apply a decided action to self
  applyAction(action, world) {
    if (action.type === 'move') {
      this.x = action.x;
      this.y = action.y;
    } else if (action.type === 'plant') {
      const tile = world.getTile(action.x, action.y);
      if (tile && this._isPlantable(tile)) {
        tile.plant = action.plant;
        tile.ownerId = this.id;
        this.plantCount++;
        const plantDef = PLANTS[action.plant];
        const points = plantDef?.points ?? 1;
        this.score += points;
      }
    }
  }

  updateWeights(weights) {
    this.weights = { ...weights };
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      x: this.x,
      y: this.y,
      score: this.score,
      plantCount: this.plantCount,
      weights: this.weights,
      lastAction: this.lastAction,
      lastReason: this.lastReason,
      decisionLog: this.decisionLog,
    };
  }
}

module.exports = { RuleBasedAgent };
