# Memória do projeto — índice

<!-- GERADO por `node scripts/harness/memory.mjs index`. Não edite à mão: o lint compara. -->

Agrupado pelos contextos de `docs/contexts/`. Antes de agir com base num fato, confira
as citações dele (`memory.mjs verify`).

## Projeto inteiro

- [inicializacao-do-projeto](inicializacao-do-projeto.md) · projeto — Como e por que o harness-template nasceu em 2026-10-13 — origem, restrições do dono e o que o bootstrap ensinou

## esqueleto

Contexto: [docs/contexts/esqueleto](../contexts/esqueleto/index.md)

- [nest12-esm-vitest](esqueleto/nest12-esm-vitest.md) · projeto — NestJS 12 é só-ESM; por isso o projeto é "type":"module", imports relativos levam .js e o runner é Vitest, não Jest

## esqueleto/testes

Contexto: [docs/contexts/esqueleto/testes](../contexts/esqueleto/testes/index.md)

- [vitest-nao-compila-como-o-build](esqueleto/testes/vitest-nao-compila-como-o-build.md) · armadilha — O Vitest transpila com oxc e ignora erros de tipo e flags do tsconfig — e2e verde não prova que o build compila
