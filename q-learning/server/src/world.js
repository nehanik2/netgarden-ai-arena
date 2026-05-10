// ============================================================
// WORLD — grid state with procedural terrain
// ============================================================

const { GRID_W, GRID_H, TERRAIN } = require('../../shared/constants.js');

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
  const a = hash(ix, iy, s), b = hash(ix+1, iy, s);
  const c = hash(ix, iy+1, s), d = hash(ix+1, iy+1, s);
  const ux = dx*dx*(3-2*dx), uy = dy*dy*(3-2*dy);
  return a + (b-a)*ux + (c-a)*uy + (a-b-c+d)*ux*uy;
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
          x, y, terrain: genTerrain(x, y), plant: null, ownerId: null,
        });
      }
    }
    this._clearZone(2, 2, 3);
    this._clearZone(GRID_W - 4, GRID_H - 4, 3);
  }

  _clearZone(cx, cy, r) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const t = this.tiles.get(`${cx+dx},${cy+dy}`);
        if (t) { t.terrain = TERRAIN.GRASS; t.plant = null; t.ownerId = null; }
      }
    }
  }

  getTile(x, y) { return this.tiles.get(`${x},${y}`); }

  reset() {
    for (const t of this.tiles.values()) { t.plant = null; t.ownerId = null; }
  }

  serialize() {
    const obj = {};
    for (const [k, v] of this.tiles) obj[k] = v;
    return obj;
  }

  getStats(idA, idB) {
    const { PLANTS } = require('../../shared/constants.js');
    let aP = 0, bP = 0, aR = 0, bR = 0;
    for (const t of this.tiles.values()) {
      if (!t.plant) continue;
      const rare = PLANTS[t.plant]?.rare ?? false;
      if (t.ownerId === idA) { aP++; if (rare) aR++; }
      if (t.ownerId === idB) { bP++; if (rare) bR++; }
    }
    return { aPlants: aP, bPlants: bP, aRare: aR, bRare: bR };
  }
}

module.exports = { World };
