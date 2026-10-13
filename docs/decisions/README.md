# Decisões

Uma decisão por arquivo, `NNNN-slug.md`, numeração sem repetição (a regra `adr-shape`
do check-claims confere). Copie [`0000-template.md`](0000-template.md).

- `status: accepted | superseded | declined`. **Recusadas ficam registradas**: é o que
  impede alguém (ou um agente) de propor a mesma ideia toda semana sem saber por que
  ela já caiu.
- Toda ADR tem `## Revisar quando` — a condição objetiva em que ela deve ser reaberta.
  Decisão sem condição de revisão vira dogma; guarda sem condição de expiração vira
  peso morto.
- Mudar de ideia é uma ADR nova com `supersedes`, e a antiga ganha `status: superseded`
  e `superseded_by`. Nunca reescreva a antiga — e nunca reverta uma decisão por commit
  silencioso.

| # | Decisão | Status |
|---|---|---|
| [0001](0001-harness-do-template.md) | Desenho do harness deste template | accepted |
| [0002](0002-migrations-sql-versionadas.md) | Schema só por migration SQL versionada | accepted |
| [0003](0003-orm-sequelize.md) | Sequelize como ORM do esqueleto | accepted |
| [0004](0004-memoria-organizada-por-contexto.md) | Memória em pastas que espelham os contextos | accepted |
