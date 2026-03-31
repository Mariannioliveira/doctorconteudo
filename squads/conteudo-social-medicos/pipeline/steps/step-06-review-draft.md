---
step: "06"
name: "Revisão do Rascunho"
type: checkpoint
depends_on: step-05
---

# Step 06: Checkpoint — Revisão do Rascunho pelo Usuário

## Para o Pipeline Runner

Apresentar o conteúdo completo criado pelo Carlos Cópia para aprovação de Mari.

## Como Apresentar

Exibir o content-draft.md completo, com separadores visuais entre os 3 formatos.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ Carlos Cópia entregou o rascunho
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Exibir content-draft.md completo]
```

## Pergunta ao Usuário

Usar AskUserQuestion com as opções:
- **Aprovado!** — Enviar para revisão final da Vera
- **Precisa de ajustes** — Pedir ao Carlos Cópia para revisar com feedback específico
- **Mudar o ângulo** — Voltar para a Ana Estratégia com novo direcionamento

## Se "Precisa de ajustes"

Coletar o feedback via AskUserQuestion (campo livre), repassar ao Carlos Cópia e repetir o Step 05.
