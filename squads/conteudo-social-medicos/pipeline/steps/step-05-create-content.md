---
step: "05"
name: "Criação do Conteúdo"
type: agent
agent: redator
format: instagram-feed
depends_on: step-04
---

# Step 05: Carlos Cópia — Criação do Conteúdo Completo

## Para o Pipeline Runner

Executar o Carlos Cópia para criar os 3 formatos de conteúdo em uma única passagem:
1. Carrossel Instagram (8-10 slides)
2. Script Reel (15-30 segundos)
3. Post LinkedIn

## Inputs

- `output/editorial-brief.md` → brief completo com ângulo, hook escolhido e instruções
- `output/selected-hook.yaml` → hook específico escolhido por Mari
- `output/selected-story.yaml` → notícia original com key_data
- `_opensquad/_memory/company.md` → contexto da Doctor Creator
- `pipeline/data/tone-of-voice.md` → diretrizes de tom
- `pipeline/data/domain-framework.md` → framework estrutural
- `pipeline/data/output-examples.md` → exemplos de referência
- `pipeline/data/anti-patterns.md` → o que evitar

## Expected Output

- `output/content-draft.md` → documento completo com carrossel + Reel + LinkedIn

## Execution Mode

- **Modo:** Inline
- **Formato injetado:** instagram-feed (best practices de carrossel)

## Quality Gate

Antes de avançar para o Step 06:
- [ ] content-draft.md existe
- [ ] Contém os 3 formatos: carrossel, Reel, LinkedIn
- [ ] Carrossel tem 8-10 slides com 40-80 palavras cada
- [ ] Reel tem 15-30 segundos de script
- [ ] LinkedIn tem hook nos primeiros ~210 chars
- [ ] Hook escolhido está no Slide 1 do carrossel
- [ ] Nenhuma violação de CFM detectável
