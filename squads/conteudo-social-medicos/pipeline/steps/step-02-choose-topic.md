---
step: "02"
name: "Escolha do Tema"
type: checkpoint
depends_on: step-01
---

# Step 02: Checkpoint — Escolha do Tema

## Para o Pipeline Runner

Apresentar as notícias ranqueadas pelo Dr. Scout e pedir que Mari escolha o tema desta rodada de conteúdo.

## Como Apresentar

Exibir um resumo das notícias no formato:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔎 Dr. Scout encontrou {N} notícias
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#1 ⭐ {viral_potential_score}/10 — {title}
   {summary}
   💡 {why_interesting}
   📊 Dado-chave: {key_data}

#2 {viral_potential_score}/10 — {title}
   ...

[continuar para todas as notícias]
```

## Pergunta ao Usuário

Usar AskUserQuestion com as opções sendo as notícias ranqueadas (até 4 por pergunta).
Se houver mais de 4 notícias, apresentar as top 4 primeiro e oferecer "Ver mais opções".

**Sempre incluir a opção "🔄 Buscar mais notícias"** ao apresentar a lista.

## Comportamento — opção "Buscar mais notícias"

Quando o usuário escolher "Buscar mais notícias":

1. Ler `squads/conteudo-social-medicos/_memory/seen-stories.json` (array JSON)
2. Adicionar ao array **todas as URLs E títulos** das notícias exibidas nesta rodada — mesmo que o usuário não tenha gostado de nenhuma delas
3. Salvar o arquivo atualizado
4. Re-executar o Dr. Scout **com instrução explícita de buscar por ângulos e fontes completamente diferentes** — não variações das mesmas notícias. O Dr. Scout deve usar termos de busca novos, fontes que ainda não usou, e evitar veículos que já apareceram no seen-stories.json
5. O Dr. Scout **deve retornar obrigatoriamente 5-7 notícias novas** — se não encontrar com as buscas iniciais, ampliar para outras fontes e termos até completar o mínimo
6. Apresentar as novas notícias sem repetir nenhuma das anteriores

**Regra crítica:** O fato de o usuário ter clicado "Buscar mais notícias" significa que as notícias anteriores **não eram boas o suficiente**. O Dr. Scout não deve trazer mais do mesmo — deve explorar ângulos, categorias e fontes que ainda não apareceram.

## Output

Salvar a notícia escolhida em `output/selected-story.yaml`:

```yaml
selected_story:
  title: ""
  summary: ""
  source: ""
  url: ""
  date: ""
  viral_potential_score: 0
  why_interesting: ""
  key_data: ""
```
