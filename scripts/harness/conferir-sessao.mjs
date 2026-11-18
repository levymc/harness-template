/**
 * Audita uma sessão do agente contra o ritual do AGENTS.md, pelo arquivo que o Claude Code grava.
 * Cada falta mostra onde o harness não segurou o agente — e vira atrito (skill `relatar-atrito`):
 * a skill `fechar-tarefa` roda isto antes de apagar a tarefa.
 *
 * Por que olhar a sessão e não o resultado: o resultado (o check, os testes) diz se o repositório
 * está consistente; não diz se o agente chegou lá pelo caminho combinado. "Pronto" sem dizer o
 * que não foi verificado, ou push sem rodar o gate, deixam o repositório verde e a pessoa enganada.
 *
 * As faltas (cada uma com o turno onde aconteceu):
 *   - tarefa-antes-da-edicao: 3+ edições de arquivo do repositório sem tarefa aberta antes da primeira
 *     (skill iniciar-tarefa, ou leitura/escrita de work/<x>/task.json ou PROGRESS.md);
 *   - validacao-antes-do-push: `git push` sem a skill pre-push ou validar-antes-de-concluir antes;
 *   - evidencia-do-criterio: `"passa": true` escrito no task.json sem `evidência (critério` escrito no
 *     PROGRESS.md na sessão;
 *   - resumo-com-nao-verificado: sessão que editou arquivo e cuja última fala do agente não diz o que
 *     não foi verificado.
 *
 * Uso: node scripts/harness/conferir-sessao.mjs [<sessao.jsonl>]   (sem arquivo: a sessão mais nova desta pasta)
 */
import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { isMain, ROOT, toPosix } from './lib.mjs'
import { gitInvocation, parseShell } from './rules/shell.mjs'
import { acharSessoes, lerSessao } from './sessao.mjs'

export const LIMITE_DE_EDICOES = 3
const EDICAO = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const LEITURA = new Set(['Read'])
const SHELL = new Set(['Bash', 'PowerShell'])
const NAO_VERIFICADO = /n[ãa]o (?:foi |foram )?verificad|n[ãa]o rod(?:ou|aram|ei)|n[ãa]o verifiquei|sem verificar|n[ãa]o testad|n[ãa]o (?:foi |foram )?(?:testad|conferid)|nada ficou sem verificar/i

/** Caminho relativo à raiz, com barra normal; null quando está fora do repositório. */
export function noRepositorio(caminho, raiz = ROOT) {
  if (!caminho) return null
  // No Windows a comparação ignora a caixa, mas o caminho devolvido mantém a do arquivo:
  // devolvê-lo em minúsculas fazia `PROGRESS.md` deixar de casar (visto no teste).
  const norm = p => (process.platform === 'win32' ? p.toLowerCase() : p)
  const fora = relative(norm(resolve(raiz)), norm(resolve(raiz, caminho)))
  if (fora.startsWith('..') || isAbsolute(fora)) return null
  return toPosix(resolve(raiz, caminho).slice(resolve(raiz).length).replace(/^[\\/]/, ''))
}

const ehDaTarefa = caminho => /^work\/[^/]+\/(?:task\.json|PROGRESS\.md)$/.test(caminho ?? '')
const conteudoDe = entrada => `${entrada?.content ?? ''}${entrada?.new_string ?? ''}${(entrada?.edits ?? []).map(e => e.new_string).join('')}`
const skillDe = t => (t.ferramenta === 'Skill' ? String(t.entrada?.skill ?? '').split(':').pop() : null)

/** @returns {{ falta: string, turno: number, oQue: string }[]} */
export function conferirSessao(sessao, raiz = ROOT) {
  const faltas = []
  const chamadas = sessao.turnos.filter(t => t.quem === 'ferramenta')
  const caminho = t => noRepositorio(t.entrada?.file_path ?? t.entrada?.notebook_path, raiz)
  const edicoes = chamadas.filter(t => EDICAO.has(t.ferramenta) && caminho(t) !== null && !caminho(t).startsWith('work/'))

  if (edicoes.length >= LIMITE_DE_EDICOES) {
    const primeira = edicoes[0].n
    const abriu = chamadas.some(t => t.n < primeira && (skillDe(t) === 'iniciar-tarefa' || ((EDICAO.has(t.ferramenta) || LEITURA.has(t.ferramenta)) && ehDaTarefa(caminho(t)))))
    if (!abriu) faltas.push({ falta: 'tarefa-antes-da-edicao', turno: primeira, oQue: `${edicoes.length} edições no repositório sem tarefa aberta em work/ antes da primeira (skill iniciar-tarefa)` })
  }

  const validou = n => chamadas.some(t => t.n < n && ['pre-push', 'validar-antes-de-concluir'].includes(skillDe(t)))
  // Pelo parser do motor, não por regex: a mensagem de commit que cita "git push" é dado, não push
  // (a regex acusou os commits desta própria tarefa, na primeira rodada contra uma sessão real).
  const fazPush = t => parseShell(t.entrada?.command ?? '', t.ferramenta === 'PowerShell' ? 'powershell' : 'bash').some(c => gitInvocation(c)?.sub === 'push')
  for (const t of chamadas.filter(t => SHELL.has(t.ferramenta) && fazPush(t))) {
    if (!validou(t.n)) faltas.push({ falta: 'validacao-antes-do-push', turno: t.n, oQue: 'git push sem a skill pre-push ou validar-antes-de-concluir antes' })
  }

  const escreveuEvidencia = chamadas.some(t => EDICAO.has(t.ferramenta) && /PROGRESS\.md$/.test(caminho(t) ?? '') && /evid[eê]ncia \(crit[eé]rio/i.test(conteudoDe(t.entrada)))
  for (const t of chamadas.filter(t => EDICAO.has(t.ferramenta) && /task\.json$/.test(caminho(t) ?? '') && /"passa"\s*:\s*true/.test(conteudoDe(t.entrada)))) {
    if (!escreveuEvidencia) faltas.push({ falta: 'evidencia-do-criterio', turno: t.n, oQue: '"passa": true no task.json sem "evidência (critério N)" escrito no PROGRESS.md' })
  }

  if (edicoes.length) {
    const ultima = sessao.turnos.findLast(t => t.quem === 'agente')
    if (ultima && !NAO_VERIFICADO.test(ultima.texto)) faltas.push({ falta: 'resumo-com-nao-verificado', turno: ultima.n, oQue: 'a última fala do agente, numa sessão que editou arquivos, não diz o que não foi verificado' })
  }
  return faltas
}

if (isMain(import.meta)) {
  try {
    const arquivo = process.argv[2] ?? acharSessoes({ cwd: ROOT })[0]?.arquivo
    if (!arquivo) throw new Error('nenhuma sessão desta pasta; passe o arquivo .jsonl (scripts/harness/sessao.mjs achar)')
    const faltas = conferirSessao(lerSessao(readFileSync(arquivo, 'utf8')))
    if (!faltas.length) {
      console.log(`✓ sessão conferida (${arquivo}): nenhuma falta ao ritual`)
    } else {
      console.error(`✗ ${faltas.length} falta(s) ao ritual na sessão ${arquivo}:`)
      for (const f of faltas) console.error(`  - turno ${f.turno} [${f.falta}] ${f.oQue}`)
      console.error('Cada falta mostra onde o harness não segurou o agente: relate pela skill relatar-atrito.')
      process.exit(1)
    }
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }
}
