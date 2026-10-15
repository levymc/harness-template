/**
 * PreToolUse(Read|Edit|Write): segredo não entra no contexto; termo proibido não entra no repo.
 *
 * O deny de `Read(./.env)` em settings.json cobre o caminho óbvio; este hook cobre os
 * outros (`.env.production`, `config/.env.local`, chave .pem, credentials.json) e é testável.
 * O termo proibido é barrado AQUI, na escrita, e não só no check-claims: é mais barato
 * não escrever do que descobrir no Stop e reescrever.
 */
import { basename, isAbsolute, relative, resolve } from 'node:path'
import { findForbidden, loadConfig, ROOT } from '../../scripts/harness/lib.mjs'
import { isMain, runHook } from './_io.mjs'

export function isSecretPath(filePath) {
  const nome = basename(filePath ?? '')
  if (nome === '.env.example') return false
  return /^\.env(\..+)?$/.test(nome) || /\.(pem|key|p12|pfx)$/.test(nome) || /^id_(rsa|ed25519)$/.test(nome) || /^credentials[\w-]*\.json$/.test(nome)
}

/**
 * O termo proibido é proibido NO REPOSITÓRIO. Fora dele (o plano do modo plano, o
 * scratchpad) nada é versionado, e o caminho da pasta de configuração do usuário pode
 * conter o termo: bloquear ali travou o modo plano sem proteger nada.
 */
export function insideRepo(filePath, root = ROOT) {
  if (!filePath) return true
  const norm = path => (process.platform === 'win32' ? path.toLowerCase() : path)
  const caminho = relative(norm(resolve(root)), norm(resolve(root, filePath)))
  return !caminho.startsWith('..') && !isAbsolute(caminho)
}

export function decide(toolName, toolInput, config, root = ROOT) {
  if (isSecretPath(toolInput?.file_path)) {
    return `Bloqueado: ${basename(toolInput.file_path)} é arquivo de segredo. Leia o .env.example para saber as variáveis; peça ao usuário se precisar de um valor.`
  }
  if ((toolName === 'Write' || toolName === 'Edit') && insideRepo(toolInput?.file_path, root)) {
    const texto = `${toolInput?.content ?? ''}\n${toolInput?.new_string ?? ''}\n${toolInput?.file_path ?? ''}`
    if (findForbidden(texto, config.forbiddenTerms).length) {
      return 'Bloqueado: o conteúdo contém um termo proibido neste repositório (forbiddenTerms em harness.config.json). Reescreva sem ele.'
    }
  }
  return null
}

if (isMain(import.meta)) {
  await runHook(input => decide(input.tool_name, input.tool_input, loadConfig()))
}
