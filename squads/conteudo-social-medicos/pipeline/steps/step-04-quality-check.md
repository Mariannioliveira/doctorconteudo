---
step: "04"
name: "Revisão de Qualidade"
type: agent
agent: revisor
depends_on: step-03
---

# Step 04: Vera Veredito — Revisão de Qualidade

## Para o Pipeline Runner

Executar a Vera Veredito para revisar a headline e legenda criadas pelo Carlos Cópia.

## Inputs

- `v1/content-draft.md` → headline do card + legenda do post

## Expected Output

- `v1/quality-review.md` → veredicto e feedback detalhado

## Execution Mode

- **Modo:** Inline

## Quality Gate

- [ ] VEREDICTO presente (APROVAR / APROVAR COM RESSALVAS / REJEITAR)
- [ ] Scores individuais para todos os critérios
- [ ] Feedback acionável incluído
