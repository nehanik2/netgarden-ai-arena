# ============================================================
# Dockerfile — netgarden-ai-arena / q-learning
# ============================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY server/  ./server/
COPY shared/  ./shared/
COPY client/  ./client/
COPY --from=deps /app/server/node_modules ./server/node_modules

WORKDIR /app/server

ENV PORT=3002
ENV NODE_ENV=production

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s \
  CMD wget -qO- http://localhost:3002/api/health || exit 1

CMD ["node", "index.js"]
