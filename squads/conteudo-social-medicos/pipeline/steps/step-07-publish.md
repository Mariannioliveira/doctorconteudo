---
step: "07"
name: "Publicação no Instagram"
type: agent
agent: publicador
depends_on: step-06
---

# Step 07: Paula Post — Publicação no Instagram

## Para o Pipeline Runner

Executar a Paula Post para publicar o card no Instagram via Graph API.

## Inputs

- `design/card.jpg` → card JPEG gerado pelo Marco Design
- `v1/content-draft.md` → legenda (seção "=== LEGENDA INSTAGRAM ===")
- `.env` (raiz do projeto) → INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID

## Expected Output

- `v1/publish-report.md` → Post ID, URL e log de publicação

## Execution Mode

- **Modo:** Inline
- **Script:** `node --env-file=.env skills/instagram-publisher/scripts/publish.js`

## Quality Gate

- [ ] design/card.jpg existe
- [ ] .env tem INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID configurados
- [ ] Legenda extraída e truncada em 2200 chars

## Em caso de erro

Exibir erro completo da API e informar como proceder:
- Token expirado → renovar conforme SKILL.md
- User ID incorreto → verificar via Graph API Explorer
