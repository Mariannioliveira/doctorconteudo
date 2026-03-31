---
step: "08"
name: "Aprovação para Publicação"
type: checkpoint
depends_on: step-07
---

# Step 08: Checkpoint — Aprovação Final para Publicação

## Para o Pipeline Runner

OBRIGATÓRIO: Este checkpoint só avança se o veredicto da Vera for APROVAR ou APROVAR COM RESSALVAS.
Se o veredicto for REJEITAR, este checkpoint NÃO deve ser apresentado — retornar ao Step 05.

## Como Apresentar

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Vera Veredito avaliou o conteúdo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VEREDICTO: {APROVAR / APROVAR COM RESSALVAS}
Média: {score}/10

{Se COM RESSALVAS: exibir as ressalvas opcionais}

O conteúdo está pronto para publicação no Instagram.
```

## Pergunta ao Usuário

Usar AskUserQuestion:
- **Publicar agora** — Avançar para o Step 09 (Publicador)
- **Salvar rascunho** — Salvar o conteúdo sem publicar (encerrar pipeline)
- **Ajustar antes de publicar** — Fazer ajustes manuais antes da publicação

## Aviso sobre Imagens

Exibir: "⚠️ Para publicar o carrossel, você precisará adicionar as imagens dos slides em `squads/conteudo-social-medicos/output/images/` (arquivos JPEG, nomeados 01.jpg, 02.jpg, etc.)"
