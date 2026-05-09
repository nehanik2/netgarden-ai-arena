// ============================================================
// SHARED CONSTANTS — used by server (Node.js) and client
// ============================================================

const GRID_W = 40;
const GRID_H = 30;
const WIN_SCORE = 20;
const TICK_MS = 600; // ms between agent decisions

// Terrain types
const TERRAIN = {
  GRASS: '.',
  WATER: '~',
  ROCK: '#',
  MARSH: ',',
};

// Plant definitions with point values
const PLANTS = {
  '*': { name: 'Neon Flower',   color: '#ff00ff', rare: false, points: 1, cost: 1 },
  'T': { name: 'Data Tree',     color: '#00ff88', rare: false, points: 1, cost: 1 },
  '^': { name: 'Crystal',       color: '#00ffff', rare: false, points: 1, cost: 1 },
  'Y': { name: 'Synth Shrub',   color: '#88ff00', rare: false, points: 1, cost: 1 },
  '$': { name: 'Credit Bloom',  color: '#ffff00', rare: true,  points: 4, cost: 1 },
  '&': { name: 'Ghost Vine',    color: '#cc00ff', rare: true,  points: 4, cost: 1 },
  '@': { name: 'Netrunner Rose',color: '#ff0055', rare: true,  points: 5, cost: 1 },
  '?': { name: 'Unknown Entity',color: '#00ffff', rare: true,  points: 6, cost: 1 },
};

const COMMON_PLANTS = ['*', 'T', '^', 'Y'];
const RARE_PLANTS   = ['$', '&', '@', '?'];

// Agent weight keys — these are the hyperparameters
const WEIGHT_KEYS = [
  { key: 'territory',        label: 'Territory Control',     desc: 'Value owning more tiles' },
  { key: 'rarePlant',        label: 'Rare Plant Hunting',    desc: 'Seek high-value rare tiles' },
  { key: 'aggression',       label: 'Aggression',            desc: 'Block and contest opponent tiles' },
  { key: 'expansion',        label: 'Expansion Speed',       desc: 'Move outward fast, claim new ground' },
  { key: 'clustering',       label: 'Clustering',            desc: 'Stay near own plants for defense' },
];

// Built-in strategy presets
const PRESETS = {
  balanced: {
    label: 'Balanced',
    weights: { territory: 0.5, rarePlant: 0.5, aggression: 0.4, expansion: 0.5, clustering: 0.3 },
  },
  territorial: {
    label: 'Territorial Warlord',
    weights: { territory: 0.9, rarePlant: 0.2, aggression: 0.8, expansion: 0.7, clustering: 0.6 },
  },
  rareHunter: {
    label: 'Rare Hunter',
    weights: { territory: 0.2, rarePlant: 1.0, aggression: 0.2, expansion: 0.6, clustering: 0.1 },
  },
  rusher: {
    label: 'Speed Rusher',
    weights: { territory: 0.3, rarePlant: 0.3, aggression: 0.5, expansion: 1.0, clustering: 0.1 },
  },
  defender: {
    label: 'Defensive Cluster',
    weights: { territory: 0.6, rarePlant: 0.4, aggression: 0.2, expansion: 0.2, clustering: 1.0 },
  },
};

// Export for both Node (CommonJS) and browser (global)
if (typeof module !== 'undefined') {
  module.exports = { GRID_W, GRID_H, WIN_SCORE, TICK_MS, TERRAIN, PLANTS, COMMON_PLANTS, RARE_PLANTS, WEIGHT_KEYS, PRESETS };
} else {
  window.CONSTANTS = { GRID_W, GRID_H, WIN_SCORE, TICK_MS, TERRAIN, PLANTS, COMMON_PLANTS, RARE_PLANTS, WEIGHT_KEYS, PRESETS };
}
