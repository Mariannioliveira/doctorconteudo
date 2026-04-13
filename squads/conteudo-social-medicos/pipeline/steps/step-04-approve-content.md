---
step: "04"
name: "Aprovação do Conteúdo"
type: checkpoint
depends_on: step-03
---

# Step 04: Checkpoint — Aprovação do Conteúdo

## Para o Pipeline Runner

Exibir o conteúdo criado pelo Carlos Cópia (headline + legenda) para aprovação.

A Vera Veredito já revisou o conteúdo — exibir o veredicto junto com o rascunho.

## Como Apresentar

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ Carlos Cópia criou o conteúdo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Veredicto da Vera: {APROVAR / APROVAR COM RESSALVAS / REJEITAR}

[exibir headline + legenda completa]
```

## Pergunta ao Usuário

Usar AskUserQuestion:
- **Criar design** — Avançar para o step-05 (Designer)
- **Ajustar conteúdo** — Retornar ao step-03 (Redator) com feedback
- **Salvar rascunho** — Encerrar o pipeline
