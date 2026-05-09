// ============================================================
// SHARED TYPES — used by both client and server
// ============================================================

export type TerrainType = '.' | '~' | '#' | '░' | ',' | ':';
export type PlantType = '*' | 'T' | '^' | 'Y' | 'o' | '$' | '&' | '@' | '!' | '?';

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  plant?: PlantType;
  ownerId?: string;
  ownerName?: string;
  timestamp?: number;
  message?: string;
  glowing?: boolean;
  rare?: boolean;
}

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  avatar: string;
  seeds: number;
  lastSeen: number;
  isOnline: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  x: number;
  y: number;
  timestamp: number;
  worldMessage: boolean; // false = local bubble only
}

export interface WorldChunk {
  cx: number; // chunk x (tile_x / CHUNK_SIZE)
  cy: number;
  tiles: Map<string, Tile> | Record<string, Tile>;
}

export interface WorldUpdate {
  type: 'tile_changed' | 'tile_removed';
  tile: Tile;
}

// Socket event payloads
export interface S2C {
  welcome: { player: Player; nearbyPlayers: Player[]; chunk: SerializedChunk };
  world_update: WorldUpdate;
  player_moved: { id: string; x: number; y: number };
  player_joined: Player;
  player_left: { id: string };
  chat_message: ChatMessage;
  chunk_data: SerializedChunk;
  error: { code: string; message: string };
  weather: { type: WeatherType; intensity: number };
  season: { season: Season };
}

export interface C2S {
  move: { x: number; y: number };
  plant: { x: number; y: number; plantType: PlantType };
  remove: { x: number; y: number };
  interact: { x: number; y: number };
  chat: { text: string; worldMessage: boolean };
  request_chunk: { cx: number; cy: number };
}

export interface SerializedChunk {
  cx: number;
  cy: number;
  tiles: Record<string, Tile>; // key = "x,y"
}

export type WeatherType = 'clear' | 'rain' | 'snow' | 'storm' | 'glitch';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const CHUNK_SIZE = 32;
export const TILE_SIZE = 16; // pixels per tile in canvas
export const VIEW_RADIUS = 20; // tiles visible in each direction
export const MAX_SEEDS = 99;
export const SEED_REGEN_INTERVAL = 30000; // ms

// Plant definitions
export interface PlantDef {
  symbol: PlantType;
  name: string;
  color: string;
  glowColor: string;
  rare: boolean;
  seedCost: number;
  description: string;
}

export const PLANT_DEFS: Record<PlantType, PlantDef> = {
  '*': { symbol: '*', name: 'Neon Flower', color: '#ff00ff', glowColor: '#ff00ff80', rare: false, seedCost: 1, description: 'A glowing magenta bloom' },
  'T': { symbol: 'T', name: 'Data Tree', color: '#00ff88', glowColor: '#00ff8860', rare: false, seedCost: 2, description: 'Grows tall in the net' },
  '^': { symbol: '^', name: 'Crystal', color: '#00ffff', glowColor: '#00ffff80', rare: false, seedCost: 2, description: 'Faceted cyan crystal' },
  'Y': { symbol: 'Y', name: 'Synth Shrub', color: '#88ff00', glowColor: '#88ff0060', rare: false, seedCost: 1, description: 'Low voltage vegetation' },
  'o': { symbol: 'o', name: 'Orb Moss', color: '#ff8800', glowColor: '#ff880060', rare: false, seedCost: 1, description: 'Bioluminescent spores' },
  '$': { symbol: '$', name: 'Credit Bloom', color: '#ffff00', glowColor: '#ffff0080', rare: true, seedCost: 5, description: 'Rare golden currency flower' },
  '&': { symbol: '&', name: 'Ghost Vine', color: '#cc00ff', glowColor: '#cc00ff80', rare: true, seedCost: 4, description: 'Spectral climbing plant' },
  '@': { symbol: '@', name: 'Netrunner Rose', color: '#ff0055', glowColor: '#ff005580', rare: true, seedCost: 5, description: 'Icon of the underground' },
  '!': { symbol: '!', name: 'Signal Spike', color: '#ffffff', glowColor: '#ffffff60', rare: false, seedCost: 1, description: 'A sharp broadcast needle' },
  '?': { symbol: '?', name: 'Unknown Entity', color: '#00ffff', glowColor: '#00ffff40', rare: true, seedCost: 8, description: '???' },
};

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  '.': '#1a4a1a',
  '~': '#0a2a4a',
  '#': '#3a3a3a',
  '░': '#111122',
  ',': '#2a3a1a',
  ':': '#1a1a2a',
};

export const PLAYER_COLORS = [
  '#00ff88', '#ff00ff', '#00ffff', '#ff8800',
  '#ff0055', '#88ff00', '#ffff00', '#cc00ff',
];

export const PLAYER_AVATARS = ['@', '%', '&', '§', 'Ω', 'λ', 'Σ', 'π', 'μ', 'δ'];

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function tileToChunk(tx: number, ty: number): { cx: number; cy: number } {
  return {
    cx: Math.floor(tx / CHUNK_SIZE),
    cy: Math.floor(ty / CHUNK_SIZE),
  };
}
