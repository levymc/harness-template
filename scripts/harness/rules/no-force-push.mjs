/**
 * `git push` que reescreve o histórico remoto. `--force-with-lease` passa (decisão do
 * template desde o começo, coberta por teste): ele recusa sobrescrever trabalho que a ref
 * local não viu, e é o que a pessoa pede quando um rebase na branch dela é mesmo preciso.
 */
import { gitInvocation, parseShell } from './shell.mjs'

const WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec'])

function forcedFlag(args) {
  const lease = args.some(arg => arg.startsWith('--force-with-lease'))
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (WITH_VALUE.has(arg)) {
      i++
      continue
    }
    if (arg === '--mirror') return arg
    if (!lease && (arg === '--force' || arg === '--force-if-includes')) return arg
    if (!lease && /^-[a-zA-Z]*f[a-zA-Z]*$/.test(arg)) return '-f'
    if (!arg.startsWith('-') && arg.startsWith('+')) return `refspec ${arg}`
  }
  return null
}

export default {
  id: 'no-force-push',
  reason: 'Push forçado reescreve o histórico remoto e pode apagar trabalho de outra pessoa.',
  points: ['agent-hook'],
  defaultMode: 'block',
  proof: {
    catches: [
      { command: 'git push --force origin feat/x' },
      { command: 'git push -f' },
      { command: 'git push -uf origin feat/x' },
      { command: 'git push origin +feat/x' },
      { command: 'git -C ../outro push --force' },
      { command: 'git fetch && git push --mirror origin' },
      { command: 'bash -c "git push -f origin x"' },
      { command: 'echo $(git push --force)' },
      { command: 'timeout 60 git push --force' },
      { command: 'eval "git push --force"' },
      { command: 'git push --force-with-lease=main origin +feat/x' },
      { shell: 'powershell', command: 'git push --force origin feat/x' },
    ],
    allows: [
      { command: 'git push -u origin feat/x' },
      { command: 'git push --force-with-lease origin feat/x' },
      { command: 'git commit -m "explica por que nunca usar git push --force"' },
      { command: 'git push -o ci.skip origin feat/x' },
    ],
  },
  evaluate(action) {
    if (action.kind !== 'shell') return []
    const found = []
    for (const command of parseShell(action.command, action.shell)) {
      const git = gitInvocation(command)
      if (git?.sub !== 'push') continue
      const flag = forcedFlag(git.args)
      if (flag) found.push(`push forçado (${flag}) reescreve histórico remoto. Se for mesmo necessário, use --force-with-lease numa branch sua, e só com o usuário pedindo.`)
    }
    return found
  },
}
