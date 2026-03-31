---
step: "03"
name: "Criação do Brief"
type: agent
agent: estrategista
depends_on: step-02
---

# Step 03: Ana Estratégia — Criação do Brief Editorial

## Para o Pipeline Runner

Executar a Ana Estratégia para criar o brief completo com ângulo estratégico e 3 opções de hook para o tema escolhido.

## Inputs

- `output/selected-story.yaml` → notícia escolhida por Mari no Step 02
- `_opensquad/_memory/company.md` → contexto da Doctor Creator
- `pipeline/data/domain-framework.md` → framework de conteúdo do squad
- `pipeline/data/tone-of-voice.md` → diretrizes de tom de voz

## Expected Output

- `output/editorial-brief.md` → brief completo com ângulo, 3 hooks, formato escolhido e instruções para o Redator

## Execution Mode

- **Modo:** Inline
- **Skills:** web_search (para verificar dados do tema se necessário)

## Quality Gate

Antes de avançar para o Step 04:
- [ ] editorial-brief.md existe
- [ ] Contém exatamente 3 hooks com drivers emocionais DIFERENTES
- [ ] Formato de carrossel está especificado
- [ ] Instrução de compliance CFM está presente
- [ ] CTA recomendado está presente
