---
status: accepted
date: 2026-10-13
---

# 0002 — Schema só por migration SQL versionada

## Contexto

Dois defeitos recorrentes nos projetos de origem: diretório de migrations no
`.gitignore` com deploy que nunca migrava (cada mudança de schema exigia um ALTER manual
antes do push, senão toda página dava 500); e `sync()` do ORM tratado como migração.

## Decisão

- Migrations em `migrations/NNNN-slug.sql`, SQL puro, só "up", aplicadas em ordem por
  `scripts/db/migrate.mjs` (umzug) e registradas na tabela `_migrations`.
- Migration aplicada em ambiente compartilhado nunca é editada; corrigir é escrever a
  próxima.
- `sync()` / `synchronize: true` proibidos fora de teste (regra `no-sync`).
- O deploy roda `pnpm db:migrate` **antes** de subir o código novo.
- Banco não-local exige `--remote`, que o agente não pode passar (hook `bash-guard`).

## Alternativas consideradas

- **Migrations em TypeScript com `queryInterface`** — recusada: acopla a migration à
  versão do ORM e esconde o SQL que de fato roda.
- **Migrations up/down** — recusada: o "down" quase nunca é testado e dá falsa
  segurança; reverter é uma migration nova.

## Consequências

- O teste `test/schema-parity.e2e-spec.ts` falha se um model citar coluna que nenhuma
  migration cria — é a guarda do 500 em produção.

## Revisar quando

- se o projeto passar a ter mais de um banco ou schema por tenant;
- se uma migration precisar de lógica que SQL puro não expressa bem (backfill em lote).
