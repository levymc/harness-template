/**
 * Mensagem de commit no padrão `tipo(escopo): assunto` (Conventional Commits), o que o
 * histórico do template já segue. Mensagem que o próprio git ou o GitHub escreve (merge,
 * revert, `fixup!`) passa: ninguém a digita. Nasce em `warn`: avisa, não barra.
 */
import { gitInvocation, parseShell } from './shell.mjs'

export const DEFAULT_TYPES = ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'ci', 'build', 'perf', 'style', 'revert']
const GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/
const HEADER = /^([a-z]+)(\([^()\s][^()]*\))?(!)?: (\S.*)$/

/** A primeira linha que vale: comentário do editor do git (`#`) não conta. */
export function subjectOf(message) {
  return (message ?? '').split(/\r?\n/).map(line => line.trimEnd()).find(line => line.trim() && !line.startsWith('#')) ?? ''
}

/** @returns {string[]} os problemas da mensagem; vazio quando está no padrão */
export function messageProblems(message, types = DEFAULT_TYPES) {
  const subject = subjectOf(message)
  if (!subject) return ['mensagem de commit vazia. Use tipo(escopo): assunto.']
  if (GENERATED.test(subject)) return []
  const header = HEADER.exec(subject)
  if (!header) return [`"${subject}" fora do padrão tipo(escopo): assunto (ex.: feat(harness): regra de push forçado).`]
  if (!types.includes(header[1])) return [`tipo "${header[1]}" fora da lista: ${types.join(', ')}.`]
  return []
}

/** A mensagem de cada `git commit -m` da linha: a primeira `-m` é o assunto. */
export function commitMessagesIn(action) {
  if (action.kind !== 'shell') return []
  const messages = []
  for (const command of parseShell(action.command, action.shell)) {
    const git = gitInvocation(command)
    if (git?.sub !== 'commit') continue
    const { args } = git
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (arg === '-m' || arg === '--message' || /^-[a-zA-Z]*m$/.test(arg)) {
        if (args[i + 1] !== undefined) messages.push(args[i + 1])
        break
      }
      if (arg.startsWith('--message=')) {
        messages.push(arg.slice('--message='.length))
        break
      }
    }
  }
  return messages
}

export default {
  id: 'commit-message-format',
  reason: 'Mensagem fora do padrão tipo(escopo): assunto quebra o histórico legível e as ferramentas que leem o tipo do commit.',
  points: ['agent-hook'],
  defaultMode: 'warn',
  proof: {
    catches: [
      { command: 'git commit -m "arrumei umas coisas"' },
      { command: 'git commit -m "Feat: maiúscula no tipo"' },
      { command: 'git commit -am "wip: tipo fora da lista"' },
      { command: 'git commit --message="feat:sem espaço"' },
    ],
    allows: [
      { command: 'git commit -m "feat(harness): motor de regras com prova"' },
      { command: 'git commit -m "fix: aspas no teste"' },
      { command: 'git commit -m "feat!: muda o formato da configuração"' },
      { command: `git commit -m 'Revert "feat: x"'` },
      { command: 'git commit --amend --no-edit' },
    ],
  },
  evaluate(action, config) {
    const types = config?.rules?.['commit-message-format']?.types ?? DEFAULT_TYPES
    return commitMessagesIn(action).flatMap(message => messageProblems(message, types))
  },
}
