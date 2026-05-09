// ============================================================
// HUD OVERLAY — status panels, minimap, chat, plant picker
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import type { Player, ChatMessage, WeatherType, Season, PlantType } from '../../../shared/src/types.js';
import { PLANT_DEFS } from '../../../shared/src/types.js';

interface HudProps {
  localPlayer: Player | null;
  onlineCount: number;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onPlant: (plantType: PlantType) => void;
  onRemove: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  weather: WeatherType;
  season: Season;
  minimapCanvas: HTMLCanvasElement | null;
  hoveredTile: { x: number; y: number; tile: any } | null;
  selectedPlant: PlantType;
  setSelectedPlant: (p: PlantType) => void;
  audioEnabled: boolean;
  setAudioEnabled: (v: boolean) => void;
}

const SEASON_COLORS: Record<Season, string> = {
  spring: '#00ff88',
  summer: '#ffff00',
  autumn: '#ff8800',
  winter: '#88ccff',
};

const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: '○',
  rain: '≋',
  snow: '❄',
  storm: '⚡',
  glitch: '▒',
};

export const HudOverlay: React.FC<HudProps> = ({
  localPlayer,
  onlineCount,
  chatMessages,
  onSendChat,
  onPlant,
  onRemove,
  chatOpen,
  setChatOpen,
  weather,
  season,
  minimapCanvas,
  hoveredTile,
  selectedPlant,
  setSelectedPlant,
  audioEnabled,
  setAudioEnabled,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [showPlantMenu, setShowPlantMenu] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) chatInputRef.current?.focus();
  }, [chatOpen]);

  // Sync minimap canvas
  useEffect(() => {
    if (!minimapCanvas || !minimapRef.current) return;
    const ctx = minimapRef.current.getContext('2d');
    if (!ctx) return;
    minimapRef.current.width = minimapCanvas.width;
    minimapRef.current.height = minimapCanvas.height;
    ctx.drawImage(minimapCanvas, 0, 0);
  });

  const submitChat = () => {
    const text = chatInput.trim();
    if (text) {
      onSendChat(text);
      setChatInput('');
    }
    setChatOpen(false);
  };

  const panelStyle: React.CSSProperties = {
    background: 'rgba(3, 7, 18, 0.88)',
    border: '1px solid #1a2a4a',
    backdropFilter: 'blur(4px)',
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: '12px',
  };

  const neonBorder: React.CSSProperties = {
    borderColor: '#00ff8844',
    boxShadow: '0 0 10px rgba(0, 255, 136, 0.1)',
  };

  return (
    <>
      {/* ── Top-left status ─────────────────────────────── */}
      <div className="fixed top-3 left-3 z-20 flex flex-col gap-2">
        <div style={{ ...panelStyle, ...neonBorder, padding: '8px 12px', minWidth: '180px' }}>
          <div style={{ color: '#1a4a6a', marginBottom: '4px' }}>╔══ NETGARDEN ══╗</div>
          <div className="flex justify-between">
            <span style={{ color: '#00ff8888' }}>ONLINE</span>
            <span style={{ color: '#00ffff' }}>{onlineCount}</span>
          </div>
          {localPlayer && (
            <>
              <div className="flex justify-between">
                <span style={{ color: '#00ff8888' }}>COORDS</span>
                <span style={{ color: '#00ff88' }}>
                  {localPlayer.x}:{localPlayer.y}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#00ff8888' }}>SEEDS</span>
                <span style={{ color: '#ff8800' }}>
                  {'█'.repeat(Math.min(localPlayer.seeds, 14))}
                  {' '}
                  <span style={{ color: '#ff8800aa' }}>{localPlayer.seeds}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#00ff8888' }}>AGENT</span>
                <span style={{ color: localPlayer.color }}>{localPlayer.name}</span>
              </div>
            </>
          )}
          <div className="flex justify-between mt-1">
            <span style={{ color: '#00ff8888' }}>ENV</span>
            <span style={{ color: SEASON_COLORS[season] }}>
              {season.toUpperCase()} {WEATHER_ICONS[weather]}
            </span>
          </div>
          <div style={{ color: '#1a4a6a', marginTop: '4px' }}>╚══════════════╝</div>
        </div>
      </div>

      {/* ── Top-right minimap ────────────────────────────── */}
      <div
        className="fixed top-3 right-3 z-20"
        style={{ ...panelStyle, ...neonBorder, padding: '6px' }}
      >
        <div style={{ color: '#00ff8866', fontSize: '10px', marginBottom: '3px' }}>
          ▸ MINIMAP
        </div>
        <canvas
          ref={minimapRef}
          style={{
            display: 'block',
            border: '1px solid #0a1a2a',
            imageRendering: 'pixelated',
          }}
        />
      </div>

      {/* ── Plant selector ───────────────────────────────── */}
      <div className="fixed left-3 bottom-20 z-20">
        <div
          style={{ ...panelStyle, ...neonBorder, padding: '6px 10px', cursor: 'pointer' }}
          onClick={() => setShowPlantMenu(!showPlantMenu)}
        >
          <div style={{ color: '#00ff8866', fontSize: '10px' }}>▸ SEED [P]</div>
          <div style={{ fontSize: '16px', color: PLANT_DEFS[selectedPlant]?.color ?? '#00ff88' }}>
            {selectedPlant}
            <span style={{ color: '#ffffff44', fontSize: '10px', marginLeft: '6px' }}>
              {PLANT_DEFS[selectedPlant]?.name}
            </span>
          </div>
        </div>

        {showPlantMenu && (
          <div
            className="animate-fade-in"
            style={{ ...panelStyle, ...neonBorder, padding: '8px', marginTop: '4px', width: '220px' }}
          >
            <div style={{ color: '#00ff8866', fontSize: '10px', marginBottom: '6px' }}>
              SELECT SEED TYPE:
            </div>
            <div className="grid grid-cols-2 gap-1">
              {Object.values(PLANT_DEFS).map(def => (
                <button
                  key={def.symbol}
                  onClick={() => { setSelectedPlant(def.symbol); setShowPlantMenu(false); }}
                  style={{
                    background: selectedPlant === def.symbol ? '#0a1a0a' : 'transparent',
                    border: `1px solid ${selectedPlant === def.symbol ? def.color : '#1a2a4a'}`,
                    color: def.color,
                    fontFamily: 'Share Tech Mono',
                    fontSize: '11px',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                    textShadow: `0 0 6px ${def.color}`,
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{def.symbol}</span>
                  <div>
                    <div style={{ fontSize: '10px' }}>{def.name}</div>
                    <div style={{ color: '#ff880088', fontSize: '9px' }}>
                      {def.seedCost}🌱 {def.rare ? '★RARE' : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Controls help ────────────────────────────────── */}
      <div className="fixed right-3 bottom-20 z-20">
        <div style={{ ...panelStyle, padding: '6px 10px', fontSize: '10px' }}>
          <div style={{ color: '#00ff8866', marginBottom: '3px' }}>▸ CONTROLS</div>
          {[
            ['WASD/↑↓←→', 'move'],
            ['P', 'plant seed'],
            ['R', 'remove plant'],
            ['E', 'interact'],
            ['Enter', 'chat'],
          ].map(([key, action]) => (
            <div key={key} className="flex justify-between gap-4">
              <span style={{ color: '#00ffff88' }}>[{key}]</span>
              <span style={{ color: '#ffffff44' }}>{action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat log ─────────────────────────────────────── */}
      <div className="fixed left-3 z-20" style={{ bottom: chatOpen ? '56px' : '56px' }}>
        <div style={{ ...panelStyle, width: '280px', maxHeight: '140px', overflowY: 'auto', padding: '6px 10px' }}>
          <div style={{ color: '#00ff8866', fontSize: '10px', marginBottom: '4px' }}>▸ NETWORK CHAT</div>
          {chatMessages.slice(-20).map(msg => (
            <div key={msg.id} className="animate-fade-in" style={{ fontSize: '11px', lineHeight: '1.5' }}>
              <span style={{ color: '#00ffff88' }}>{msg.playerName.slice(0, 10)}</span>
              <span style={{ color: '#ffffff33' }}> › </span>
              <span style={{ color: '#ffffff99' }}>{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Bottom terminal bar ───────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20" style={{ ...panelStyle, borderTop: '1px solid #1a2a4a', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#00ff8888' }}>›</span>
        {chatOpen ? (
          <input
            ref={chatInputRef}
            className="terminal-input"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitChat();
              if (e.key === 'Escape') { setChatOpen(false); setChatInput(''); }
            }}
            placeholder="broadcast message... (Enter to send, Esc to cancel)"
            maxLength={120}
          />
        ) : (
          <span style={{ color: '#ffffff22', fontSize: '12px' }}>
            NETGARDEN ONLINE — press Enter to chat, P to plant, R to remove
          </span>
        )}
        {!chatOpen && <span className="animate-blink" style={{ color: '#00ff88' }}>█</span>}

        {/* Audio toggle */}
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: `1px solid ${audioEnabled ? '#00ff8844' : '#ff000033'}`,
            color: audioEnabled ? '#00ff8888' : '#ff000066',
            fontFamily: 'Share Tech Mono',
            fontSize: '10px',
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          {audioEnabled ? '♪ ON' : '♪ OFF'}
        </button>
      </div>

      {/* ── Hovered tile info ─────────────────────────────── */}
      {hoveredTile?.tile && (
        <div
          className="fixed z-20 animate-fade-in"
          style={{
            ...panelStyle,
            top: '50%',
            right: '140px',
            transform: 'translateY(-50%)',
            padding: '6px 12px',
            fontSize: '10px',
            borderColor: '#00ffff44',
          }}
        >
          <div style={{ color: '#00ffff88' }}>▸ TILE INFO</div>
          <div>
            <span style={{ color: '#ffffff44' }}>pos:</span>{' '}
            <span style={{ color: '#00ff88' }}>{hoveredTile.x},{hoveredTile.y}</span>
          </div>
          <div>
            <span style={{ color: '#ffffff44' }}>terrain:</span>{' '}
            <span style={{ color: '#00ff88' }}>{hoveredTile.tile.terrain}</span>
          </div>
          {hoveredTile.tile.plant && (
            <>
              <div>
                <span style={{ color: '#ffffff44' }}>plant:</span>{' '}
                <span style={{ color: PLANT_DEFS[hoveredTile.tile.plant]?.color ?? '#fff' }}>
                  {hoveredTile.tile.plant} {PLANT_DEFS[hoveredTile.tile.plant]?.name}
                </span>
              </div>
              {hoveredTile.tile.ownerName && (
                <div>
                  <span style={{ color: '#ffffff44' }}>by:</span>{' '}
                  <span style={{ color: '#ff00ff88' }}>{hoveredTile.tile.ownerName}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};
