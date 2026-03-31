---
step: "08"
name: "Aprovação para Design"
type: checkpoint
depends_on: step-07
---

# Step 08: Checkpoint — Aprovação para Design

## Para o Pipeline Runner

OBRIGATÓRIO: Este checkpoint só avança se o veredicto da Vera for APROVAR ou APROVAR COM RESSALVAS.
Se o veredicto for REJEITAR, este checkpoint NÃO deve ser apresentado — retornar ao Step 05.

## Como Apresentar

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Vera Veredito avaliou o conteúdo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VEREDICTO: {APROVAR / APROVAR COM RESSALVAS}
Média: {score}/10

{Se COM RESSALVAS: exibir as ressalvas opcionais}

A copy está aprovada. O Marco Design vai criar o layout visual do carrossel.
```

## Pergunta ao Usuário

Usar AskUserQuestion:
- **Criar design agora** — Avançar para o Step 09 (Designer)
- **Ajustar copy antes** — Fazer ajustes manuais na copy antes de criar o design
- **Salvar rascunho** — Salvar a copy sem gerar design (encerrar pipeline)
