// ============================================================
// ASCII CANVAS RENDERER
// Draws the world, players, effects on an HTML5 Canvas
// Uses monospace font cells for the ASCII grid
// ============================================================

import type { Tile, Player, ChatMessage, WeatherType, Season } from '../../../shared/src/types.js';
import { PLANT_DEFS, TERRAIN_COLORS } from '../../../shared/src/types.js';
import { ClientWorldManager } from './clientWorld.js';

const CELL_W = 14;  // px per tile x
const CELL_H = 16;  // px per tile y
const FONT = '13px "Share Tech Mono", monospace';

// Terrain display
const TERRAIN_CHARS: Record<string, { char: string; color: string; bgColor?: string }> = {
  '.': { char: '.', color: '#1a4a1a' },
  '~': { char: '~', color: '#0a3a6a' },
  '#': { char: '#', color: '#4a4a4a' },
  '░': { char: '░', color: '#111130' },
  ',': { char: ',', color: '#2a3a1a' },
  ':': { char: ':', color: '#1a1a3a' },
};

// Season palette modifiers
const SEASON_TINTS: Record<Season, string> = {
  spring: 'rgba(0, 255, 136, 0.03)',
  summer: 'rgba(255, 255, 0, 0.04)',
  autumn: 'rgba(255, 100, 0, 0.05)',
  winter: 'rgba(100, 200, 255, 0.04)',
};

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  char: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface GlowEffect {
  wx: number; wy: number; // world coords
  color: string;
  radius: number;
  alpha: number;
}

