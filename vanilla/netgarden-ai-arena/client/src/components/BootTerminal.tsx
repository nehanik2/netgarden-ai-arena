// ============================================================
// BOOT TERMINAL — animated startup sequence
// ============================================================

import React, { useEffect, useState } from 'react';

interface BootLine {
  text: string;
  delay: number;
  color?: string;
  prefix?: string;
}

const BOOT_SEQUENCE: BootLine[] = [
  { text: 'NETGARDEN OS v2.077', delay: 0, color: '#00ffff', prefix: '' },
  { text: '─────────────────────────────────', delay: 200, color: '#1a3a5a', prefix: '' },
  { text: 'initializing kernel...', delay: 400, color: '#00ff88', prefix: '> ' },
  { text: 'loading memory banks...          [OK]', delay: 700, color: '#00ff88', prefix: '  ' },
  { text: 'mounting filesystem...           [OK]', delay: 1000, color: '#00ff88', prefix: '  ' },
  { text: 'checking server connection...', delay: 1300, color: '#00ffff', prefix: '> ' },
  { text: 'ping 127.0.0.1 ... 3ms          [OK]', delay: 1800, color: '#00ff88', prefix: '  ' },
  { text: 'authenticating node...           [OK]', delay: 2100, color: '#00ff88', prefix: '  ' },
  { text: 'loading world chunks...', delay: 2400, color: '#ff00ff', prefix: '> ' },
  { text: 'chunk[0,0] → [READY]', delay: 2800, color: '#00ff88', prefix: '  ' },
  { text: 'chunk[1,0] → [READY]', delay: 3000, color: '#00ff88', prefix: '  ' },
  { text: 'chunk[0,1] → [READY]', delay: 3200, color: '#00ff88', prefix: '  ' },
  { text: 'synchronizing clients...', delay: 3400, color: '#ff8800', prefix: '> ' },
  { text: 'socket.io handshake...          [OK]', delay: 3800, color: '#00ff88', prefix: '  ' },
  { text: 'spawning player entity...        [OK]', delay: 4100, color: '#00ff88', prefix: '  ' },
  { text: '─────────────────────────────────', delay: 4300, color: '#1a3a5a', prefix: '' },
  { text: 'WELCOME TO THE GARDEN', delay: 4500, color: '#ff00ff', prefix: '' },
  { text: 'entering world...', delay: 4800, color: '#ffff00', prefix: '> ' },
];

interface BootTerminalProps {
  onComplete: () => void;
}

export const BootTerminal: React.FC<BootTerminalProps> = ({ onComplete }) => {
  const [visibleLines, setVisibleLines] = useState<BootLine[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_SEQUENCE.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleLines(prev => [...prev, line]);
          if (i === BOOT_SEQUENCE.length - 1) {
            setTimeout(() => {
              setDone(true);
              setTimeout(onComplete, 600);
            }, 800);
          }
        }, line.delay)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: '#030712' }}
    >
      {/* CRT scanlines */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
      }} />

      <div
        className="relative max-w-lg w-full mx-6"
        style={{
          opacity: done ? 0 : 1,
          transition: 'opacity 0.5s ease-out',
        }}
      >
        {/* Terminal window */}
        <div style={{
          border: '1px solid #1a3a5a',
          background: 'rgba(3, 7, 18, 0.97)',
          boxShadow: '0 0 40px rgba(0, 255, 136, 0.15), 0 0 80px rgba(0, 255, 255, 0.05)',
          padding: '20px 24px',
          minHeight: '360px',
        }}>
          {/* Title bar */}
          <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid #0a1a2a' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#ff5f57' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#ffbd2e' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#28c840' }} />
            <span className="ml-3 text-xs" style={{ color: '#1a3a5a', fontFamily: 'Share Tech Mono, monospace' }}>
              TERMINAL — netgarden.sys
            </span>
          </div>

          {/* Lines */}
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '13px', lineHeight: '1.7' }}>
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className="animate-fade-in"
                style={{ color: line.color ?? '#00ff88' }}
              >
                <span style={{ color: '#1a4a3a' }}>{line.prefix}</span>
                {line.text}
              </div>
            ))}

            {/* Blinking cursor */}
            {!done && (
              <span
                style={{ color: '#00ff88', fontFamily: 'Share Tech Mono, monospace' }}
                className="animate-blink"
              >█</span>
            )}
          </div>
        </div>

        {/* Scanline effect on terminal */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.04) 50%)',
          backgroundSize: '100% 4px',
        }} />
      </div>
    </div>
  );
};
