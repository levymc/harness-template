/**
 * O motor das regras de ação do agente: o contrato de encaixe, a avaliação e a prova.
 *
 * Por que um motor e não um `if` por proibição dentro do hook: a regra que mora num hook só
 * é testada se alguém lembrar de escrever o teste. Aqui a regra não entra sem `proof` — os
 * casos que ela TEM de barrar e os casos vizinhos que ela TEM de deixar passar — e a prova de
 * toda regra roda a cada `pnpm harness:check` (regra `rule-proofs`). Regra que deriva para
 * bloquear tudo, ou que deixa de pegar o que dizia pegar, fica vermelha no Stop.
 *
 * Tudo puro: a configuração e o estado do git chegam prontos na ação. Ver ADR 0006.
 */
import { hashTerm } from '../lib.mjs'

/** Onde a regra roda. Só o hook do agente existe hoje; ponto novo entra quando algo o rodar (revisão fria). */
export const POINTS = Object.freeze(['agent-hook'])
export const MODES = Object.freeze(['warn', 'block'])
export const ACTION_KINDS = Object.freeze(['shell', 'file'])
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/**
 * @typedef {{ kind: 'shell', command: string, shell: 'bash'|'powershell', branch: string, hasCommits: boolean }
 *   | { kind: 'file', tool: 'Read'|'Edit'|'Write', path: string, content: string, insideRepo: boolean }} Action
 * @typedef {{
 *   id: string, reason: string, points: string[], defaultMode: 'warn'|'block',
 *   proof: { catches: object[], allows: object[] },
 *   evaluate: (action: Action, config: object) => string[]
 * }} Rule
 */

/** @returns {string[]} o que falta ou está errado; vazio quando a regra cumpre o contrato */
export function ruleContractProblems(rule) {
  const problems = []
  const fail = text => problems.push(`regra ${rule?.id ?? 'sem id'}: ${text}`)
  if (!ID.test(rule?.id ?? '')) fail('id ausente ou fora de kebab-case')
  if (typeof rule?.reason !== 'string' || rule.reason.trim().length < 10) fail('reason ausente: diga por que a regra existe')
  if (!Array.isArray(rule?.points) || !rule.points.length || rule.points.some(p => !POINTS.includes(p))) fail(`points precisa ter ao menos um de ${POINTS.join(', ')}`)
  if (!MODES.includes(rule?.defaultMode)) fail(`defaultMode precisa ser ${MODES.join(' ou ')}`)
  if (!rule?.proof?.catches?.length) fail('proof.catches vazio: a regra não prova que pega nada')
  if (!rule?.proof?.allows?.length) fail('proof.allows vazio: a regra não prova que deixa passar o caso vizinho')
  if (typeof rule?.evaluate !== 'function') fail('evaluate ausente')
  return problems
}

/** O modo vem do `harness.config.json` (`rules.<id>.mode`) e cai no padrão da regra. */
export function modeOf(rule, config) {
  const mode = config?.rules?.[rule.id]?.mode
  return MODES.includes(mode) ? mode : rule.defaultMode
}

/**
 * @returns {{ block: Finding[], warn: Finding[] }} onde Finding = { ruleId, message }
 */
export function evaluateAction(action, catalog, config) {
  const verdict = { block: [], warn: [] }
  for (const rule of catalog) {
    if (!rule.points.includes('agent-hook')) continue
    if (config?.rules?.[rule.id]?.mode === 'off') continue
    for (const message of rule.evaluate(action, config)) verdict[modeOf(rule, config)].push({ ruleId: rule.id, message })
  }
  return verdict
}

/**
 * O veredito no formato dos hooks: o que bloqueia vai junto (o modelo conserta tudo de uma
 * vez), cada linha com o id da regra e a seção de `docs/regras.md` que explica o porquê.
 * @returns {{ block?: string, warn?: string }}
 */
export function hookMessages({ block, warn }) {
  const linhas = findings => findings.map(f => `- [${f.ruleId}] ${f.message} (docs/regras.md#${f.ruleId})`).join('\n')
  return {
    ...(block.length ? { block: `Bloqueado:\n${linhas(block)}` } : {}),
    ...(warn.length ? { warn: `Aviso do harness (não bloqueou):\n${linhas(warn)}` } : {}),
  }
}

/** O termo proibido das provas: existe só aqui, para a prova não depender da config real. */
export const PROOF_TERM = 'termodeprova'

/** A configuração das provas: fixa, para a prova julgar a regra e não o repositório. */
export const PROOF_CONFIG = Object.freeze({
  protectedBranches: ['main', 'master'],
  safeRmTargets: ['node_modules', 'dist', '.harness'],
  forbiddenTerms: [hashTerm(PROOF_TERM)],
})

/** A ação de uma prova: o que o caso não diz vem de um bash numa branch de feature com histórico. */
export function proofAction(entry) {
  if (entry.kind === 'file') return { tool: 'Write', content: '', insideRepo: true, ...entry }
  return { kind: 'shell', shell: 'bash', branch: 'feat/x', hasCommits: true, ...entry }
}

/** @returns {string[]} cada caso da prova que a regra errou; vazio quando ela pega o que diz pegar */
export function proofFailures(rule) {
  const show = entry => JSON.stringify(entry.command ?? entry.path ?? entry)
  const failures = []
  for (const entry of rule.proof?.catches ?? []) {
    if (!rule.evaluate(proofAction(entry), PROOF_CONFIG).length) failures.push(`${rule.id}: deveria barrar e deixou passar ${show(entry)}`)
  }
  for (const entry of rule.proof?.allows ?? []) {
    const messages = rule.evaluate(proofAction(entry), PROOF_CONFIG)
    if (messages.length) failures.push(`${rule.id}: deveria deixar passar e barrou ${show(entry)} (${messages[0]})`)
  }
  return failures
}

/** Contrato + prova de todo o catálogo; é o que a regra `rule-proofs` do check-claims roda. */
export function catalogProblems(catalog) {
  const ids = catalog.map(rule => rule.id)
  const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i).map(id => `regra ${id} aparece duas vezes no catálogo`)
  return [...repetidos, ...catalog.flatMap(rule => {
    const contrato = ruleContractProblems(rule)
    return contrato.length ? contrato : proofFailures(rule)
  })]
}
