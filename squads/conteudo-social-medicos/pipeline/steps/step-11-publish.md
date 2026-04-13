---
step: "11"
name: "Publicação no Instagram"
type: agent
agent: publicador
depends_on: step-10
---

# Step 11: Paula Post — Publicação no Instagram

## Para o Pipeline Runner

Executar a Paula Post para publicar o card aprovado no Instagram da Doctor Creator via Graph API.

## Inputs

- `output/quality-review.md` → veredicto de aprovação (obrigatório: APROVAR ou APROVAR COM RESSALVAS)
- `output/design/card.jpg` → card JPEG gerado pelo Marco Design
- `output/content-draft.md` → legenda do post (seção "LEGENDA INSTAGRAM")
- `.env` → credenciais da API (`INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`)

## Expected Output

- `output/publish-report.md` → relatório com Post ID, URL e timestamp

## Execution Mode

- **Modo:** Inline
- **Skill:** instagram-publisher (`skills/instagram-publisher/scripts/publish.js`)

## Quality Gate

Antes de publicar:
- [ ] Veredicto da Vera é APROVAR ou APROVAR COM RESSALVAS
- [ ] `output/design/card.jpg` existe
- [ ] `.env` contém `INSTAGRAM_ACCESS_TOKEN` e `INSTAGRAM_USER_ID`
- [ ] Usuário confirmou o card e a legenda no Step 10

## Em caso de erro

Exibir o erro completo da API e perguntar à Mari como proceder:
- Tentar novamente
- Verificar credenciais (token expirado? user ID incorreto?)
- Encerrar e salvar rascunho (output/design/card.jpg permanece disponível)
