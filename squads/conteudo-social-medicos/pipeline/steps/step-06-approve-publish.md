---
step: "06"
name: "Aprovação para Publicação"
type: checkpoint
depends_on: step-05
---

# Step 06: Checkpoint — Aprovação para Publicação

## Para o Pipeline Runner

Exibir o card gerado pelo Marco Design e a legenda para aprovação final.

## Como Apresentar

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 Marco Design criou o card
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[exibir card.jpg]
[exibir legenda do post]
```

## Pergunta ao Usuário

Usar AskUserQuestion:
- **Publicar agora** — Avançar para o step-07 (Publicador)
- **Ajustar design** — Retornar ao step-05 (Designer) para ajustes visuais
- **Salvar sem publicar** — Encerrar o pipeline mantendo os arquivos em design/
