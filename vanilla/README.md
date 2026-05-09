# 🌿 NETGARDEN — Cyberpunk ASCII Multiplayer World

> *A shared online garden rendered entirely in ASCII/Unicode characters with neon cyberpunk aesthetics. Plant, explore, and connect in real time.*

```
╔══════════════════════════════════════╗
║  NETGARDEN OS v2.077                 ║
║  > initializing kernel...            ║
║  > loading world chunks...   [OK]    ║
║  > synchronizing clients...  [OK]    ║
║  > entering garden...                ║
╚══════════════════════════════════════╝
```

## Features

- **Real-time multiplayer** via Socket.io with server-authoritative state
- **Procedurally generated infinite world** with terrain variety
- **ASCII/Unicode rendering** on HTML5 Canvas with neon cyberpunk glow effects
- **Plant system** — 10 plant types, including 4 rare glowing varieties
- **Fog of war** — world reveals as you explore
- **Dynamic weather** — rain, snow, storm, glitch effects
- **Season cycles** — spring/summer/autumn/winter palette shifts
- **Ambient synthesizer** — procedurally generated synthwave via Web Audio API
- **Minimap** — real-time canvas minimap
- **Chat system** — floating speech bubbles + chat log
- **SQLite persistence** — world state survives server restarts
- **CRT scanline overlay** — authentic retro terminal feel

## Project Structure

```
cyberpunk-garden/
├── client/               # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── BootTerminal.tsx   # Animated boot sequence
│   │   │   ├── Game.tsx           # Main game orchestrator
│   │   │   └── HudOverlay.tsx     # Status panels, chat, minimap
│   │   ├── systems/
│   │   │   ├── renderer.ts        # HTML5 Canvas ASCII renderer
│   │   │   ├── networkManager.ts  # Socket.io client wrapper
│   │   │   ├── clientWorld.ts     # Client-side world state
│   │   │   ├── inputManager.ts    # Keyboard/mouse input
│   │   │   └── audioManager.ts    # Web Audio API synth
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── ...config files
├── server/               # Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── db/
│   │   │   └── database.ts        # SQLite layer (better-sqlite3)
│   │   ├── systems/
│   │   │   ├── worldGen.ts        # Procedural terrain generation
│   │   │   ├── worldManager.ts    # Authoritative world state
│   │   │   └── playerManager.ts   # Online player tracking
│   │   └── index.ts               # Express + Socket.io server
│   └── ...config files
├── shared/               # Types shared by client and server
│   └── src/types.ts
├── data/                 # SQLite database (auto-created)
│   └── garden.db
└── demo/
    └── index.html        # Self-contained single-file demo
```

## Quick Start

### Demo (No Server Required)

Open `demo/index.html` in any modern browser for a local single-player demo with simulated bots and full visual experience.

### Full Multiplayer Setup

#### Prerequisites
- Node.js 18+
- npm or yarn

#### 1. Install dependencies

```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

#### 2. Start the server

```bash
cd server
npm run dev
# Server runs on http://localhost:3001
```

#### 3. Start the client

```bash
cd client
npm run dev
# Client runs on http://localhost:5173
```

#### 4. Open in browser

Navigate to `http://localhost:5173` and watch the boot sequence!

## Controls

| Key | Action |
|-----|--------|
| `WASD` / `↑↓←→` | Move |
| `P` | Plant selected seed at current position |
| `R` | Remove plant at current position |
| `E` | Inspect current tile |
| `Enter` | Open chat |
| `Click` | Plant on adjacent tile |
| `Right-click` | Remove plant |

## Plant Types

| Symbol | Name | Cost | Rarity |
|--------|------|------|--------|
| `*` | Neon Flower | 1 🌱 | Common |
| `T` | Data Tree | 2 🌱 | Common |
| `^` | Crystal | 2 🌱 | Common |
| `Y` | Synth Shrub | 1 🌱 | Common |
| `o` | Orb Moss | 1 🌱 | Common |
| `$` | Credit Bloom | 5 🌱 | ★ RARE |
| `&` | Ghost Vine | 4 🌱 | ★ RARE |
| `@` | Netrunner Rose | 5 🌱 | ★ RARE |
| `!` | Signal Spike | 1 🌱 | Common |
| `?` | Unknown Entity | 8 🌱 | ★ RARE |

## Terrain Types

| Char | Terrain |
|------|---------|
| `.` | Grass (plantable) |
| `~` | Water (impassable) |
| `#` | Rock wall (impassable) |
| `,` | Marsh (plantable) |
| `:` | Dense undergrowth |
| `░` | Fog patch |

## Environment Variables

### Server
```env
PORT=3001
CLIENT_URL=http://localhost:5173
```

### Client
```env
VITE_SERVER_URL=http://localhost:3001
```

## Deployment

### Docker (recommended)

```dockerfile
# Build server
FROM node:20-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --production
COPY server/ ./
COPY shared/ ../shared/
RUN npm run build

# Build client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
COPY shared/ ../shared/
RUN npm run build

# Final image
FROM node:20-alpine
WORKDIR /app
COPY --from=server /app/server/dist ./server/dist
COPY --from=server /app/server/node_modules ./server/node_modules
COPY --from=client-builder /app/client/dist ./client/dist
RUN mkdir -p data
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
```

### Fly.io / Railway / Render

1. Set `PORT` env var
2. Set `CLIENT_URL` to your domain
3. Mount a persistent volume at `/app/data` for SQLite
4. Deploy server; host client on CDN (Vercel/Netlify)

## Architecture Notes

### Server Authority
All world mutations go through the server. Clients send intents (move, plant, remove) and receive authoritative state back. This prevents cheating and ensures consistency.

### Chunk System
The world is divided into 32×32 tile chunks. Chunks are generated procedurally on demand and overlaid with DB-persisted changes (planted objects). Idle chunks unload from memory after 5 minutes.

### Renderer
The ASCII renderer uses HTML5 Canvas with monospace character cells (14×16px). Each frame draws terrain, plants with glow effects, players with color halos, and weather particles. Camera uses smooth lerp interpolation.

### Audio
All sound is generated procedurally via Web Audio API. No audio files needed. The ambient track uses oscillators, LFOs, and a convolution reverb for a synthwave drone. Sound effects use short oscillator bursts.

### Procedural Generation
World terrain uses 4-octave fractional Brownian motion (fBm) noise with a deterministic hash function. No external noise library required. The same seed always produces the same terrain.

---

*"The garden glows eternal in the net."*
