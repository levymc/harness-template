/**
 * PreToolUse(Read|Edit|Write): segredo não entra no contexto; termo proibido não entra no repo.
 *
 * O deny de `Read(./.env)` em settings.json cobre o caminho óbvio; este hook cobre os
 * outros (`.env.production`, `config/.env.local`, chave .pem, credentials.json) e é testável.
 * O termo proibido é barrado AQUI, na escrita, e não só no check-claims: é mais barato
 * não escrever do que descobrir no Stop e reescrever.
 */
import { basename } from 'node:path'
import { findForbidden, loadConfig } from '../../scripts/harness/lib.mjs'
import { isMain, runHook } from './_io.mjs'

export function isSecretPath(filePath) {
  const nome = basename(filePath ?? '')
  if (nome === '.env.example') return false
  return /^\.env(\..+)?$/.test(nome) || /\.(pem|key|p12|pfx)$/.test(nome) || /^id_(rsa|ed25519)$/.test(nome) || /^credentials[\w-]*\.json$/.test(nome)
}

export function decide(toolName, toolInput, config) {
  if (isSecretPath(toolInput?.file_path)) {
    return `Bloqueado: ${basename(toolInput.file_path)} é arquivo de segredo. Leia o .env.example para saber as variáveis; peça ao usuário se precisar de um valor.`
  }
  if (toolName === 'Write' || toolName === 'Edit') {
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
