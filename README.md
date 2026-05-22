# netgarden-ai-arena

A multiplayer ASCII cyberpunk garden world used as an environment for progressively more sophisticated AI agents. Each phase introduces a new AI paradigm — from hand-crafted heuristics to reinforcement learning to LLM-driven decision making.

Built as a portfolio project to demonstrate applied AI engineering across the full stack.

```
╔══════════════════════════════════════════════════════╗
║  NETGARDEN OS v2.077                                 ║
║  > loading agent policies...              [OK]       ║
║  > initializing arena...                  [OK]       ║
║  > synchronizing opponents...             [OK]       ║
║  > entering garden...                                ║
╚══════════════════════════════════════════════════════╝
```

---

## What is this

Two AI agents compete in a shared grid world rendered in ASCII. They move around, plant objects to score points, and try to reach a target score before the opponent. The world is procedurally generated, persists between sessions, and runs in real time with Socket.io.

The game is a vehicle. The actual point is what drives the agents — and watching how radically the behaviour changes as you swap the AI backend.

---

## Repo structure

```
netgarden-ai-arena/
├── vanilla/          # Phase 0 — base multiplayer game, no agents
├── rule-based/       # Phase 1 — heuristic scoring agents
├── q-learning/       # Phase 2 — tabular Q-learning agents
├── llm-agents/       # Phase 3 — Claude-powered agents with narration
└── README.md
```

Each phase is fully self-contained: its own server, client, Docker setup, and README. You can run any phase independently.

---

## Phases

### Phase 0 — Vanilla (`/vanilla`)

The base game. A shared multiplayer ASCII garden with real-time Socket.io sync, procedural terrain generation, fog of war, weather effects, ambient synthesizer audio, and a CRT terminal aesthetic.

No agents. Just the world.

**Stack:** Node.js · Express · Socket.io · SQLite · HTML5 Canvas · Web Audio API

---

### Phase 1 — Rule-Based Agents (`/rule-based`)

Two agents compete using weighted heuristic scoring functions. Every action is scored across five features and the agent always picks the highest-scoring option. The weights are the hyperparameters — exposed as live sliders in the UI.

```
score(action) =
    w₁ × territory_advantage
  + w₂ × rare_plant_opportunity
  + w₃ × opponent_proximity (aggression)
  + w₄ × expansion_distance
  + w₅ × cluster_density
```

**What you control:**
- 5 weight sliders per agent, adjustable mid-match
- 5 strategy presets (Balanced, Territorial Warlord, Rare Hunter, Speed Rusher, Defensive Cluster)

**What to observe:**
- How radically strategy changes with weight shifts
- That every decision is fully explainable — the score breakdown is shown per action
- That "aggression" and "clustering" are in direct tension — classic multi-objective tradeoff

**Port:** 3001

---

### Phase 2 — Q-Learning Agents (`/q-learning`)

Agents learn by playing thousands of episodes server-side. A tabular Q-learning implementation from scratch — no libraries, just the Bellman equation.

```
Q(s,a) ← Q(s,a) + α [ r + γ · maxₐ Q(s',a') − Q(s,a) ]
```

State space is discretized to keep the Q-table tractable (~2,400 states). Training runs in non-blocking `setImmediate` bursts so Socket.io stays responsive. The browser receives live updates every 10 episodes.

**Two modes:**
- `TRAIN` — fast headless episodes, streams reward curve and Q-value heatmap
- `MATCH` — agents freeze learning (ε → 0.05) and compete at human-viewable speed

**What you control:**

| Parameter | Effect |
|-----------|--------|
| α (learning rate) | How fast Q-values update |
| γ (discount factor) | How much future rewards matter |
| ε (exploration) | Random vs greedy action selection |
| ε decay | How quickly the agent commits to its policy |

**What to observe:**
- Reward curve trends upward as policy improves
- Q-value heatmap shows which tiles the agent has learned to value
- ε bar shrinks in real time as training progresses
- Lowering γ makes agents short-sighted and aggressive; raising it makes them strategic

**Port:** 3002

---

### Phase 3 — LLM Agents (`/llm-agents`) *(coming soon)*

Each agent is driven by Claude. On every turn, the local world state is serialised and sent to the API. The model decides the action. A narration layer explains each decision in plain English as it happens.

Agent personality and strategy are controlled via prompt parameters — sliders become system prompt injections.

**Port:** 3003

---

## Running the project

### Prerequisites

- Node.js 18+
- Docker (optional)

### Local development

```bash
# Phase 1
cd rule-based/server
npm install && npm start
# → http://localhost:3001

# Phase 2
cd q-learning/server
npm install && npm start
# → http://localhost:3002
```

### Docker

Each phase has its own `Dockerfile` and `docker-compose.yml`.

```bash
# Phase 1
cd rule-based
docker compose up --build

# Phase 2
cd q-learning
docker compose up --build

# Dev mode (hot reload via nodemon)
docker compose --profile dev up
```

### Run all phases simultaneously

```bash
cd rule-based  && docker compose up -d --build
cd ../q-learning && docker compose up -d --build
```

Phases run on separate ports and do not share state.

---

## The game

### Scoring

```
score = Σ plant_points
```

| Plant | Symbol | Points | Rarity |
|-------|--------|--------|--------|
| Neon Flower | `*` | 1 | Common |
| Data Tree | `T` | 1 | Common |
| Crystal | `^` | 1 | Common |
| Synth Shrub | `Y` | 1 | Common |
| Credit Bloom | `$` | 4 | Rare |
| Ghost Vine | `&` | 4 | Rare |
| Netrunner Rose | `@` | 5 | Rare |
| Unknown Entity | `?` | 6 | Rare |

First agent to the target score wins (20 pts in Phase 1, 25 in Phase 2).

### Terrain

| Tile | Meaning |
|------|---------|
| `.` | Grass — plantable |
| `~` | Water — impassable |
| `#` | Rock — impassable |
| `,` | Marsh — plantable |

Terrain is generated procedurally using multi-octave fractional Brownian motion with a deterministic hash. No external noise library — just arithmetic.

---

## AI engineering highlights

**Phase 1 — interpretability by design.** Every heuristic agent decision includes a full score breakdown per weight. You can see exactly why the agent made the choice it did. This mirrors real explainability requirements in production AI systems.

**Phase 2 — non-blocking training architecture.** Q-learning runs in `setImmediate` bursts, yielding to the event loop between bursts so Socket.io connections stay alive. A naive `while` loop would block all clients during training. This is a real production concern for any server-side RL system.

**Phase 2 — reward shaping.** The reward function is non-trivial: blocking bonus for planting near opponent, penalties for redundant moves and idling, terminal rewards for win/loss. Reward shaping is one of the most impactful and underappreciated skills in applied RL.

**Phase 3 — LLM as policy.** Using a language model as the decision function means the "policy" is a natural language description of the agent's goals. This maps directly to how agentic AI systems are built in industry — prompt engineering as policy engineering.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js, Express, Socket.io |
| Client | Vanilla HTML/CSS/JS, HTML5 Canvas |
| Persistence | SQLite (vanilla phase) |
| Rendering | ASCII on Canvas, Web Audio API |
| Containerisation | Docker, Docker Compose |
| AI (Phase 1) | Weighted heuristic scoring |
| AI (Phase 2) | Tabular Q-learning (from scratch) |
| AI (Phase 3) | Anthropic Claude API |

---
