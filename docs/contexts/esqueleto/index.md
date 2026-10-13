# Esqueleto NestJS + Sequelize

**Leia quando:** for mexer no app de exemplo (`src/`, `test/`, `migrations/`), na stack ou
no build.

O app existe para o harness ter algo real para guardar. Não é copiado por
`scripts/harness/adopt.mjs`: ao derivar um projeto sem o esqueleto, apague este contexto
junto com `src/`.

## Onde está

- `src/items/`: o exemplo vivo de módulo (model, DTOs, service, controller, testes).
- `src/config/env.ts`: as variáveis de ambiente, validadas no boot.
- `src/database/database.module.ts`: a conexão; `synchronize: false` sempre.
- Subcontextos: [banco](banco/index.md) e [testes](testes/index.md).

## Stack

NestJS 12 (só ESM), Sequelize 6 + `sequelize-typescript`, Postgres 17 (docker compose,
porta 5433), Vitest 4, oxlint, TypeScript 6.0. Por que Sequelize:
`docs/decisions/0003-orm-sequelize.md`.

## Memória

Fatos em `docs/memory/esqueleto/` e nos subcontextos, listados no índice da memória.
