# Banco

**Leia quando:** for criar tabela, coluna ou model, escrever migration, ou mexer na
conexão com o Postgres.

## Onde está

- `migrations/`: SQL puro, só "up", aplicado em ordem por `scripts/db/migrate.mjs` e
  registrado na tabela `_migrations`.
- `src/items/item.model.ts`: o model de exemplo, com `type` explícito em toda coluna.
- `docker-compose.yml`: o Postgres de desenvolvimento.

## Regras desta área

- O schema só muda por migration; nunca `sync()` (`check-claims:no-sync`).
- Migration aplicada em ambiente compartilhado nunca é editada; corrigir é escrever a
  próxima (`docs/decisions/0002-migrations-sql-versionadas.md`).
- Todo atributo de model existe como coluna no banco migrado
  (`test/schema-parity.e2e-spec.ts`). Visto falhar ao acrescentar uma coluna ao model
  sem migration.
- Banco não-local exige `--remote`, que o agente não pode passar (hook `bash-guard`).

## Memória

Fatos em `docs/memory/esqueleto/banco/`, listados no índice da memória.
