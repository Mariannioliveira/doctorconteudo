---
step: "04"
name: "Aprovação do Brief"
type: checkpoint
depends_on: step-03
---

# Step 04: Checkpoint — Aprovação do Brief e Escolha do Hook

## Para o Pipeline Runner

Apresentar o brief da Ana Estratégia e pedir que Mari:
1. Aprove o ângulo estratégico
2. Escolha um dos 3 hooks

## Como Apresentar

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧭 Ana Estratégia entregou o brief
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ÂNGULO: {ângulo estratégico}
FORMATO: {formato do carrossel}
PÚBLICO: {diagnóstico de consciência}

───────────────────────────────────
ESCOLHA UM HOOK:
───────────────────────────────────

HOOK A — [Driver: Identidade]
"{texto do hook}"
→ {rationale}

HOOK B — [Driver: Urgência]
"{texto do hook}"
→ {rationale}

HOOK C — [Driver: Curiosidade]
"{texto do hook}"
→ {rationale}
```

## Pergunta ao Usuário

Usar AskUserQuestion para que Mari escolha o hook (A, B ou C) ou solicite ajustes.

## Output

Salvar a escolha em `output/selected-hook.yaml` e marcar o brief como aprovado.
