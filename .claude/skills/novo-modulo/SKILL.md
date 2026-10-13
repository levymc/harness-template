---
name: novo-modulo
description: Cria um módulo NestJS + Sequelize completo no padrão do projeto — model, migration SQL, DTOs, service, controller, module, unit e e2e. Use quando o usuário pedir um novo recurso, entidade, tabela, endpoint CRUD ou módulo.
---

# Novo módulo

O exemplo vivo é `src/items/`. Copie a forma dele; não invente outra.

1. **Migration primeiro.** `migrations/<próximo NNNN>-<verbo>-<objeto>.sql`, SQL puro,
   `IF NOT EXISTS` quando fizer sentido. Nunca edite uma migration já aplicada em
   ambiente compartilhado; escreva a próxima. `pnpm db:migrate`.
2. **Model** `src/<modulo>/<entidade>.model.ts`: `@Table({ tableName, underscored: true })`,
   `type` **explícito** em toda `@Column` (não dependa de `design:type`). Nada de
   `sync()`.
3. **DTOs** em `src/<modulo>/dto/` com `class-validator`. O `ValidationPipe` global usa
   `whitelist` + `forbidNonWhitelisted`: campo não declarado vira 400.
4. **Service**: `@InjectModel(Entidade)`. Não encontrado → `NotFoundException`, nunca
   `null` para o controller.
5. **Controller**: `ParseUUIDPipe` em todo `:id`; `@HttpCode(204)` no delete.
6. **Module** com `SequelizeModule.forFeature([Entidade])`, registrado em
   `src/app.module.ts`.
7. **Imports relativos com `.js`** (projeto ESM — ver
   `docs/memory/nest12-esm-vitest.md`).
8. **Testes**: unit do service com o model mockado via `getModelToken`; e2e que **lê de
   volta pelo GET** (não confie no eco do POST). A paridade model ↔ schema
   (`test/schema-parity.e2e-spec.ts`) já cobre o módulo novo sozinha.
9. Feche com a skill `pre-push`.
