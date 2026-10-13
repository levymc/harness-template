---
name: vitest-nao-compila-como-o-build
description: O Vitest transpila com oxc e ignora erros de tipo e flags do tsconfig — e2e verde não prova que o build compila
type: gotcha
status: active
verified: 2026-10-13
citations:
  - path: tsconfig.json
    anchor: '"useDefineForClassFields": false'
  - path: package.json
    anchor: '"typecheck": "tsc --noEmit -p tsconfig.json"'
---

Com `useDefineForClassFields: true` no tsconfig, `pnpm test:e2e` passou **verde** e o
`nest build` quebrou (TS2612: `id` sobrescreve a propriedade de `Model`). O Vitest não
roda o `tsc`: ele só remove os tipos e executa.

**Por quê:** descoberto ao provar que o e2e pegava a regressão — e ele não pegava. Os
campos de classe de um model `sequelize-typescript` sombreiam os getters do Sequelize
quando `useDefineForClassFields` é true; o `false` no tsconfig é o que impede isso.

**Como aplicar:** teste verde não substitui `pnpm typecheck` nem `pnpm build`. Os dois
estão no hook Stop (typecheck, quando há .ts alterado), na skill `pre-push` e no CI.
Não mude o `useDefineForClassFields` sem ler [[nest12-esm-vitest]].
