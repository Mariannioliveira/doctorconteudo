---
step: "07"
name: "Aprovação para Publicação"
type: checkpoint
depends_on: step-06
---

# Step 07: Checkpoint — Aprovação para Publicação

## Para o Pipeline Runner

Exibir o card gerado e a legenda para aprovação final antes da publicação.

## Pergunta ao Usuário

Usar AskUserQuestion:
- **Publicar agora** — Avançar para o step-08 (Publicador)
- **Alterar imagem** — Retornar ao Designer: gerar nova imagem via `image-generator --mode production` com prompt variado, re-renderizar o card e apresentar novamente neste checkpoint
- **Ajustar design** — Retornar ao step-06 (Designer) com feedback livre do usuário
- **Baixar imagem** — Copiar `design/card.jpg` como PNG para `~/Downloads/` e encerrar (sem publicar)

## Comportamento — opção "Alterar imagem"

Quando o usuário escolher "Alterar imagem":
1. Instruir o Designer a gerar uma **nova variação** da imagem de fundo com prompt diferente (mesmo tema, ângulo ou composição alternativa)
2. Rodar o `image-generator` com `--mode production` sobrescrevendo `design/bg-image.jpg`
3. Re-renderizar `design/card.jpg` via Playwright (o HTML já referencia `./bg-image.jpg`)
4. **Exibir o novo `card.jpg` ao usuário**
5. **Voltar ao início deste checkpoint**: re-exibir o `AskUserQuestion` com as mesmas 4 opções (Publicar agora / Alterar imagem / Ajustar design / Baixar imagem) e aguardar nova escolha. Repetir este loop quantas vezes for necessário até o usuário escolher "Publicar agora" ou "Baixar imagem".

## Comportamento — opção "Ajustar design"

Quando o usuário escolher "Ajustar design":
1. Perguntar ao usuário o que deseja ajustar (texto livre): cor, layout, headline, imagem, etc.
2. **Sempre regenerar a imagem de fundo** (`bg-image.jpg`) com um novo prompt — mesmo que o usuário não peça explicitamente alteração de imagem. Variar ângulo, composição ou estilo mantendo o tema.
3. Aplicar os ajustes solicitados no `card.html`
4. Re-renderizar `design/card.jpg` via Playwright
5. **Exibir o novo `card.jpg` ao usuário**
6. **Voltar ao início deste checkpoint**: re-exibir o `AskUserQuestion` com as mesmas 4 opções (Publicar agora / Alterar imagem / Ajustar design / Baixar imagem) e aguardar nova escolha. Repetir este loop quantas vezes for necessário até o usuário escolher "Publicar agora" ou "Baixar imagem".

> Regra fixa: toda vez que o Designer é chamado de volta a partir deste checkpoint, o `bg-image.jpg` deve ser **sempre regerado** via `python3 skills/image-generator/scripts/generate.py --mode production`. Nunca reutilizar a imagem anterior.

## Comportamento — opção "Baixar imagem"

Quando o usuário escolher essa opção:

1. Construir um nome amigável a partir da headline (slug minúsculo, sem acentos, máx 60 chars), ex: `doctorcreator-mercado-ia-medicina-2032.png`
2. Converter o JPG renderizado em PNG e copiar para `~/Downloads/` usando `sips` (já vem no macOS):
   ```bash
   sips -s format png "squads/conteudo-social-medicos/output/{run-id}/design/card.jpg" \
     --out "$HOME/Downloads/{slug}.png"
   ```
3. Confirmar ao usuário com o caminho absoluto do arquivo gerado.
4. Encerrar o pipeline (não avançar para step-08).
