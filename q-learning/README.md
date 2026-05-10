# Phase 2 — Q-Learning Agent Arena

> Agents learn by playing thousands of episodes server-side. Watch the policy emerge live via reward curves and Q-value heatmaps.

## The algorithm

```
Q(s,a) ← Q(s,a) + α [ r + γ · max Q(s',a') − Q(s,a) ]
              ↑             ↑         ↑
        learning rate  reward  discounted future value
```

### State space (discretized)
```
state = (zone_x, zone_y, can_plant, rare_dist_bucket, opponent_dist_bucket)
      ≈ 2,400 unique states
```

### Action space
```
[move_n, move_s, move_e, move_w, plant, idle]
```

### Reward shaping
| Event | Reward |
|-------|--------|
| Plant common | +1.0 |
| Plant rare | +5.0 |
| Move to empty tile | +0.1 |
| Move to own tile | -0.2 |
| Block opponent (within 5 tiles) | +0.5 |
| Idle | -0.1 |
| Win episode | +20.0 |
| Lose episode | -10.0 |

## User-controllable hyperparameters

| Param | Effect |
|-------|--------|
| **α (learning rate)** | High → fast but unstable; low → slow but stable |
| **γ (discount)** | High → plans far ahead; low → greedy/myopic |
| **ε (exploration)** | High → random; low → exploits current policy |
| **ε decay** | How quickly agent transitions from explore→exploit |

## Two modes

**TRAINING** — Runs episodes as fast as Node.js allows (~500–2000 eps/sec). Broadcasts reward curve + heatmap every 10/20 episodes. Non-blocking via `setImmediate` bursts.

**MATCH** — Agents freeze learning (ε=0.05) and compete at human-viewable speed. Q-value heatmap shows agent's learned "desire" for each tile.

## What to look for

1. **Reward curve** — should trend upward as agents improve
2. **Heatmap** — bright tiles = high Q-value = agent wants to go there
3. **Epsilon decay** — watch the ε bar shrink as training progresses
4. **Strategy shift** — lower γ = more aggressive planting near start; higher γ = more deliberate territory play

## Run

```bash
# Local
cd server && npm install && npm start
# → http://localhost:3002

# Docker
docker compose up --build

# Dev
docker compose --profile dev up
```

## CV talking points

- **Tabular Q-learning implementation from scratch** — Bellman equation, ε-greedy, optimistic initialization
- **State space engineering** — discretized spatial features, distance buckets, zone encoding
- **Reward shaping** — non-trivial reward function with blocking bonus, win/lose terminals
- **Non-blocking training loop** — `setImmediate` bursts keep Socket.io responsive during CPU-intensive training
- **Live visualization** — Q-value heatmap streamed to browser, reward curve with moving average
- **Hot hyperparameter swap** — α, γ, ε update mid-training without restart
