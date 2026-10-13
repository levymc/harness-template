# O esqueleto NestJS + Sequelize

Este documento é do esqueleto, não do harness: não é copiado por `scripts/harness/adopt.mjs`.
Ao derivar um projeto sem o esqueleto, apague-o junto com `src/`.

## As duas guardas que ele já pagou

O app NestJS existe para o harness ter algo real para guardar, e já rendeu:

- **O e2e verde que não compilava.** Com `useDefineForClassFields: true`, `pnpm test:e2e`
  passou e o `nest build` quebrou. O Vitest transpila com oxc e não roda o `tsc`. Por
  isso o Stop roda o typecheck, e o CI e a skill `pre-push` rodam o build. O fato está em
  `docs/memory/vitest-nao-compila-como-o-build.md`.
- **A paridade model ↔ schema.** `test/schema-parity.e2e-spec.ts` lê os models
  registrados no Sequelize (não uma lista à mão, que envelheceria) e confere cada
  atributo contra o `information_schema` do banco migrado. Visto falhar ao acrescentar
  uma coluna ao model sem migration.

## Stack

NestJS 12 (só ESM), Sequelize 6 + `sequelize-typescript`, Postgres 17 (docker compose,
porta 5433), Vitest 4, oxlint, TypeScript 6.0. Por que ESM e Vitest:
`docs/memory/nest12-esm-vitest.md`. Por que Sequelize: `docs/decisions/0003-orm-sequelize.md`.
