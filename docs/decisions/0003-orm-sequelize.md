---
status: accepted
date: 2026-10-13
---

# 0003 — Sequelize como ORM do esqueleto

## Contexto

O template precisa de um ORM para que o esqueleto seja realista (model, migration, teste
de paridade), mas o foco dele é o harness, não a camada de dados.

## Decisão

Sequelize 6 + `sequelize-typescript` 2 + `@nestjs/sequelize` 12, por escolha do dono do
template: é o ORM que ele já usa nos outros projetos, então as skills e guardas daqui
transferem direto.

## Alternativas consideradas

- **Prisma** — proposta no primeiro plano e recusada pelo dono do template.
- **Drizzle / TypeORM** — não avaliadas a fundo; mesma razão.

## Consequências

- Models com `type` explícito em toda coluna, e `useDefineForClassFields: false` no
  tsconfig (ver `docs/memory/vitest-nao-compila-como-o-build.md`).
- Sem gerador de migration: a migration é escrita à mão, e o teste de paridade cobre o
  esquecimento.

## Revisar quando

- se o Sequelize 7 sair de alpha (a API de decorators muda);
- se o projeto derivado não usar banco relacional — aí desligue `no-sync` e
  `env-example` em `harness.config.json` e remova o esqueleto.
