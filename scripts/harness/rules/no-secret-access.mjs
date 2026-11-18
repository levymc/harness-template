/**
 * Segredo (`.env*`, chave, credencial) não entra no contexto: o que o agente lê vai para
 * logs e para o provedor do modelo. Vale para o comando de shell e para Read/Edit/Write.
 *
 * O deny de `Read(./.env)` no settings.json cobre o caminho óbvio; esta regra cobre os outros
 * (`.env.production`, `config/.env.local`, `--env-file=.env`, `source .env`, `bash -c "cat .env"`).
 */
import { basename } from 'node:path'
import { parseShell } from './shell.mjs'

export function isSecretPath(filePath) {
  const nome = basename(filePath ?? '')
  if (nome === '.env.example') return false
  return /^\.env(\..+)?$/.test(nome) || /\.(pem|key|p12|pfx)$/.test(nome) || /^id_(rsa|ed25519)$/.test(nome) || /^credentials[\w-]*\.json$/.test(nome)
}

/** Programas em que o texto entre aspas é mensagem, não caminho: `git commit -m "tira o .env"`. */
const QUOTED_IS_DATA = new Set(['git', 'echo', 'printf', 'gh', 'write-output', 'write-host'])

// `--env-file=.env`, `git show HEAD:.env` e o glob `.env*` (revisão fria) também tocam o segredo.
const toca = word => word.value.split(/[=:]/).some(p => isSecretPath(p) || (word.glob && /(?:^|[\\/])\.env[*?[]/.test(p)))

function ehSetupDoEnv(command) {
  const [de, para] = command.args.map(w => w.value)
  return command.program === 'cp' && /\.env\.example$/.test(de ?? '') && basename(para ?? '') === '.env'
}

export default {
  id: 'no-secret-access',
  reason: 'Segredo lido pelo agente vaza para logs e para o provedor do modelo; o .env.example diz quais variáveis existem.',
  points: ['agent-hook'],
  defaultMode: 'block',
  // Stryker disable all: a prova é o teste da regra — mutar um caso dela é mutar o teste (um "allows" trocado por vazio passa por construção)
  proof: {
    catches: [
      { command: 'cat .env' },
      { command: 'grep TOKEN config/.env.production' },
      { command: 'node --env-file=.env dist/main.js' },
      { command: 'source .env' },
      { command: 'bash -c "cat .env.local"' },
      { command: 'cat ~/.ssh/id_rsa' },
      { command: 'echo x > .env' },
      { command: 'cat .env*' },
      { command: 'git show HEAD:.env' },
      { shell: 'powershell', command: 'Get-Content .env' },
      { kind: 'file', tool: 'Read', path: '/repo/.env' },
      { kind: 'file', tool: 'Read', path: '/repo/certs/server.pem' },
      { kind: 'file', tool: 'Edit', path: '/repo/config/credentials-prod.json' },
    ],
    allows: [
      { command: 'cat .env.example' },
      { command: 'cp .env.example .env' },
      { command: 'git commit -m "tira o .env do exemplo"' },
      { command: 'echo "copie o .env.example para .env"' },
      { kind: 'file', tool: 'Read', path: '/repo/.env.example' },
      { kind: 'file', tool: 'Read', path: '/repo/src/config/env.ts' },
    ],
  },
  // Stryker restore all
  evaluate(action) {
    if (action.kind === 'file') {
      return isSecretPath(action.path) ? [`${basename(action.path)} é arquivo de segredo. Leia o .env.example para saber as variáveis; peça ao usuário se precisar de um valor.`] : []
    }
    if (action.kind !== 'shell') return []
    for (const command of parseShell(action.command, action.shell)) {
      if (ehSetupDoEnv(command)) continue
      const palavras = command.args.filter(w => !(w.quoted && QUOTED_IS_DATA.has(command.program)))
      const alvos = [...palavras, ...command.redirects.map(r => r.target)]
      if (alvos.some(toca)) return ['o comando toca um arquivo de segredo (.env, chave, credencial). Use o .env.example para saber quais variáveis existem; o valor nunca entra no contexto.']
    }
    return []
  },
}
