# ============================================================
# Dockerfile — netgarden-ai-arena / rule-based
# Multi-stage: install deps → minimal runtime image
# ============================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# ── Runtime ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy server source
COPY server/ ./server/

# Copy shared constants (needed by server at runtime)
COPY shared/ ./shared/

# Copy client (served as static files by Express)
COPY client/ ./client/

# Copy installed node_modules from deps stage
COPY --from=deps /app/server/node_modules ./server/node_modules

WORKDIR /app/server

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "index.js"]
