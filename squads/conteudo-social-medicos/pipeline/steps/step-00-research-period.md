---
step: "00"
name: "Período de Pesquisa"
type: checkpoint
depends_on: null
---

# Step 00: Checkpoint — Período de Pesquisa

## Para o Pipeline Runner

Este é o primeiro checkpoint do pipeline. Perguntar ao usuário até qual período o Dr. Scout deve buscar notícias médicas.

## Como Apresentar

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔎 Configurando a pesquisa de notícias
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Até quanto tempo atrás o Dr. Scout deve buscar notícias médicas?
```

## Pergunta ao Usuário

Usar AskUserQuestion com as seguintes opções:
- **7 dias (1 semana)** — Apenas as notícias mais recentes e frescas
- **15 dias** — Equilíbrio entre frescor e volume de resultados
- **30 dias** — Maior variedade, incluindo tendências recentes

## Output

Salvar a escolha do usuário como `research_period` no contexto do pipeline para que o Dr. Scout use ao executar as buscas.

Exemplos de valor:
- "7 dias" → `research_period: "7 dias"`
- "15 dias" → `research_period: "15 dias"`
- "30 dias" → `research_period: "30 dias"`

Avançar automaticamente para o Step 01 após a seleção.
