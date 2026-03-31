---
step: "07"
name: "Revisão de Qualidade"
type: agent
agent: revisor
depends_on: step-06
---

# Step 07: Vera Veredito — Revisão de Qualidade

## Para o Pipeline Runner

Executar a Vera Veredito para avaliar o conteúdo aprovado por Mari e emitir o veredicto final.

## Inputs

- `output/content-draft.md` → conteúdo completo aprovado por Mari
- `pipeline/data/quality-criteria.md` → critérios de avaliação
- `pipeline/data/anti-patterns.md` → padrões a evitar
- `_opensquad/_memory/company.md` → contexto da Doctor Creator para validar tom

## Expected Output

- `output/quality-review.md` → revisão estruturada com pontuação e veredicto

## Execution Mode

- **Modo:** Inline

## Quality Gate

Antes de avançar para o Step 08:
- [ ] quality-review.md existe
- [ ] Contém veredicto explícito: APROVAR, APROVAR COM RESSALVAS, ou REJEITAR
- [ ] Todos os 6 critérios estão pontuados
- [ ] Se REJEITAR: caminho para aprovação está especificado
- [ ] Se qualquer critério < 4/10: veredicto é REJEITAR (hard trigger)

## Se REJEITAR

Informar Mari com o feedback da Vera. Perguntar se deseja:
- Repassar o feedback ao Carlos Cópia para reescrita (volta ao Step 05)
- Encerrar o pipeline desta rodada
