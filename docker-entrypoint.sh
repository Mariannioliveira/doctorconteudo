#!/bin/sh
set -e

# ── Semear configs dos squads se o volume estiver vazio ──────────
if [ ! -f /app/squads/conteudo-social-medicos/squad.yaml ]; then
  echo "[boot] Primeiro boot — copiando configs dos squads..."
  cp -r /app/_squads_seed/. /app/squads/
fi

if [ ! -f /app/_opensquad/_memory/company.md ]; then
  echo "[boot] Copiando memória inicial do Opensquad..."
  cp -r /app/_opensquad_seed/. /app/_opensquad/
fi

# ── Criar .env raiz com credenciais do ambiente ──────────────────
cat > /app/.env <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
INSTAGRAM_ACCESS_TOKEN=${INSTAGRAM_ACCESS_TOKEN:-}
INSTAGRAM_USER_ID=${INSTAGRAM_USER_ID:-}
EOF

# ── Criar webapp/.env ────────────────────────────────────────────
cat > /app/webapp/.env <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
EOF

echo "[boot] Iniciando servidor..."
cd /app/webapp
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
