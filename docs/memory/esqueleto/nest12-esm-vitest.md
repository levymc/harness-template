---
name: nest12-esm-vitest
description: NestJS 12 é só-ESM; por isso o projeto é "type":"module", imports relativos levam .js e o runner é Vitest, não Jest
type: project
status: active
verified: 2026-10-13
citations:
  - path: package.json
    anchor: '"type": "module"'
  - path: vitest.config.ts
    anchor: "include: ['src/**/*.spec.ts']"
---

Os pacotes `@nestjs/*` 12 são publicados só como ESM. Consequências neste repo:
`"type": "module"`, `module: nodenext`, import relativo **com** `.js` mesmo em `.ts`
(`./items.service.js`), `import.meta.dirname` no lugar de `__dirname`, e Vitest.

**Por quê:** pelo guia de migração do Nest 12, Jest só carrega os pacotes ESM-only
em Node ≥ 24.9 (`ERR_REQUIRE_ASYNC_MODULE` antes disso), e o template mira Node 22.
O `nest new` em modo ESM também gera Vitest.

**Como aplicar:** não troque para Jest nem tire o `.js` dos imports. TypeScript fica em
6.0.x: o 7 ainda não é aceito por `typescript-eslint`, `ts-jest` e `@nestjs/cli`.
Ver também [[vitest-nao-compila-como-o-build]].
