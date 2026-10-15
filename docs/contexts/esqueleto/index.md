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

## A skill de terceiro `nestjs-expert`

Instalada (fixada em `skills-lock.json`) para guards, interceptors, pipes, auth e
validação de DTO. Os exemplos dela usam TypeORM, Jest, imports relativos sem `.js` e
`npm`: **aqui vale a stack acima**. Isso quer dizer Sequelize no lugar de TypeORM,
Vitest no lugar de Jest, `.js` nos imports relativos, `pnpm`, e schema só por
migration. Swagger e Passport não estão instalados. Módulo novo é com a skill
`novo-modulo`, não com ela. Ela não se edita: se as ressalvas pesarem mais que a
ajuda, `pnpm skills remove nestjs-expert`.

## Memória

Fatos em `docs/memory/esqueleto/` e nos subcontextos, listados no índice da memória.
