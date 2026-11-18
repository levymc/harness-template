/**
 * PreToolUse(Read|Edit|Write): entrega fina sobre o motor de regras
 * (`scripts/harness/rules/`): segredo não entra no contexto (`no-secret-access`), termo
 * proibido não entra no repositório (`forbidden-term`). O termo é barrado AQUI, na escrita, e
 * não só no check-claims: é mais barato não escrever do que descobrir no Stop e reescrever.
 *
 * FALHA FECHADO (ADR 0006), com uma porta: se o motor quebra, a escrita no próprio guarda
 * (.claude/hooks/, scripts/harness/, harness.config.json) continua liberada — senão o guarda
 * quebrado impediria o agente de consertá-lo. Segredo continua barrado mesmo nessa porta.
 */
import { isAbsolute, relative, resolve } from 'node:path'
import { loadConfig, ROOT, toPosix } from '../../scripts/harness/lib.mjs'
import { CATALOG } from '../../scripts/harness/rules/catalog.mjs'
import { evaluateAction, hookMessages } from '../../scripts/harness/rules/engine.mjs'
import { isSecretPath } from '../../scripts/harness/rules/no-secret-access.mjs'
import { isMain, runHook } from './_io.mjs'

/** Caminho relativo à raiz, ou null quando está fora dela. Compara sem caixa no Windows. */
export function repoPath(filePath, root = ROOT) {
  if (!filePath) return ''
  const norm = path => (process.platform === 'win32' ? path.toLowerCase() : path)
  const caminho = relative(norm(resolve(root)), norm(resolve(root, filePath)))
  return caminho.startsWith('..') || isAbsolute(caminho) ? null : toPosix(caminho)
}

export function fileAction(input, root = ROOT) {
  const { tool_name: tool, tool_input: ti = {} } = input
  return {
    kind: 'file',
    tool,
    path: ti.file_path ?? '',
    content: `${ti.content ?? ''}\n${ti.new_string ?? ''}`,
    insideRepo: repoPath(ti.file_path, root) !== null,
  }
}

/** A porta de conserto: o que o agente precisa editar para consertar um guarda quebrado. */
export function repairsTheGuard(input, root = ROOT) {
  const caminho = repoPath(input.tool_input?.file_path, root)
  if (caminho === null || isSecretPath(input.tool_input?.file_path)) return false
  return caminho === 'harness.config.json' || caminho.startsWith('.claude/hooks/') || caminho.startsWith('scripts/harness/')
}

if (isMain(import.meta)) {
  await runHook(
    input => hookMessages(evaluateAction(fileAction(input), CATALOG, loadConfig())),
    { failClosed: true, onError: input => (repairsTheGuard(input) ? null : 'barra') },
  )
}
