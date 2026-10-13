---
name: pre-push
description: Roda localmente, na mesma ordem, os passos do CI antes de um push ou PR. Use sempre antes de git push, antes de abrir PR, ou quando o usuário perguntar se está pronto para subir. Nunca dê push "para ver se o CI passa".
---

# Pre-push — espelho do CI

Os passos abaixo são os de `.github/workflows/ci.yml`, na mesma ordem. Se o CI mudar,
esta skill muda no mesmo commit.

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm build` — o Vitest não compila como o build; ver
   `docs/memory/vitest-nao-compila-como-o-build.md`
5. `pnpm test`
6. `pnpm harness:check` e `pnpm harness:test`
7. Banco: `pnpm db:up`, `pnpm db:migrate`, `pnpm test:e2e` (inclui a paridade
   model ↔ schema)

Pare no primeiro vermelho e conserte; não pule passo. Se um passo não puder rodar aqui
(sem Docker, por exemplo), **diga qual não rodou** no resumo e no PR — passo pulado em
silêncio parece aprovação.

Nunca: `--no-verify`, push para branch protegida, `--force` (o hook `bash-guard`
bloqueia os três).
