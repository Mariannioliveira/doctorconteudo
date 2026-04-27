#!/bin/sh
set -e

# ── Bootstrap inicial (volume vazio) ─────────────────────────────
if [ ! -f /app/squads/conteudo-social-medicos/squad.yaml ]; then
  echo "[boot] Primeiro boot — copiando configs dos squads..."
  cp -r /app/_squads_seed/. /app/squads/
fi

if [ ! -d /app/_opensquad/core ]; then
  echo "[boot] Copiando estrutura inicial do Opensquad..."
  cp -r /app/_opensquad_seed/. /app/_opensquad/
fi

# ── Sincronização de código a cada deploy ────────────────────────
# Sempre sobrescreve os caminhos controlados pelo código (agents,
# pipeline, runner, assets) para que `Implantar` no EasyPanel reflita
# qualquer commit novo, mesmo se houver volume persistente.
# Preserva: output/, state.json, _memory/, _browser_profile/, _investigations/
echo "[boot] Sincronizando código-fonte sobre o volume..."

for squad_dir in /app/_squads_seed/*/; do
  squad_name=$(basename "$squad_dir")
  mkdir -p "/app/squads/$squad_name"
  for code_subpath in agents pipeline squad.yaml; do
    src="/app/_squads_seed/$squad_name/$code_subpath"
    dst="/app/squads/$squad_name/$code_subpath"
    if [ -e "$src" ]; then
      rm -rf "$dst" 2>/dev/null || true
      cp -r "$src" "$dst"
    fi
  done
done

for code_subpath in core assets config; do
  src="/app/_opensquad_seed/$code_subpath"
  dst="/app/_opensquad/$code_subpath"
  if [ -e "$src" ]; then
    rm -rf "$dst" 2>/dev/null || true
    cp -r "$src" "$dst"
  fi
done

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
