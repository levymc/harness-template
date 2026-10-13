/**
 * PreToolUse(Bash): bloqueia o que é difícil de desfazer ou que expõe segredo.
 *
 * Por que é hook e não frase: nos repositórios de onde este template saiu, "nunca commitar
 * na main", "nunca --force", "nunca --no-verify" estavam escritos em prosa — num deles,
 * o próprio CLAUDE.md admitia que eram só prosa e pedia "prefira hooks". Regra de
 * segurança sem controle real é a regra; estudos de 2026 contam 4,4% de cobertura.
 *
 * Decisões que não devem ser desfeitas (cada uma tem teste nos DOIS sentidos em
 * scripts/harness/test/hooks.test.mjs):
 *   - texto entre aspas e corpo de heredoc NÃO contam como comando: `git commit -m "fix
 *     push to main"` numa branch de feature passa. Guarda que grita em texto legítimo é
 *     desligado na primeira semana.
 *   - o PRIMEIRO commit do repositório passa, mesmo na main: não há outra branch ainda.
 *   - termo proibido é procurado no comando CRU (mensagem de commit inclusive).
 */
import { execFileSync } from 'node:child_process'
import { findForbidden, loadConfig } from '../../scripts/harness/lib.mjs'
import { isMain, runHook } from './_io.mjs'

const SEGREDO = /(^|[\s/\\'"=])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'";|&)])|\.pem\b|\bid_(rsa|ed25519)\b|credentials[\w-]*\.json/

/** Remove o que é dado, não comando: strings entre aspas e corpos de heredoc. */
export function stripData(command) {
  return command
    .replace(/<<-?\s*'?(\w+)'?[\s\S]*?\n\1\b/g, ' ')
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

function gitArgs(tokens) {
  const i = tokens.indexOf('git')
  if (i === -1) return null
  const rest = tokens.slice(i + 1)
  // pula opções globais: git -C dir, git -c k=v
  while (rest[0]?.startsWith('-')) rest.splice(0, ['-C', '-c'].includes(rest[0]) ? 2 : 1)
  return { sub: rest[0], args: rest.slice(1) }
}

/**
 * @returns {string|null} motivo do bloqueio, ou null para deixar passar
 */
export function decide(command, { branch = '', hasCommits = true, config }) {
  const protegidas = config.protectedBranches ?? ['main', 'master']
  const termos = findForbidden(command, config.forbiddenTerms)
  if (termos.length) return 'Bloqueado: o comando contém um termo proibido neste repositório (ver forbiddenTerms em harness.config.json). Reescreva sem ele.'

  const limpo = stripData(command)
  for (const segmento of limpo.split(/&&|\|\||;|\||\n/)) {
    const tokens = segmento.trim().split(/\s+/).filter(Boolean)
    if (!tokens.length) continue

    // cp .env.example .env é o setup normal; qualquer outra menção a segredo, não.
    const ehSetupDoEnv = tokens[0] === 'cp' && /\.env\.example$/.test(tokens[1] ?? '') && /(^|[/\\])\.env$/.test(tokens[2] ?? '')
    if (!ehSetupDoEnv && SEGREDO.test(segmento)) {
      return 'Bloqueado: o comando toca um arquivo de segredo (.env, chave, credencial). Use o .env.example para saber quais variáveis existem; o valor nunca entra no contexto.'
    }

    if (/(^|\/)migrate\.mjs$/.test(tokens.find(t => t.endsWith('migrate.mjs')) ?? '') && tokens.includes('--remote')) {
      return 'Bloqueado: migration em banco não-local é trabalho do pipeline de deploy, não do agente.'
    }

    const rmAt = tokens.findIndex(t => t === 'rm')
    if (rmAt > -1) {
      const flags = tokens.slice(rmAt + 1).filter(t => t.startsWith('-')).join('')
      if (/r|R/.test(flags) && /f/.test(flags)) {
        const alvos = tokens.slice(rmAt + 1).filter(t => !t.startsWith('-'))
        const seguros = new Set(config.safeRmTargets ?? [])
        const inseguros = alvos.filter(a => !seguros.has(a.replace(/^\.\//, '').replace(/\/$/, '')))
        if (!alvos.length || inseguros.length) {
          return `Bloqueado: rm -rf em ${inseguros.join(' ') || '(nada?)'}. Só ${[...seguros].join(', ')} podem ser apagados assim; para o resto, peça ao usuário.`
        }
      }
    }

    const g = gitArgs(tokens)
    if (!g) continue
    const { sub, args } = g
    if (sub === 'commit') {
      if (args.includes('--no-verify') || args.includes('-n')) return 'Bloqueado: --no-verify pula os hooks do git. Conserte o que o hook reclamou.'
      if (protegidas.includes(branch) && hasCommits) return `Bloqueado: commit direto em ${branch}. Crie uma branch (git switch -c <tipo>/<assunto>) e commite lá.`
    }
    if (sub === 'push') {
      const force = args.some(a => a === '--force' || a === '-f' || /^\+/.test(a))
      if (force && !args.some(a => a.startsWith('--force-with-lease'))) return 'Bloqueado: push --force reescreve histórico remoto. Se for mesmo necessário, use --force-with-lease numa branch sua, e só com o usuário pedindo.'
      const refspecs = args.filter(a => !a.startsWith('-')).slice(1)
      const alvoProtegido = refspecs.some(r => protegidas.includes(r.replace(/^\+/, '').split(':').pop()))
      if (alvoProtegido || (!refspecs.length && protegidas.includes(branch))) return 'Bloqueado: push direto para branch protegida. Abra um PR.'
    }
    if (sub === 'reset' && args.includes('--hard')) return 'Bloqueado: reset --hard descarta trabalho sem volta. Use um commit WIP ou git stash push -m <tag>.'
    if (sub === 'clean' && args.some(a => /^-\w*f/.test(a))) return 'Bloqueado: git clean -f apaga arquivos não versionados sem volta.'
    if ((sub === 'checkout' || sub === 'restore') && args.includes('.') ) return `Bloqueado: git ${sub} . descarta todas as mudanças não commitadas.`
  }
  return null
}

function gitState(cwd) {
  const run = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  let branch = ''
  let hasCommits = true
  try {
    branch = run(['symbolic-ref', '--short', 'HEAD'])
  } catch { /* HEAD destacado */ }
  try {
    run(['rev-parse', '--verify', 'HEAD'])
  } catch {
    hasCommits = false
  }
  return { branch, hasCommits }
}

if (isMain(import.meta)) {
  await runHook(input => {
    const command = input.tool_input?.command
    if (!command) return null
    return decide(command, { ...gitState(input.cwd ?? process.cwd()), config: loadConfig() })
  })
}
