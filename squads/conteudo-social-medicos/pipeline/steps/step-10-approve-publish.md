---
step: "10"
name: "Aprovação para Publicação"
type: checkpoint
depends_on: step-09
---

# Step 10: Checkpoint — Aprovação Final para Publicação

## Para o Pipeline Runner

Exibir os slides do carrossel gerados pelo Marco Design para aprovação final antes da publicação.

## Como Apresentar

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 Marco Design criou o carrossel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{N} slides criados em output/design/

[listar os slides gerados com nome e título do conteúdo]

O carrossel está pronto para publicação no Instagram.
```

## Pergunta ao Usuário

Usar AskUserQuestion:
- **Publicar agora** — Avançar para o Step 11 (Publicação)
- **Ajustar design** — Retornar ao Marco Design para ajustes visuais
- **Salvar sem publicar** — Encerrar o pipeline e manter os arquivos em output/design/
