---
step: "05"
name: "Design do Card"
type: agent
agent: designer
depends_on: step-04
---

# Step 05: Marco Design — Design do Card

## Para o Pipeline Runner

Executar o Marco Design para criar o card HTML do Instagram com base no conteúdo aprovado.

## Inputs

- `v1/content-draft.md` → headline, palavras em destaque, descrição do visual
- `v1/quality-review.md` → veredicto e notas da revisora

## Expected Output

- `design/card.html` → HTML completo do card
- `design/card.jpg` → screenshot renderizado via Playwright

## Execution Mode

- **Modo:** Inline
- **Tools:** Playwright MCP (browser_navigate, browser_resize, browser_take_screenshot)

## Specs do Card

- **Viewport:** 1080 x 1350px (4:5 portrait)
- **Headline:** Montserrat 800, 68-80px, branco — palavras de destaque em #92adff
- **Foto de fundo:** fotorrealista, full-bleed, gradiente escuro na base
- **Footer:** logo DoctorCreator + "SAIBA MAIS NA LEGENDA ↓"

## Quality Gate

- [ ] card.html existe em design/
- [ ] card.jpg existe em design/ (renderizado via Playwright)
- [ ] Headline legível sobre o gradiente
- [ ] Palavras em #92adff visíveis
- [ ] Logo presente no footer
