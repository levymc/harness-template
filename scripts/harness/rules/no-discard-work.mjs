/**
 * Comandos do git que descartam trabalho não commitado sem volta.
 */
import { gitInvocation, parseShell } from './shell.mjs'

function motivo({ sub, args }) {
  if (sub === 'reset' && args.includes('--hard')) return 'reset --hard descarta trabalho sem volta. Use um commit WIP ou git stash push -m <tag>.'
  if (sub === 'clean' && args.some(a => /^-\w*f/.test(a) || a === '--force')) return 'git clean -f apaga arquivos não versionados sem volta.'
  if ((sub === 'checkout' || sub === 'restore') && args.includes('.')) return `git ${sub} . descarta todas as mudanças não commitadas.`
  return null
}

export default {
  id: 'no-discard-work',
  reason: 'Trabalho não commitado descartado não volta: nem o reflog o guarda.',
  points: ['agent-hook'],
  defaultMode: 'block',
  proof: {
    catches: [
      { command: 'git reset --hard HEAD~1' },
      { command: 'git clean -fd' },
      { command: 'git checkout .' },
      { command: 'git checkout -- .' },
      { command: 'git restore .' },
      { command: 'bash -c "git reset --hard"' },
    ],
    allows: [
      { command: 'git reset --soft HEAD~1' },
      { command: 'git checkout -- src/a.ts' },
      { command: 'git clean -n' },
      { command: "git commit -m 'documenta: nunca faça a; git reset --hard HEAD'" },
      { command: "cat > notas.md <<'EOF'\nnunca rode git reset --hard\nEOF" },
    ],
  },
  evaluate(action) {
    if (action.kind !== 'shell') return []
    return parseShell(action.command, action.shell)
      .map(gitInvocation)
      .filter(Boolean)
      .map(motivo)
      .filter(Boolean)
  },
}
