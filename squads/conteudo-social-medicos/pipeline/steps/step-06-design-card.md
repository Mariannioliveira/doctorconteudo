---
step: "06"
name: "Design do Card"
type: agent
agent: designer
depends_on: step-05
---

# Step 06: Marco Design — Design do Card

## Para o Pipeline Runner

Executar o Marco Design para criar o card HTML do Instagram.

## Inputs

- `v1/content-draft.md` → headline (=== HEADLINE DO CARD ===), palavras em destaque, descrição do visual
- `v1/quality-review.md` → veredicto da revisora

## Expected Output

- `design/card.html` → HTML completo do card
- `design/card.jpg` → screenshot renderizado via Playwright

## Execution Mode

- **Modo:** Inline
- **Tools:** Playwright MCP

## Specs

- Viewport: 1080 x 1350px
- Headline: Montserrat 800, 68-80px, branco — palavras de destaque em #92adff
- Foto de fundo: fotorrealista, full-bleed, gradiente escuro na base
- Footer: logo DoctorCreator + "SAIBA MAIS NA LEGENDA ↓"
