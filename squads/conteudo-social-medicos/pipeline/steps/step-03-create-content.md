---
step: "03"
name: "Criação do Conteúdo"
type: agent
agent: redator
depends_on: step-02
---

# Step 03: Carlos Cópia — Criação do Conteúdo

## Para o Pipeline Runner

Executar o Carlos Cópia para criar a headline do card e a legenda do Instagram com base na notícia escolhida.

## Inputs

- `selected-story.yaml` → notícia escolhida pelo usuário no step-02

## Expected Output

- `v1/content-draft.md` → headline do card + palavras em destaque + descrição do visual + legenda completa

## Execution Mode

- **Modo:** Inline

## Quality Gate

Antes de avançar para step-04:
- [ ] Seção "=== HEADLINE DO CARD ===" presente e com max 10 palavras
- [ ] Seção "=== PALAVRAS EM DESTAQUE ===" presente
- [ ] Seção "=== DESCRIÇÃO DO VISUAL ===" presente
- [ ] Seção "=== LEGENDA INSTAGRAM ===" presente com mínimo 150 palavras
- [ ] Fonte "(Fonte: [veículo])" presente na legenda
- [ ] Tudo em português do Brasil
