# ==========================================
# Image Docker – SouverainRecrut Backend
# ==========================================
# Multi-stage : l'étape "builder" compile le TypeScript avec toutes les dépendances,
# l'étape "runner" ne contient que le code compilé et les dépendances de production.

# ---------- Étape 1 : construction ----------
FROM node:22-alpine AS builder
WORKDIR /app

# OpenSSL est requis par le moteur Prisma sur Alpine
RUN apk add --no-cache openssl

# Dépendances d'abord : cette couche reste en cache tant que package*.json ne change pas
COPY package*.json ./
RUN npm ci

# Client Prisma, puis compilation TypeScript
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN npx prisma generate
COPY src ./src
RUN npm run build

# ---------- Étape 2 : exécution ----------
FROM node:22-alpine AS runner

# Traçabilité : version applicative et commit Git, fournis par la pipeline
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="souverainrecrut-backend" \
      org.opencontainers.image.description="API REST SouverainRecrut (Node.js, Express, Prisma)" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.source="https://github.com/YoussefGoat123/souverainrecrut"

RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000

# Dépendances de production uniquement (pas de Jest, TypeScript…),
# puis suppression de npm/npx/corepack : inutiles pour exécuter l'API,
# ils ajoutent des vulnérabilités détectées par Trivy (pacote, sigstore…).
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Code compilé, client Prisma généré et schéma/migrations
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Utilisateur non-root fourni par l'image Node officielle
USER node

EXPOSE 4000

# Docker vérifie que l'API répond (statut "healthy" / "unhealthy")
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/v1/health" > /dev/null || exit 1

CMD ["node", "dist/server.js"]
