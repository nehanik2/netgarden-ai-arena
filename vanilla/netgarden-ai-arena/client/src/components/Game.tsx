// ============================================================
// GAME COMPONENT — core game loop, state, orchestration
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Player, ChatMessage, PlantType, WeatherType, Season } from '../../../shared/src/types.js';
import { tileToChunk } from '../../../shared/src/types.js';
import { network } from '../systems/networkManager.js';
import { clientWorld } from '../systems/clientWorld.js';
import { AsciiRenderer } from '../systems/renderer.js';
import { InputManager } from '../systems/inputManager.js';
import { audio } from '../systems/audioManager.js';
import { HudOverlay } from './HudOverlay.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

interface GameProps {
  onBooted: boolean;
}

export const Game: React.FC<GameProps> = ({ onBooted }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AsciiRenderer | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Game state
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherType>('clear');
  const [season, setSeason] = useState<Season>('spring');
  const [selectedPlant, setSelectedPlant] = useState<PlantType>('*');
  const [audioEnabled, setAudioEnabledState] = useState(true);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number; tile: any } | null>(null);
  const [minimapCanvas, setMinimapCanvas] = useState<HTMLCanvasElement | null>(null);
  const [connected, setConnected] = useState(false);

  // Cursor position for custom cursor
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // ── Network setup ─────────────────────────────────────────

  useEffect(() => {
    if (!onBooted) return;

    network.connect(SERVER_URL);

    const unsubs = [
      network.on('connect', () => {
        setConnected(true);
        audio.resume();
      }),

      network.on('disconnect', () => setConnected(false)),

      network.on('welcome', ({ player, nearbyPlayers, chunk }) => {
        setLocalPlayer(player);
        clientWorld.ingestChunk(chunk);

        setPlayers(prev => {
          const next = new Map(prev);
          next.set(player.id, player);
          for (const p of nearbyPlayers) next.set(p.id, p);
          return next;
        });

        setOnlineCount(prev => Math.max(prev, nearbyPlayers.length + 1));

        // Update renderer camera
        rendererRef.current?.setTarget(player.x, player.y);

        // Request nearby chunks
        const { cx, cy } = tileToChunk(player.x, player.y);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!clientWorld.hasChunk(cx + dx, cy + dy)) {
              network.requestChunk(cx + dx, cy + dy);
            }
          }
        }
      }),

      network.on('chunk_data', chunk => {
        clientWorld.ingestChunk(chunk);
      }),

      network.on('world_update', update => {
        if (update.type === 'tile_changed') {
          clientWorld.setTile(update.tile);
        } else {
          clientWorld.removePlant(update.tile);
        }
      }),

      network.on('player_moved', ({ id, x, y }) => {
        setPlayers(prev => {
          const next = new Map(prev);
          const p = next.get(id);
          if (p) next.set(id, { ...p, x, y });
          return next;
        });
      }),

      network.on('player_joined', player => {
        setPlayers(prev => new Map(prev).set(player.id, player));
        setOnlineCount(prev => prev + 1);
      }),

      network.on('player_left', ({ id }) => {
        setPlayers(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        setOnlineCount(prev => Math.max(1, prev - 1));
      }),

      network.on('chat_message', msg => {
        setChatMessages(prev => [...prev.slice(-49), msg]);
        audio.playChat();
      }),

      network.on('weather', ({ type }) => {
        setWeather(type);
        if (rendererRef.current) rendererRef.current.weather = type;
      }),

      network.on('season', ({ season }) => {
        setSeason(season);
        if (rendererRef.current) rendererRef.current.season = season;
      }),
    ];

    return () => {
      unsubs.forEach(u => u());
      network.disconnect();
    };
  }, [onBooted]);

  // ── Input setup ───────────────────────────────────────────

  useEffect(() => {
    if (!onBooted) return;

    const input = new InputManager();
    inputRef.current = input;

    const unsub = input.onAction(action => {
      const lp = localPlayer;
      if (!lp) return;

      let newX = lp.x;
      let newY = lp.y;

      switch (action) {
        case 'move_up':    newY--; break;
        case 'move_down':  newY++; break;
        case 'move_left':  newX--; break;
        case 'move_right': newX++; break;
        case 'plant':
          network.plant(lp.x, lp.y, selectedPlant);
          audio.playPlant();
          return;
        case 'remove':
          network.remove(lp.x, lp.y);
          audio.playRemove();
          return;
        case 'chat':
          setChatOpen(true);
          return;
        case 'interact':
          // Show tile info
          const tile = clientWorld.getTile(lp.x, lp.y);
          if (tile) setHoveredTile({ x: lp.x, y: lp.y, tile });
          return;
      }

      if (newX !== lp.x || newY !== lp.y) {
        setLocalPlayer(prev => prev ? { ...prev, x: newX, y: newY } : prev);
        setPlayers(prev => {
          const next = new Map(prev);
          const p = next.get(lp.id);
          if (p) next.set(lp.id, { ...p, x: newX, y: newY });
          return next;
        });
        network.move(newX, newY);
        audio.playMove();
        rendererRef.current?.setTarget(newX, newY);

        // Load chunks at new position
        const { cx, cy } = tileToChunk(newX, newY);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!clientWorld.hasChunk(cx + dx, cy + dy)) {
              network.requestChunk(cx + dx, cy + dy);
            }
          }
        }
      }
    });

    return () => {
      unsub();
      input.destroy();
    };
  }, [onBooted, localPlayer, selectedPlant]);

  // Suppress input when chat is open
  useEffect(() => {
    inputRef.current?.setSuppressKeys(chatOpen);
  }, [chatOpen]);

  // ── Renderer setup ────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current || !onBooted) return;

    const renderer = new AsciiRenderer(canvasRef.current, clientWorld);
    rendererRef.current = renderer;

    const resize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    // Audio init
    audio.init();
    setAudioEnabledState(true);

    return () => window.removeEventListener('resize', resize);
  }, [onBooted]);

  // ── Game loop ─────────────────────────────────────────────

  useEffect(() => {
    if (!onBooted || !rendererRef.current) return;

    const loop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const renderer = rendererRef.current!;
      const localId = localPlayer?.id ?? '';

      // Render world
      renderer.render(players, localId, chatMessages, dt);

      // Minimap
      const mm = renderer.renderMinimap(players, localId);
      setMinimapCanvas(mm);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [onBooted, players, chatMessages, localPlayer]);

  // ── Mouse tracking ────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });

    if (!rendererRef.current) return;
    const { x, y } = rendererRef.current.screenToWorld(e.clientX, e.clientY);
    const tile = clientWorld.getTile(x, y);
    if (tile) setHoveredTile({ x, y, tile });
    else setHoveredTile(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current || !localPlayer) return;
    const { x, y } = rendererRef.current.screenToWorld(e.clientX, e.clientY);
    const dx = Math.abs(x - localPlayer.x);
    const dy = Math.abs(y - localPlayer.y);
    if (dx <= 1 && dy <= 1) {
      // Click to plant/remove on adjacent tiles
      if (e.button === 0) {
        network.plant(x, y, selectedPlant);
        audio.playPlant();
      }
    }
  }, [localPlayer, selectedPlant]);

  const handleAudioToggle = useCallback((enabled: boolean) => {
    setAudioEnabledState(enabled);
    audio.setEnabled(enabled);
  }, []);

  const handleSendChat = useCallback((text: string) => {
    network.chat(text, true);
  }, []);

  if (!onBooted) return null;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#030712' }}>
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        id="game-canvas"
        style={{ display: 'block', cursor: 'none' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Custom cursor */}
      <div
        className="custom-cursor"
        style={{
          left: cursorPos.x,
          top: cursorPos.y,
          color: '#00ffff',
          textShadow: '0 0 8px #00ffff',
          pointerEvents: 'none',
          position: 'fixed',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '16px',
          zIndex: 9998,
        }}
      >
        +
      </div>

      {/* CRT overlay */}
      <div className="crt-overlay" />

      {/* Connection status */}
      {!connected && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          style={{
            background: 'rgba(3,7,18,0.95)',
            border: '1px solid #ff004444',
            color: '#ff0044',
            fontFamily: 'Share Tech Mono',
            padding: '16px 32px',
            textAlign: 'center',
          }}
        >
          <div className="animate-blink">⚠ CONNECTION LOST</div>
          <div style={{ fontSize: '11px', color: '#ff004488', marginTop: '4px' }}>
            attempting to reconnect...
          </div>
        </div>
      )}

      {/* HUD */}
      <HudOverlay
        localPlayer={localPlayer}
        onlineCount={onlineCount}
        chatMessages={chatMessages}
        onSendChat={handleSendChat}
        onPlant={(plant) => {
          if (localPlayer) {
            network.plant(localPlayer.x, localPlayer.y, plant);
            audio.playPlant();
          }
        }}
        onRemove={() => {
          if (localPlayer) {
            network.remove(localPlayer.x, localPlayer.y);
            audio.playRemove();
          }
        }}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        weather={weather}
        season={season}
        minimapCanvas={minimapCanvas}
        hoveredTile={hoveredTile}
        selectedPlant={selectedPlant}
        setSelectedPlant={setSelectedPlant}
        audioEnabled={audioEnabled}
        setAudioEnabled={handleAudioToggle}
      />
    </div>
  );
};
