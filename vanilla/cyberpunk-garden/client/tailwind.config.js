/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', '"Courier New"', 'monospace'],
      },
      colors: {
        neon: {
          green: '#00ff88',
          cyan: '#00ffff',
          magenta: '#ff00ff',
          orange: '#ff8800',
          yellow: '#ffff00',
        },
        dark: {
          bg: '#030712',
          panel: '#0a0f1e',
          border: '#1a2a4a',
        },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        scanline: 'scanline 8s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        flicker: 'flicker 0.15s infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        scanline: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
        'glow-pulse': { '0%, 100%': { opacity: '0.8' }, '50%': { opacity: '1' } },
        flicker: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.95' } },
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
