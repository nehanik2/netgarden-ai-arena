// ============================================================
// WORLD GENERATOR — procedural terrain with seeded noise
// Creates a consistent, interesting world without a huge DB
// ============================================================

import type { Tile, TerrainType } from '../../../shared/src/types.js';

// Simple deterministic noise function (no deps)
function hash(x: number, y: number, seed = 42): number {
  let h = seed;
  h = Math.imul(h ^ x, 0x9e3779b9);
  h = Math.imul(h ^ y, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  return (h >>> 0) / 0xffffffff; // 0..1
}

function smoothNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const dx = fx - ix;
  const dy = fy - iy;

  const a = hash(ix,     iy,     seed);
  const b = hash(ix + 1, iy,     seed);
  const c = hash(ix,     iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);

  // Smoothstep interpolation
  const ux = dx * dx * (3 - 2 * dx);
  const uy = dy * dy * (3 - 2 * dy);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let value = 0;
  let amplitude = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x, y, Math.pow(2, i) * 8, seed + i * 1000) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  return value / total;
}

export function generateTile(x: number, y: number): Tile {
  const elevation = fbm(x, y, 4, 42);
  const moisture  = fbm(x, y, 3, 137);
  const chaos     = hash(x, y, 999);

  let terrain: TerrainType = '.';

  if (elevation < 0.25) {
    terrain = '~'; // water/low
  } else if (elevation < 0.35) {
    terrain = ','; // marsh
  } else if (elevation > 0.78) {
    terrain = '#'; // wall/rock
  } else if (moisture > 0.72) {
    terrain = ':'; // dense undergrowth
  } else if (chaos > 0.97) {
    terrain = '░'; // fog patch
  } else {
    terrain = '.'; // grass
  }

  return {
    x,
    y,
    terrain,
    glowing: false,
    rare: false,
  };
}

export function generateChunk(
  cx: number,
  cy: number,
  chunkSize = 32
): Map<string, Tile> {
  const tiles = new Map<string, Tile>();
  const baseX = cx * chunkSize;
  const baseY = cy * chunkSize;

  for (let dy = 0; dy < chunkSize; dy++) {
    for (let dx = 0; dx < chunkSize; dx++) {
      const tx = baseX + dx;
      const ty = baseY + dy;
      const tile = generateTile(tx, ty);
      tiles.set(`${tx},${ty}`, tile);
    }
  }

  return tiles;
}
