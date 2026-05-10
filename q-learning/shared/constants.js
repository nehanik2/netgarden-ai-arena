// ============================================================
// SHARED CONSTANTS — q-learning phase
// ============================================================

const GRID_W = 40;
const GRID_H = 30;
const WIN_SCORE = 25;
const TICK_MS = 300;          // faster than rule-based for training feel

// Terrain
const TERRAIN = { GRASS: '.', WATER: '~', ROCK: '#', MARSH: ',' };

// Plants
const PLANTS = {
  '*': { name: 'Neon Flower',    color: '#ff00ff', rare: false, points: 1 },
  'T': { name: 'Data Tree',      color: '#00ff88', rare: false, points: 1 },
  '^': { name: 'Crystal',        color: '#00ffff', rare: false, points: 1 },
  'Y': { name: 'Synth Shrub',    color: '#88ff00', rare: false, points: 1 },
  '$': { name: 'Credit Bloom',   color: '#ffff00', rare: true,  points: 4 },
  '&': { name: 'Ghost Vine',     color: '#cc00ff', rare: true,  points: 4 },
  '@': { name: 'Netrunner Rose', color: '#ff0055', rare: true,  points: 5 },
  '?': { name: 'Unknown Entity', color: '#00ffff', rare: true,  points: 6 },
};
const COMMON_PLANTS = ['*', 'T', '^', 'Y'];
const RARE_PLANTS   = ['$', '&', '@', '?'];

// ── Q-Learning hyperparameters ────────────────────────────
// These are what the user controls via sliders

const QL_DEFAULTS = {
  alpha:   0.3,   // learning rate        — how fast weights update
  gamma:   0.85,  // discount factor      — how much future rewards matter
  epsilon: 0.3,   // exploration rate     — random vs greedy action
  epsilonDecay: 0.995, // epsilon decay per episode
  epsilonMin:   0.05,  // floor on exploration
};

// Actions available to each agent
const ACTIONS = ['move_n', 'move_s', 'move_e', 'move_w', 'plant', 'idle'];

// State space: discretized to keep Q-table tractable
// State = (zone_x, zone_y, has_plant_here, nearest_rare_dist_bucket, opponent_dist_bucket)
const ZONE_W = 5;   // grid divided into 5-col zones  → 8 zones
const ZONE_H = 5;   // grid divided into 5-row zones  → 6 zones
const N_ZONES_X = Math.ceil(GRID_W / ZONE_W);  // 8
const N_ZONES_H = Math.ceil(GRID_H / ZONE_H);  // 6
const DIST_BUCKETS = 5;  // 0-5, 5-10, 10-15, 15-20, 20+
const STATE_SIZE = N_ZONES_X * N_ZONES_H * 2 * DIST_BUCKETS * DIST_BUCKETS; // ~2400 states

// Reward shaping
const REWARDS = {
  plantCommon:   +1.0,
  plantRare:     +5.0,
  moveToEmpty:   +0.1,   // slight reward for expansion
  moveToOwned:   -0.2,   // penalty for redundant moves
  idle:          -0.1,   // discourage idling
  opponentBlock:  +0.5,  // reward for planting near opponent
  win:           +20.0,
  lose:          -10.0,
};

// Training config
const EPISODES_PER_BURST = 5;   // episodes trained server-side before broadcasting
const MAX_STEPS_PER_EP   = 200; // max ticks per training episode

// Export
if (typeof module !== 'undefined') {
  module.exports = {
    GRID_W, GRID_H, WIN_SCORE, TICK_MS, TERRAIN, PLANTS,
    COMMON_PLANTS, RARE_PLANTS, QL_DEFAULTS, ACTIONS,
    ZONE_W, ZONE_H, N_ZONES_X, N_ZONES_H, DIST_BUCKETS,
    STATE_SIZE, REWARDS, EPISODES_PER_BURST, MAX_STEPS_PER_EP,
  };
} else {
  window.CONSTANTS = {
    GRID_W, GRID_H, WIN_SCORE, TICK_MS, TERRAIN, PLANTS,
    COMMON_PLANTS, RARE_PLANTS, QL_DEFAULTS, ACTIONS,
    ZONE_W, ZONE_H, N_ZONES_X, N_ZONES_H, DIST_BUCKETS,
    STATE_SIZE, REWARDS, EPISODES_PER_BURST, MAX_STEPS_PER_EP,
  };
}
