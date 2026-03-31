---
step: "09"
name: "Design do Carrossel"
type: agent
agent: designer
depends_on: step-08
---

# Step 09: Marco Design — Design do Carrossel

## Para o Pipeline Runner

Executar o Marco Design para criar os slides HTML do carrossel de Instagram com base na copy aprovada.

O Designer deve:
1. Ler a copy aprovada em `output/content-draft.md`
2. Definir o design system completo antes de criar qualquer HTML
3. Criar um arquivo HTML por slide em `output/design/`
4. Verificar visualmente o slide 1 antes de renderizar os demais
5. Entregar todos os slides renderizados

## Inputs

- `output/content-draft.md` → copy aprovada com texto de cada slide
- `output/quality-review.md` → veredicto e notas da revisora
- `_opensquad/_memory/company.md` → identidade da Doctor Creator (cores, tom, marca)

## Expected Output

- `output/design/slide-01.html` + `slide-01.jpg` → slide 1 (hook/capa)
- `output/design/slide-02.html` + `slide-02.jpg` até `slide-NN.*` → slides de conteúdo
- `output/design/slide-{last}.html` + `slide-{last}.jpg` → último slide (CTA com @doctorcreators)

Os JPGs são gerados via Playwright screenshot após cada HTML e usam o mesmo nome base do arquivo HTML.

## Execution Mode

- **Modo:** Inline
- **Tools:** Playwright MCP (browser_navigate, browser_snapshot, browser_set_viewport_size)

## Specs do Carrossel Instagram

- **Viewport:** 1080 x 1440px (3:4 portrait)
- **Slides:** mínimo 5, máximo 10
- **Slide 1:** sempre o hook/capa
- **Último slide:** sempre CTA com @doctorcreators e chamada para ação
- **Tipografia mínima:** Hero 58px, Heading 43px, Body 34px, Caption 24px
- **Sem contadores de slides** nas imagens (ex: "1/7", "slide 3")

## Quality Gate

Antes de avançar para o Step 10:
- [ ] Todos os HTMLs existem em `output/design/`
- [ ] Todos os JPGs correspondentes existem em `output/design/` (mesmo nome base do HTML)
- [ ] Slide 1 foi renderizado e verificado visualmente antes do batch
- [ ] Nenhum slide tem texto abaixo de 24px
- [ ] Viewport configurada para 1080x1440 em todos os arquivos
- [ ] Design system é consistente entre todos os slides
