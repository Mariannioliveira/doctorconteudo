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
- **Ajustar design** — Retornar ao step-06 (Designer)
- **Baixar imagem** — Copiar `design/card.jpg` como PNG para `~/Downloads/` e encerrar (sem publicar)

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
