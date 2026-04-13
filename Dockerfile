# ── Stage 1: build React dashboard ─────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /build
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────
FROM python:3.13-slim

# Node.js 20 (Instagram publisher script)
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY webapp/requirements.txt ./webapp/requirements.txt
RUN pip install --no-cache-dir -r webapp/requirements.txt

# Playwright + Chromium (renderização dos cards)
RUN playwright install chromium --with-deps

# Arquivos do projeto
COPY . .

# Dashboard buildado (do stage 1)
COPY --from=frontend /build/dist ./dashboard/dist

# Salva configs dos squads para semear volume vazio no primeiro boot
RUN cp -r /app/squads /app/_squads_seed && \
    cp -r /app/_opensquad /app/_opensquad_seed

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000
CMD ["/docker-entrypoint.sh"]
