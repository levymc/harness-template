# Memória do projeto — índice

<!-- GERADO por `node scripts/harness/memory.mjs index`. Não edite à mão: o lint compara. -->

Antes de agir com base num fato, confira as citações dele (`memory.mjs verify`).

## Projeto

- [inicializacao-do-projeto](inicializacao-do-projeto.md) — Como e por que o harness-template nasceu em 2026-10-13 — origem, restrições do dono e o que o bootstrap ensinou
- [nest12-esm-vitest](nest12-esm-vitest.md) — NestJS 12 é só-ESM; por isso o projeto é "type":"module", imports relativos levam .js e o runner é Vitest, não Jest

## Armadilhas

- [vitest-nao-compila-como-o-build](vitest-nao-compila-como-o-build.md) — O Vitest transpila com oxc e ignora erros de tipo e flags do tsconfig — e2e verde não prova que o build compila
