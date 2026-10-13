# Contextos

Um contexto é uma área do projeto que alguém (ou um agente) estuda de uma vez: um
domínio, uma camada, um subsistema. Cada um é uma pasta com `index.md`, e pode ter
subcontextos em subpastas.

A memória espelha esta árvore: o fato `docs/memory/<contexto>/<slug>.md` pertence a
`docs/contexts/<contexto>/`. O lint da memória reprova pasta de memória sem o
`index.md` de contexto correspondente, e o índice `docs/memory/MEMORY.md` agrupa os
fatos por contexto. Fato que não pertence a nenhum contexto mora na raiz de
`docs/memory/`.

## Formato de um `index.md`

```markdown
# <nome do contexto>

**Leia quando:** <a situação em que um agente precisa deste contexto>

<o que é esta área, em 2–5 linhas>

## Onde está

- <arquivos e pastas que importam, com uma linha cada>

## Regras desta área

- <invariantes; cada uma com seu sensor em docs/guardrails.md, quando houver>

## Memória

Fatos em `docs/memory/<este caminho>/`, listados no índice da memória.
```

Curto de propósito: o contexto aponta para o código e para a memória; não os repete.
Quando o código e este texto divergirem, o código vence, e o texto é corrigido no mesmo
PR.

## Criar um contexto

Só quando houver o que dizer: o primeiro fato de memória que não cabe em nenhum
contexto existente é o sinal. Crie a pasta, o `index.md`, e então
`pnpm memory new <slug> --type <tipo> --context <caminho>`.
