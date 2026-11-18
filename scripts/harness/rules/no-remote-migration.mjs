/**
 * Migration em banco não-local (ADR 0002): é trabalho do pipeline de deploy, com revisão.
 */
import { parseShell } from './shell.mjs'

export default {
  id: 'no-remote-migration',
  reason: 'Migration em banco não-local muda produção sem revisão humana.',
  points: ['agent-hook'],
  defaultMode: 'block',
  // Stryker disable all: a prova é o teste da regra — mutar um caso dela é mutar o teste (um "allows" trocado por vazio passa por construção)
  proof: {
    catches: [
      { command: 'node scripts/db/migrate.mjs up --remote' },
      { command: 'DATABASE_URL=x node ./scripts/db/migrate.mjs up --remote' },
      { command: 'bash -c "node scripts/db/migrate.mjs up --remote"' },
    ],
    allows: [
      { command: 'node scripts/db/migrate.mjs up' },
      { command: 'pnpm db:migrate' },
      { command: 'git commit -m "migrate.mjs: documenta o --remote"' },
    ],
  },
  // Stryker restore all
  evaluate(action) {
    if (action.kind !== 'shell') return []
    return parseShell(action.command, action.shell)
      .filter(c => c.args.some(w => /(^|[\\/])migrate\.mjs$/.test(w.value)) && c.args.some(w => w.value === '--remote'))
      .map(() => 'migration em banco não-local é trabalho do pipeline de deploy, não do agente.')
  },
}
