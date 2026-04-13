---
step: "08"
name: "Publicação no Instagram"
type: agent
agent: publicador
depends_on: step-07
---

# Step 08: Paula Post — Publicação no Instagram

## Para o Pipeline Runner

Executar a Paula Post para publicar o card no Instagram via Graph API.

## Inputs

- `design/card.jpg` → card JPEG
- `v1/content-draft.md` → legenda (seção "=== LEGENDA INSTAGRAM ===")
- `.env` (raiz do projeto) → INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID

## Expected Output

- `v1/publish-report.md` → Post ID, URL e log

## Execution Mode

- **Modo:** Inline
- **Script:** `node --env-file=.env skills/instagram-publisher/scripts/publish.js`
