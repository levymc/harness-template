/**
 * Aplica as migrations SQL de `migrations/` em ordem, registrando cada uma em `_migrations`.
 *
 * Por que SQL puro e só "up": o schema é o que o banco tem, não o que um model descreve.
 * `sequelize.sync()` em produção é proibido (regra `no-sync` do check-claims) e o deploy
 * roda este script ANTES de subir o código novo — código que lê coluna inexistente é 500.
 *
 * Banco não-local exige `--remote` explícito. A permissão para esse flag fica negada em
 * `.claude/settings.json`: quem migra produção é o pipeline, não o agente.
 *
 * Uso: node scripts/db/migrate.mjs up|status [--remote]
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Sequelize } from 'sequelize'
import { SequelizeStorage, Umzug } from 'umzug'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'))

const [comando = 'status', ...flags] = process.argv.slice(2)
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL ausente. Copie .env.example para .env.')
  process.exit(1)
}
const local = /@(localhost|127\.0\.0\.1|db)(:\d+)?\//.test(url)
if (!local && !flags.includes('--remote')) {
  console.error(`DATABASE_URL não é local (${url.replace(/:[^:@/]*@/, ':***@')}). Use --remote se for isso mesmo.`)
  process.exit(1)
}

const sequelize = new Sequelize(url, { logging: false })
const umzug = new Umzug({
  migrations: {
    glob: ['migrations/*.sql', { cwd: root }],
    resolve: ({ name, path }) => ({
      name,
      up: () => sequelize.transaction(transaction => sequelize.query(readFileSync(path, 'utf8'), { transaction })),
    }),
  },
  storage: new SequelizeStorage({ sequelize, tableName: '_migrations' }),
  logger: undefined,
})

try {
  if (comando === 'up') {
    const aplicadas = await umzug.up()
    console.log(aplicadas.length ? `✓ aplicadas: ${aplicadas.map(m => m.name).join(', ')}` : '✓ nada pendente')
  } else if (comando === 'status') {
    const [feitas, pendentes] = await Promise.all([umzug.executed(), umzug.pending()])
    console.log(`aplicadas: ${feitas.length} · pendentes: ${pendentes.map(m => m.name).join(', ') || 'nenhuma'}`)
  } else {
    console.error(`comando desconhecido: ${comando} (use up|status)`)
    process.exitCode = 1
  }
} finally {
  await sequelize.close()
}
