# Testes

**Leia quando:** for escrever ou rodar teste unitário ou e2e, ou quando um teste passar
e o build não.

## Onde está

- `vitest.config.ts`: unitários em `src/**/*.spec.ts`.
- `vitest.config.e2e.ts`: e2e em `test/**/*.e2e-spec.ts`, um arquivo por vez (um banco só).
- `test/setup-app.ts`: sobe o app inteiro contra o Postgres migrado; lê o `.env` só se
  ele existir (no CI as variáveis vêm do ambiente).

## Regras desta área

- Teste verde não prova build verde: o Vitest transpila sem checar tipos. O hook Stop
  roda o typecheck, e o CI e a skill `pre-push` rodam o build.
- e2e lê de volta pelo GET; o eco do POST não prova que o valor atravessou o banco.
- Sem banco, o e2e falha alto no `beforeAll`; nunca pula em silêncio.

## Memória

Fatos em `docs/memory/esqueleto/testes/`, listados no índice da memória.
