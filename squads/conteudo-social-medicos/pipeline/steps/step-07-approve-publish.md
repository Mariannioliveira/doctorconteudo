---
step: "07"
name: "Aprovação para Publicação"
type: checkpoint
depends_on: step-06
---

# Step 07: Checkpoint — Aprovação para Publicação

## Para o Pipeline Runner

Exibir o card gerado e a legenda para aprovação final antes da publicação.

## Pergunta ao Usuário

Usar AskUserQuestion:
- **Publicar agora** — Avançar para o step-08 (Publicador)
- **Ajustar design** — Retornar ao step-06 (Designer)
- **Salvar sem publicar** — Encerrar mantendo os arquivos
