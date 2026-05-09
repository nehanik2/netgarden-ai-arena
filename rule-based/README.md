# Phase 1 — Rule-Based Agent Arena

> Two heuristic agents compete in NETGARDEN. Every decision is made by a **weighted scoring function** — the weights are your hyperparameters.

## What's happening

Each agent, on every tick, scores every possible action (move or plant) using this formula:

```
score(action) =
    w_territory  × territorial_advantage(tile)
  + w_rarePlant  × rare_plant_opportunity(tile)
  + w_aggression × adjacency_to_opponent(tile)
  + w_expansion  × distance_from_own_center(tile)
  + w_clustering × proximity_to_own_plants(tile)
  + 0.15 (if planting)
```

The agent always takes the highest-scoring action. Move the sliders → change the weights → watch the strategy shift in real time.

## Scoring

```
score = Σ (plant_points × territory_weight)
rare plants = 4–6 points, common = 1 point
First agent to 20 points wins
```

## Run locally

```bash
cd server
npm install
npm start
# → http://localhost:3001
```

## Run with Docker

```bash
# Production
docker compose up --build

# Dev (hot reload)
docker compose --profile dev up
```

## File structure

```
rule-based/
├── client/
│   └── index.html         # Single-file client, served by Express
├── server/
│   ├── src/
│   │   ├── agent.js       # Heuristic scoring engine
│   │   ├── world.js       # Grid + procedural terrain
│   │   └── gameEngine.js  # Match loop, win detection
│   ├── index.js           # Express + Socket.io entry
│   └── package.json
├── shared/
│   └── constants.js       # Shared by server + client
├── Dockerfile
└── docker-compose.yml
```

## CV talking points

- **Heuristic agent design** — weighted linear scoring functions, feature engineering over spatial game state
- **Real-time hyperparameter control** — weights update live mid-match via Socket.io
- **Transparent decision-making** — every action includes a breakdown of which weights drove it (interpretability)
- **Server-authoritative game loop** — all state on server, clients are pure views
- **Docker-ready** — multi-stage build, health checks, dev/prod profiles
