---
step: "02"
name: "Escolha do Tema"
type: checkpoint
depends_on: step-01
---

# Step 02: Checkpoint — Escolha do Tema

## Para o Pipeline Runner

Apresentar as notícias ranqueadas pelo Dr. Scout e pedir que Mari escolha o tema desta rodada de conteúdo.

## Como Apresentar

Exibir um resumo das notícias no formato:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔎 Dr. Scout encontrou {N} notícias
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#1 ⭐ {viral_potential_score}/10 — {title}
   {summary}
   💡 {why_interesting}
   📊 Dado-chave: {key_data}

#2 {viral_potential_score}/10 — {title}
   ...

[continuar para todas as notícias]
```

## Pergunta ao Usuário

Usar AskUserQuestion com as opções sendo as notícias ranqueadas (até 4 por pergunta).
Se houver mais de 4 notícias, apresentar as top 4 primeiro e oferecer "Ver mais opções".

## Output

Salvar a notícia escolhida em `output/selected-story.yaml`:

```yaml
selected_story:
  title: ""
  summary: ""
  source: ""
  url: ""
  date: ""
  viral_potential_score: 0
  why_interesting: ""
  key_data: ""
```
