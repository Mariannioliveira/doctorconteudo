---
step: "09"
name: "Publicação no Instagram"
type: agent
agent: publicador
depends_on: step-08
---

# Step 09: Paula Post — Publicação no Instagram

## Para o Pipeline Runner

Executar a Paula Post para publicar o carrossel aprovado no Instagram da Doctor Creator via Graph API.

## Inputs

- `output/content-draft.md` → conteúdo com a legenda do carrossel
- `output/quality-review.md` → veredicto de aprovação (verificar antes de publicar)
- `output/images/` → imagens JPEG dos slides (ordem pelo nome do arquivo)
- `.env` → credenciais da API (INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID)
- `skills/instagram-publisher/SKILL.md` → instruções da skill

## Expected Output

- `output/publish-report.md` → relatório com post URL, post ID e timestamp

## Execution Mode

- **Modo:** Inline
- **Skill:** instagram-publisher

## Quality Gate

Antes de publicar:
- [ ] Veredicto da Vera é APROVAR ou APROVAR COM RESSALVAS
- [ ] Imagens JPEG existem em output/images/ (pelo menos 2)
- [ ] .env tem INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID configurados
- [ ] Usuário confirmou a ordem das imagens e a legenda

## Em caso de erro

Exibir o erro completo da API e perguntar a Mari como proceder:
- Tentar novamente
- Verificar credenciais
- Encerrar e salvar rascunho
