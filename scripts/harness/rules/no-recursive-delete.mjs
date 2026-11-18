/**
 * Remoção recursiva e forçada só nos diretórios gerados (`safeRmTargets`). Alvo que só existe
 * na hora de rodar (`$X`, `~`, glob) conta como desconhecido — e desconhecido não é seguro.
 */
import { parseShell } from './shell.mjs'

const norm = alvo => alvo.replace(/^\.[\\/]/, '').replace(/[\\/]+$/, '')

function recursivoForcado(command) {
  if (command.program === 'rm') {
    const flags = command.args.filter(w => w.value.startsWith('-')).map(w => w.value)
    const curtas = flags.filter(f => !f.startsWith('--')).join('')
    const r = /r/i.test(curtas) || flags.includes('--recursive')
    const f = /f/.test(curtas) || flags.includes('--force')
    return r && f
  }
  if (command.program === 'remove-item' || command.program === 'rmdir' || command.program === 'rd') {
    const flags = command.args.map(w => w.value.toLowerCase())
    return flags.some(f => f.startsWith('-r') || f === '/s')
  }
  return false
}

export default {
  id: 'no-recursive-delete',
  reason: 'Apagar recursivamente fora dos diretórios gerados destrói fonte que talvez não esteja no git.',
  points: ['agent-hook'],
  defaultMode: 'block',
  proof: {
    catches: [
      { command: 'rm -rf src' },
      { command: 'rm -rf node_modules src' },
      { command: 'rm -fr ./docs/' },
      { command: 'rm --recursive --force src' },
      { command: 'rm -rf $DIR' },
      { command: 'rm -rf *' },
      { command: 'rm -rf /etc node_modules' },
      { command: 'rm -rf /x node_modules' },
      { shell: 'powershell', command: 'cmd /c rd /s /q src' },
      { command: 'bash -c "rm -rf ."' },
      { command: 'find . -name x -exec rm -rf {} +' },
      { shell: 'powershell', command: 'Remove-Item -Recurse -Force src' },
    ],
    allows: [
      { command: 'rm -rf node_modules dist/' },
      { command: 'rm -rf ./.harness' },
      { command: 'rm notas.md' },
      { command: 'git commit -m "nunca rode rm -rf src"' },
    ],
  },
  evaluate(action, config) {
    if (action.kind !== 'shell') return []
    const seguros = new Set(config?.safeRmTargets ?? [])
    const found = []
    for (const command of parseShell(action.command, action.shell)) {
      if (!recursivoForcado(command)) continue
      // `/s` e `/q` são flags só no rmdir/rd do cmd; no rm, `/etc` é alvo.
      const ehFlag = w => w.value.startsWith('-') || (command.program !== 'rm' && /^\/[a-z]$/i.test(w.value))
      const alvos = command.args.filter(w => !ehFlag(w))
      const inseguros = alvos.filter(w => w.dynamic || w.glob || !seguros.has(norm(w.value))).map(w => w.value)
      if (!alvos.length || inseguros.length) {
        found.push(`remoção recursiva em ${inseguros.join(' ') || '(alvo vazio)'}. Só ${[...seguros].join(', ')} podem ser apagados assim; para o resto, peça ao usuário.`)
      }
    }
    return found
  },
}
