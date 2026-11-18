/**
 * Termo de `forbiddenTerms` (harness.config.json) não entra no repositório nem no comando.
 *
 * No comando, procura no texto CRU — mensagem de commit inclusive: o commit é o caminho mais
 * curto para o termo chegar ao histórico. Na escrita, só dentro do repositório: fora dele (o
 * plano do modo plano, o scratchpad) nada é versionado, e o caminho da pasta de configuração
 * do usuário pode conter o termo — bloquear ali travou o modo plano sem proteger nada.
 */
import { findForbidden } from '../lib.mjs'

export default {
  id: 'forbidden-term',
  reason: 'O dono do repositório decidiu que certos nomes nunca aparecem nele; o termo é guardado só como hash.',
  points: ['agent-hook'],
  defaultMode: 'block',
  // Stryker disable all: a prova é o teste da regra — mutar um caso dela é mutar o teste (um "allows" trocado por vazio passa por construção)
  proof: {
    catches: [
      { command: 'git commit -m "integra com TermoDeProva"' },
      { command: 'echo termo-de-prova > notas.md' },
      { kind: 'file', tool: 'Write', path: '/repo/docs/a.md', content: 'cliente termodeprova' },
      { kind: 'file', tool: 'Edit', path: '/repo/docs/termodeprova.md', content: 'texto comum' },
    ],
    allows: [
      { command: 'git commit -m "texto comum"' },
      { kind: 'file', tool: 'Write', path: '/repo/docs/a.md', content: 'texto comum' },
      { kind: 'file', tool: 'Write', path: '/home/x/termodeprova-config/plano.md', content: 'termodeprova', insideRepo: false },
      { kind: 'file', tool: 'Read', path: '/repo/docs/a.md', content: 'termodeprova' },
    ],
  },
  // Stryker restore all
  evaluate(action, config) {
    const terms = config?.forbiddenTerms
    if (action.kind === 'shell') {
      return findForbidden(action.command ?? '', terms).length ? ['o comando contém um termo proibido neste repositório (forbiddenTerms em harness.config.json). Reescreva sem ele.'] : []
    }
    if (action.kind !== 'file' || action.tool === 'Read' || !action.insideRepo) return []
    return findForbidden(`${action.content ?? ''}\n${action.path ?? ''}`, terms).length
      ? ['o conteúdo contém um termo proibido neste repositório (forbiddenTerms em harness.config.json). Reescreva sem ele.']
      : []
  },
}
