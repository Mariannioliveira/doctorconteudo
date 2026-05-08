---
step: "05"
name: "Aprovação do Conteúdo"
type: checkpoint
depends_on: step-03
---

# Step 05: Checkpoint — Aprovação do Conteúdo

## Para o Pipeline Runner

Exibir o conteúdo criado pelo Carlos Cópia para aprovação do usuário.

## Como Apresentar

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ Conteúdo pronto para aprovação
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Headline do card]
[Legenda completa]
```

## Pergunta ao Usuário

Usar AskUserQuestion:
- **Criar design** — Avançar para o step-06 (Designer)
- **Ajustar conteúdo** — Retornar ao step-03 (Redator) com feedback
- **Salvar rascunho** — Encerrar o pipeline
