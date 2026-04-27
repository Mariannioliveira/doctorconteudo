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
- `_opensquad/assets/logo-doctorcreator-cropped.png` → logo recortada (usar SEMPRE esta, não a original 1080x1350)

## Pré-render (obrigatório)

Antes de chamar o Playwright, copiar a logo para a pasta de design (caminho relativo evita problemas com o espaço em "conteudo interno"):

```bash
cp "_opensquad/assets/logo-doctorcreator-cropped.png" "squads/conteudo-social-medicos/output/{run-id}/design/logo-doctorcreator.png"
```

No HTML, referenciar como `./logo-doctorcreator.png`.

## Expected Output

- `design/card.html` → HTML completo do card
- `design/logo-doctorcreator.png` → cópia local da logo (referenciada pelo HTML)
- `design/card.jpg` → screenshot renderizado via Playwright

## Execution Mode

- **Modo:** Inline
- **Tools:** Playwright MCP

## Specs

- Viewport: 1080 x 1350px
- Headline: Montserrat 800, 68-80px, branco — palavras de destaque em #92adff
- Foto de fundo: fotorrealista, full-bleed, gradiente escuro na base
- Footer bar: 150px de altura, `rgba(0,0,0,0.88)`
- Logo: `./logo-doctorcreator.png`, height 110px (alinhada à esquerda do footer)
- Footer CTA: "SAIBA MAIS NA LEGENDA ↓" (alinhado à direita)
