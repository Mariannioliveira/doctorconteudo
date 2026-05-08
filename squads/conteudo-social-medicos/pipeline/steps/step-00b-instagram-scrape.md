---
step: "00b"
name: "Scraping de Instagram"
type: agent
agent: instagram-scout
depends_on: step-00
---

# Step 00b: Insta Scout — Rastreamento de Tendências no Instagram

## Para o Pipeline Runner

Executar o Insta Scout para rastrear os perfis de Instagram configurados e extrair temas em alta.
Este step alimenta o Dr. Scout com contexto de tendências virais antes da pesquisa de notícias.

## Inputs

- `squads/conteudo-social-medicos/_memory/instagram-profiles.json` → lista de perfis a rastrear
- `_opensquad/_browser_profile/` → sessão persistente do browser (login salvo)

## Expected Output

- `squads/conteudo-social-medicos/_memory/instagram-topics.md` → tópicos e palavras-chave extraídos dos perfis

## Execution Mode

- **Modo:** Inline (precisa do Playwright MCP)
- **Tools:** Playwright MCP (browser_navigate, browser_snapshot, browser_take_screenshot, browser_wait_for)

## Comportamento se Instagram pedir login

Se ao navegar para um perfil o Instagram redirecionar para a tela de login:
1. Informar ao usuário com AskUserQuestion: "Instagram pediu login. Abra o browser manualmente e faça login uma vez para salvar a sessão em `_opensquad/_browser_profile/`. Após o login, posso continuar."
2. Aguardar confirmação do usuário
3. Tentar novamente

## Quality Gate

- [ ] `instagram-topics.md` existe e foi atualizado nesta execução
- [ ] Pelo menos 1 perfil processado com sucesso
- [ ] Nenhum texto copiado literalmente dos posts (apenas temas e palavras-chave)
