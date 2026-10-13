/**
 * SessionStart: o ritual de início de sessão, automatizado.
 *
 * O ritual que funciona para agentes de sessão longa (Anthropic, "Effective harnesses
 * for long-running agents") é sempre o mesmo: onde estou, o que foi feito, o que está
 * aberto, o que mudou. Escrito em prosa, o agente pula; impresso aqui, ele vira
 * contexto que já está na conversa antes da primeira mensagem.
 *
 * Imprime também o ÍNDICE da memória — é o equivalente versionado do MEMORY.md que a
 * auto-memória carregaria, e por isso a auto-memória fica desligada em settings.json.
 * O índice tem teto (harness.config.json), então isto não cresce sem limite.
 *
 * Saída curta de propósito: cada linha aqui custa contexto em TODA sessão.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from '../../scripts/harness/lib.mjs'
import { suspects } from '../../scripts/harness/memory.mjs'
import { isMain, runHook } from './_io.mjs'

const git = args => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

export function openTasks(root = ROOT) {
  const dir = resolve(root, 'work')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(dir, d.name, 'task.json')))
    .map(d => {
      let task = {}
      try {
        task = JSON.parse(readFileSync(resolve(dir, d.name, 'task.json'), 'utf8'))
      } catch { /* o check-claims reclama do JSON inválido */ }
      const progresso = resolve(dir, d.name, 'PROGRESS.md')
      const ultima = existsSync(progresso)
        ? readFileSync(progresso, 'utf8').trim().split('\n').filter(l => l.trim()).pop() ?? ''
        : ''
      const pendentes = (task.criterios ?? []).filter(c => !c.passa).length
      return { slug: d.name, objetivo: task.objetivo ?? '?', pendentes, ultima }
    })
}

export function summary(root = ROOT) {
  const out = ['## Estado do repositório (hook SessionStart)', '']
  const branch = git(['symbolic-ref', '--short', 'HEAD']) || '(HEAD destacado)'
  const sujo = git(['status', '--porcelain']).split('\n').filter(Boolean).length
  out.push(`branch: ${branch}${sujo ? ` · ${sujo} arquivo(s) não commitado(s)` : ''}`)
  const log = git(['log', '--oneline', '-5'])
  if (log) out.push('últimos commits:', ...log.split('\n').map(l => `  ${l}`))

  const tarefas = openTasks(root)
  out.push('', tarefas.length ? 'tarefas abertas em work/ (continue de onde parou):' : 'nenhuma tarefa aberta em work/.')
  for (const t of tarefas) out.push(`  - ${t.slug}: ${t.objetivo} · ${t.pendentes} critério(s) pendente(s) · último registro: ${t.ultima.slice(0, 140)}`)

  const s = suspects(root)
  if (s.length) {
    out.push('', 'fatos de memória SUSPEITOS (o código citado mudou depois da verificação — confira antes de usar):')
    for (const x of s) out.push(`  - ${x.slug}: ${x.path} (${x.quando})`)
  }

  const indice = resolve(root, 'docs/memory/MEMORY.md')
  if (existsSync(indice)) out.push('', readFileSync(indice, 'utf8').trim())
  return out.join('\n')
}

if (isMain(import.meta)) {
  await runHook(() => {
    process.stdout.write(`${summary()}\n`)
    return null
  })
}