export class AsciiRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: ClientWorldManager;

  // Camera in world coords (tile units, can be fractional for smooth scroll)
  public cameraX = 0;
  public cameraY = 0;

  // Smooth camera target
  private targetCameraX = 0;
  private targetCameraY = 0;

  // Particles for weather + effects
  private particles: Particle[] = [];

  // Fog of war: tiles player hasn't visited
  private visited = new Set<string>();

  // Weather + season
  public weather: WeatherType = 'clear';
  public season: Season = 'spring';
  public weatherIntensity = 0.6;

  // Animation frame
  private frame = 0;
  private lastTime = 0;

  // Minimap cache
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, world: ClientWorldManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.world = world;

    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = 120;
    this.minimapCanvas.height = 80;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.font = FONT;
    this.ctx.textBaseline = 'top';
  }

  // Smoothly move camera toward target (player position)
  setTarget(wx: number, wy: number): void {
    this.targetCameraX = wx;
    this.targetCameraY = wy;
  }

  // Screen → world coordinate
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const tilesW = this.canvas.width / CELL_W;
    const tilesH = this.canvas.height / CELL_H;
    return {
      x: Math.floor(sx / CELL_W + this.cameraX - tilesW / 2),
      y: Math.floor(sy / CELL_H + this.cameraY - tilesH / 2),
    };
  }

  // World → screen coordinate (top-left of tile cell)
  worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    const tilesW = this.canvas.width / CELL_W;
    const tilesH = this.canvas.height / CELL_H;
    return {
      sx: Math.round((wx - this.cameraX + tilesW / 2) * CELL_W),
      sy: Math.round((wy - this.cameraY + tilesH / 2) * CELL_H),
    };
  }

  // ── Main render loop ──────────────────────────────────────

  render(
    players: Map<string, Player>,
    localPlayerId: string,
    chatMessages: ChatMessage[],
    dt: number
  ): void {
    this.frame++;

    // Smooth camera
    const lerp = 0.12;
    this.cameraX += (this.targetCameraX - this.cameraX) * lerp;
    this.cameraY += (this.targetCameraY - this.cameraY) * lerp;

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Clear
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);

    // Calc visible tile range
    const tilesW = Math.ceil(W / CELL_W) + 2;
    const tilesH = Math.ceil(H / CELL_H) + 2;
    const startX = Math.floor(this.cameraX - tilesW / 2);
    const startY = Math.floor(this.cameraY - tilesH / 2);
    const endX = startX + tilesW;
    const endY = startY + tilesH;

    // Mark visited
    const localPlayer = players.get(localPlayerId);
    if (localPlayer) {
      for (let dy = -8; dy <= 8; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          this.visited.add(`${localPlayer.x + dx},${localPlayer.y + dy}`);
        }
      }
    }

    // ── Draw terrain ───────────────────────────────────────

    ctx.font = FONT;
    ctx.textBaseline = 'top';

    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        const tile = this.world.getTile(tx, ty);
        const { sx, sy } = this.worldToScreen(tx, ty);

        const isVisited = this.visited.has(`${tx},${ty}`);
        const isNearPlayer = localPlayer &&
          Math.abs(localPlayer.x - tx) <= 12 &&
          Math.abs(localPlayer.y - ty) <= 10;

        if (!tile) {
          // Fog tile
          ctx.fillStyle = '#06090f';
          ctx.fillRect(sx, sy, CELL_W, CELL_H);
          ctx.fillStyle = '#0a0f1a44';
          ctx.fillText('░', sx, sy);
          continue;
        }

        // Fog of war: dim unvisited
        const fogAlpha = isVisited ? (isNearPlayer ? 1 : 0.4) : 0.15;

        // Terrain background tint
        const terrainDef = TERRAIN_CHARS[tile.terrain] ?? TERRAIN_CHARS['.'];
        const terrainColorFaded = this.fadeColor(terrainDef.color, fogAlpha * 0.5);
        ctx.fillStyle = terrainColorFaded;
        ctx.fillRect(sx, sy, CELL_W, CELL_H);

        // Terrain character
        ctx.globalAlpha = fogAlpha * 0.7;
        ctx.fillStyle = terrainDef.color;
        ctx.fillText(terrainDef.char, sx + 1, sy);
        ctx.globalAlpha = 1;

        // ── Plant ──────────────────────────────────────────
        if (tile.plant && PLANT_DEFS[tile.plant]) {
          const pDef = PLANT_DEFS[tile.plant];
          const pulse = tile.rare
            ? 0.7 + 0.3 * Math.sin(this.frame * 0.08 + tx * 0.5 + ty * 0.3)
            : 1;

          if (tile.rare || tile.glowing) {
            // Glow effect
            const glowRadius = 18 * pulse;
            const grad = ctx.createRadialGradient(
              sx + CELL_W / 2, sy + CELL_H / 2, 0,
              sx + CELL_W / 2, sy + CELL_H / 2, glowRadius
            );
            grad.addColorStop(0, pDef.glowColor);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.globalAlpha = fogAlpha * pulse;
            ctx.fillRect(sx - glowRadius, sy - glowRadius, glowRadius * 2 + CELL_W, glowRadius * 2 + CELL_H);
            ctx.globalAlpha = 1;
          }

          ctx.globalAlpha = fogAlpha * pulse;
          ctx.fillStyle = pDef.color;
          ctx.shadowColor = pDef.glowColor;
          ctx.shadowBlur = tile.rare ? 12 : 6;
          ctx.fillText(pDef.symbol, sx + 1, sy);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }
    }

    // ── Season tint overlay ────────────────────────────────

    ctx.fillStyle = SEASON_TINTS[this.season];
    ctx.fillRect(0, 0, W, H);

    // ── Draw weather particles ─────────────────────────────

    this.updateWeather(dt);
    this.drawParticles();

    // ── Draw other players ────────────────────────────────

    for (const [pid, player] of players) {
      if (pid === localPlayerId) continue;
      const { sx, sy } = this.worldToScreen(player.x, player.y);
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

      // Player glow
      const pgGrad = ctx.createRadialGradient(sx + 7, sy + 8, 0, sx + 7, sy + 8, 20);
      pgGrad.addColorStop(0, player.color + '40');
      pgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = pgGrad;
      ctx.fillRect(sx - 15, sy - 10, 46, 36);

      // Avatar
      ctx.fillStyle = player.color;
      ctx.shadowColor = player.color;
      ctx.shadowBlur = 8;
      ctx.font = FONT;
      ctx.fillText(player.avatar, sx + 1, sy);
      ctx.shadowBlur = 0;

      // Name tag
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.fillStyle = player.color + 'cc';
      ctx.fillText(player.name.slice(0, 10), sx - 10, sy - 11);
      ctx.font = FONT;
    }

    // ── Draw local player ─────────────────────────────────

    if (localPlayer) {
      const { sx, sy } = this.worldToScreen(localPlayer.x, localPlayer.y);
      const blinkOn = Math.floor(this.frame / 15) % 2 === 0;

      // Strong glow ring
      const lgGrad = ctx.createRadialGradient(sx + 7, sy + 8, 0, sx + 7, sy + 8, 28);
      lgGrad.addColorStop(0, localPlayer.color + '50');
      lgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = lgGrad;
      ctx.fillRect(sx - 20, sy - 14, 56, 44);

      // Avatar with blink
      if (blinkOn) {
        ctx.fillStyle = localPlayer.color;
        ctx.shadowColor = localPlayer.color;
        ctx.shadowBlur = 14;
        ctx.font = FONT;
        ctx.fillText(localPlayer.avatar, sx + 1, sy);
        ctx.shadowBlur = 0;
      }

      // "YOU" label
      ctx.font = '8px "Share Tech Mono"';
      ctx.fillStyle = '#ffffff80';
      ctx.fillText('YOU', sx + 1, sy - 11);
      ctx.font = FONT;
    }

    // ── Draw chat bubbles ─────────────────────────────────

    const now = Date.now();
    for (const msg of chatMessages) {
      if (now - msg.timestamp > 5000) continue;
      const { sx, sy } = this.worldToScreen(msg.x, msg.y);
      if (sx < -200 || sx > W + 200) continue;

      const alpha = Math.max(0, 1 - (now - msg.timestamp) / 5000);
      ctx.globalAlpha = alpha;

      const textW = Math.min(msg.text.length * 7, 160);
      const bubbleX = sx - textW / 2 + 7;
      const bubbleY = sy - 26;

      ctx.fillStyle = 'rgba(0, 20, 40, 0.9)';
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      const rr = 3;
      ctx.beginPath();
      ctx.roundRect(bubbleX, bubbleY, textW + 10, 16, rr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00ffff';
      ctx.font = '9px "Share Tech Mono"';
      ctx.fillText(msg.text.slice(0, 22), bubbleX + 5, bubbleY + 3);
      ctx.font = FONT;
      ctx.globalAlpha = 1;
    }

    // ── Vignette ──────────────────────────────────────────

    const vign = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    vign.addColorStop(0, 'transparent');
    vign.addColorStop(1, 'rgba(0, 0, 10, 0.7)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Weather system ────────────────────────────────────────

  private updateWeather(dt: number): void {
    const count = this.weather === 'clear' ? 0
      : this.weather === 'glitch' ? 3
      : Math.floor(this.weatherIntensity * 5);

    for (let i = 0; i < count; i++) {
      this.spawnParticle();
    }

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    this.particles = this.particles.filter(p => p.life > 0 && p.y < this.canvas.height + 30);
  }

  private spawnParticle(): void {
    const W = this.canvas.width;
    const chars: Record<WeatherType, string[]> = {
      clear: [],
      rain: ['|', '¦', '╎'],
      snow: ['*', '·', '°', '❄'],
      storm: ['/', '|', '\\', '~'],
      glitch: ['█', '░', '▓', '▒', '?', '!', '#', '@'],
    };

    const colors: Record<WeatherType, string> = {
      clear: '#000',
      rain: '#004488',
      snow: '#aaddff',
      storm: '#6600aa',
      glitch: '#ff00ff',
    };

    const charSet = chars[this.weather];
    if (charSet.length === 0) return;

    const isGlitch = this.weather === 'glitch';

    this.particles.push({
      x: Math.random() * W,
      y: isGlitch ? Math.random() * this.canvas.height : -10,
      vx: isGlitch ? (Math.random() - 0.5) * 30 : (this.weather === 'storm' ? 40 : 0),
      vy: isGlitch ? 0 : (this.weather === 'snow' ? 20 : 80),
      char: charSet[Math.floor(Math.random() * charSet.length)],
      color: colors[this.weather],
      alpha: 0.6 + Math.random() * 0.4,
      life: isGlitch ? 0.1 + Math.random() * 0.3 : 2 + Math.random() * 2,
      maxLife: isGlitch ? 0.4 : 4,
    });
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    ctx.font = '11px "Share Tech Mono"';
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha * 0.7;
      ctx.fillStyle = p.color;
      ctx.fillText(p.char, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.font = FONT;
  }

  // ── Minimap ───────────────────────────────────────────────

  renderMinimap(
    players: Map<string, Player>,
    localPlayerId: string
  ): HTMLCanvasElement {
    const mc = this.minimapCtx;
    const MW = this.minimapCanvas.width;
    const MH = this.minimapCanvas.height;
    const scale = 3; // 1 minimap px = 3 world tiles

    mc.fillStyle = '#030712';
    mc.fillRect(0, 0, MW, MH);

    const localPlayer = players.get(localPlayerId);
    if (!localPlayer) return this.minimapCanvas;

    const cx = localPlayer.x;
    const cy = localPlayer.y;
    const startX = cx - Math.floor(MW / scale / 2);
    const startY = cy - Math.floor(MH / scale / 2);

    for (let my = 0; my < MH; my++) {
      for (let mx = 0; mx < MW; mx++) {
        const wx = startX + Math.floor(mx / scale);
        const wy = startY + Math.floor(my / scale);
        const tile = this.world.getTile(wx, wy);
        if (!tile) continue;

        let color = '#0a0f1e';
        if (tile.terrain === '~') color = '#0a2a4a';
        else if (tile.terrain === '#') color = '#3a3a3a';
        else if (tile.plant) {
          const pDef = PLANT_DEFS[tile.plant];
          color = pDef?.color ?? '#00ff88';
        } else {
          color = '#0a1a0a';
        }

        mc.fillStyle = color;
        mc.fillRect(mx, my, 1, 1);
      }
    }

    // Draw players
    for (const [pid, player] of players) {
      const dx = player.x - startX;
      const dy = player.y - startY;
      const mx = Math.floor(dx * scale / scale + (player.x - startX) / 1);
      const my = Math.floor((player.y - startY));
      const mmx = Math.floor((player.x - startX) * scale / scale);
      // Simple: just dot at normalized position
      const px = Math.floor(((player.x - startX) / (MW / scale)) * MW);
      const py = Math.floor(((player.y - startY) / (MH / scale)) * MH);
      if (px < 0 || py < 0 || px >= MW || py >= MH) continue;
      mc.fillStyle = pid === localPlayerId ? '#ffffff' : player.color;
      mc.fillRect(px - 1, py - 1, 3, 3);
    }

    // Border
    mc.strokeStyle = '#1a2a4a';
    mc.lineWidth = 1;
    mc.strokeRect(0, 0, MW, MH);

    return this.minimapCanvas;
  }

  // Helper: fade a color by alpha
  private fadeColor(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
