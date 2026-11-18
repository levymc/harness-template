/**
 * PreToolUse(Read|Edit|Write): entrega fina sobre o motor de regras
 * (`scripts/harness/rules/`): segredo não entra no contexto (`no-secret-access`), termo
 * proibido não entra no repositório (`forbidden-term`). O termo é barrado AQUI, na escrita, e
 * não só no check-claims: é mais barato não escrever do que descobrir no Stop e reescrever.
 *
 * FALHA FECHADO (ADR 0006), com uma porta: se o motor quebra — config ilegível, erro de import
 * ou de sintaxe numa regra —, a escrita no próprio guarda (.claude/hooks/, scripts/harness/,
 * harness.config.json) continua liberada; senão o guarda quebrado impediria o agente de
 * consertá-lo. A porta não importa nada do harness (só o _io.mjs e o Node), para funcionar
 * justamente quando o harness está quebrado. Segredo continua barrado mesmo nela.
 */
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMain, runHook } from './_io.mjs'

const RAIZ = process.env.HARNESS_ROOT ? resolve(process.env.HARNESS_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Caminho relativo à raiz, com barra normal; null quando está fora dela. Compara sem caixa no Windows. */
export function repoPath(filePath, root = RAIZ) {
  if (!filePath) return ''
  const norm = path => (process.platform === 'win32' ? path.toLowerCase() : path)
  const caminho = relative(norm(resolve(root)), norm(resolve(root, filePath)))
  return caminho.startsWith('..') || isAbsolute(caminho) ? null : caminho.split('\\').join('/')
}

/** Cópia mínima da regra de segredo, para a porta de conserto não depender do motor. */
const ehSegredo = filePath => {
  const nome = basename(filePath ?? '')
  return nome !== '.env.example' && (/^\.env(\..+)?$/.test(nome) || /\.(pem|key|p12|pfx)$/.test(nome) || /^id_(rsa|ed25519)$/.test(nome) || /^credentials[\w-]*\.json$/.test(nome))
}

export function fileAction(input, root = RAIZ) {
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
export function repairsTheGuard(input, root = RAIZ) {
  const caminho = repoPath(input.tool_input?.file_path, root)
  if (caminho === null || ehSegredo(input.tool_input?.file_path)) return false
  return caminho === 'harness.config.json' || caminho.startsWith('.claude/hooks/') || caminho.startsWith('scripts/harness/')
}

if (isMain(import.meta)) {
  await runHook(
    async input => {
      const [{ loadConfig }, { CATALOG }, { evaluateAction, hookMessages }] = await Promise.all([
        import('../../scripts/harness/lib.mjs'),
        import('../../scripts/harness/rules/catalog.mjs'),
        import('../../scripts/harness/rules/engine.mjs'),
      ])
      return hookMessages(evaluateAction(fileAction(input), CATALOG, loadConfig()))
    },
    { failClosed: true, onError: input => (repairsTheGuard(input) ? null : 'barra') },
  )
}
