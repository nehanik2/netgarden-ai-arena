// ============================================================
// WORLD — server-side grid state
// Procedural generation + tile access helpers
// ============================================================

const { GRID_W, GRID_H, TERRAIN } = require('../../shared/constants.js');

// Tiny deterministic hash for terrain generation (no deps)
function hash(x, y, s = 42) {
  let h = s;
  h = Math.imul(h ^ x, 0x9e3779b9) | 0;
  h = Math.imul(h ^ y, 0x85ebca6b) | 0;
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35) | 0;
  return (h >>> 0) / 0xffffffff;
}

function smooth(x, y, sc, s) {
  const fx = x / sc, fy = y / sc;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const dx = fx - ix, dy = fy - iy;
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  const ux = dx * dx * (3 - 2 * dx), uy = dy * dy * (3 - 2 * dy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function genTerrain(x, y) {
  const e = smooth(x, y, 8, 42) * 0.6 + smooth(x, y, 4, 99) * 0.4;
  const m = smooth(x, y, 6, 137);
  if (e < 0.28) return TERRAIN.WATER;
  if (e > 0.80) return TERRAIN.ROCK;
  if (m > 0.74) return TERRAIN.MARSH;
  return TERRAIN.GRASS;
}

class World {
  constructor() {
    this.tiles = new Map();
    this._generate();
  }

  _generate() {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        this.tiles.set(`${x},${y}`, {
          x, y,
          terrain: genTerrain(x, y),
          plant: null,
          ownerId: null,
        });
      }
    }

    // Clear safe spawn zones for agents (3x3 around each start)
    this._clearZone(2, 2, 3);
    this._clearZone(GRID_W - 4, GRID_H - 4, 3);
  }

  _clearZone(cx, cy, r) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tile = this.tiles.get(`${cx + dx},${cy + dy}`);
        if (tile) { tile.terrain = TERRAIN.GRASS; tile.plant = null; }
      }
    }
  }

  getTile(x, y) {
    return this.tiles.get(`${x},${y}`);
  }

  forEachTile(fn) {
    for (const tile of this.tiles.values()) fn(tile);
  }

  serialize() {
    const obj = {};
    for (const [k, v] of this.tiles) obj[k] = v;
    return obj;
  }

  reset() {
    this.tiles.clear();
    this._generate();
  }

  getStats(agentAId, agentBId) {
    let aPlants = 0, bPlants = 0, aRare = 0, bRare = 0;
    const { PLANTS } = require('../../shared/constants.js');
    for (const tile of this.tiles.values()) {
      if (!tile.plant) continue;
      const isRare = PLANTS[tile.plant]?.rare ?? false;
      if (tile.ownerId === agentAId) { aPlants++; if (isRare) aRare++; }
      if (tile.ownerId === agentBId) { bPlants++; if (isRare) bRare++; }
    }
    return { aPlants, bPlants, aRare, bRare };
  }
}

module.exports = { World };
