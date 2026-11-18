/**
 * PreToolUse(Bash|PowerShell): entrega fina sobre o motor de regras
 * (`scripts/harness/rules/`). As proibições moram lá, cada uma com a prova do que barra e do
 * que deixa passar; aqui só se monta a ação (comando, shell, branch, se há commits) e se
 * traduz o veredito para o protocolo do hook.
 *
 * Por que hook e não frase: nos repositórios de onde este template saiu, "nunca commitar na
 * main", "nunca --force", "nunca --no-verify" estavam escritos em prosa — num deles, o próprio
 * CLAUDE.md admitia que eram só prosa e pedia "prefira hooks".
 *
 * FALHA FECHADO (ADR 0006): erro do motor barra o comando. Os testes de
 * scripts/harness/test/hooks.test.mjs exercitam o processo como o Claude Code o roda.
 */
import { execFileSync } from 'node:child_process'
import { carregarMotor, isMain, runHook } from './_io.mjs'

export function gitState(cwd) {
  const run = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  let branch = ''
  let hasCommits = true
  try {
    branch = run(['symbolic-ref', '--short', 'HEAD'])
  } catch { /* HEAD destacado ou fora de um repositório */ }
  try {
    run(['rev-parse', '--verify', 'HEAD'])
  } catch {
    hasCommits = false
  }
  return { branch, hasCommits }
}

export function shellAction(input) {
  const command = input.tool_input?.command
  if (!command) return null
  const shell = input.tool_name === 'PowerShell' ? 'powershell' : 'bash'
  return { kind: 'shell', command, shell, ...gitState(input.cwd ?? process.cwd()) }
}

if (isMain(import.meta)) {
  await runHook(async input => {
    const action = shellAction(input)
    if (!action) return null
    const { loadConfig, CATALOG, evaluateAction, hookMessages } = await carregarMotor()
    return hookMessages(evaluateAction(action, CATALOG, loadConfig()))
  }, { failClosed: true })
}
