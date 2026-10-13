---
status: accepted
date: 2026-10-13
---

# 0004 — Memória organizada em pastas que espelham `docs/contexts/`

## Contexto

Com a memória numa pasta plana, o índice só sabia agrupar por tipo, e quem trabalhava
numa área não tinha como ver, de uma vez, o que já se sabia sobre ela. O dono do
template pediu memórias em pastas e subpastas, ligadas aos contextos de `docs/contexts/`
quando possível.

## Decisão

- Cada contexto é `docs/contexts/<caminho>/index.md`, com subcontextos em subpastas.
- A pasta do fato **é** o contexto: `docs/memory/<caminho>/<slug>.md`. Fato sem contexto
  fica na raiz de `docs/memory/`.
- O lint reprova pasta de memória sem o `index.md` de contexto correspondente, slug
  repetido na árvore e campo `context:` no frontmatter.
- O índice `MEMORY.md` é agrupado por contexto (raiz primeiro), com link para cada um.

## Alternativas consideradas

- **Campo `context:` no frontmatter, com a memória plana** — recusada. É o desenho que
  um dos repositórios de origem usa, e é uma segunda fonte de verdade: mover o fato ou
  renomear o contexto exige lembrar de atualizar o campo. Com a pasta, `git mv` basta.
- **Contexto obrigatório para todo fato** — recusada: fatos sobre o projeto inteiro
  (como a inicialização) não pertencem a área nenhuma, e um contexto "geral" seria uma
  gaveta de tudo.
- **Memória dentro da própria pasta do contexto** (`docs/contexts/x/memory/`) —
  recusada: espalharia a memória pela documentação e quebraria o índice único que o
  hook SessionStart injeta.

## Consequências

- `pnpm memory new` ganhou `--context`, que recusa contexto inexistente.
- O slug é único na árvore toda, para `[[slug]]` não ficar ambíguo.

## Revisar quando

- se o índice único passar do teto de fatos por ter contextos demais — aí o caminho é um
  índice por contexto, carregado sob demanda;
- se a maioria dos fatos ficar na raiz, sinal de que os contextos não refletem o projeto.
