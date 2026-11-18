/**
 * O loop de atrito: o relato (skill `relatar-atrito`) e a triagem (skill `triar-atrito`).
 *
 * Por que existe: o harness só melhora pelo que o atrapalhou de verdade — e o atrito contado de
 * memória vira opinião. O relato separa o **visto** (citação literal de um turno da sessão,
 * conferida aqui) do **deduzido**. A triagem não aceita "é um defeito" sem o teste novo
 * **vermelho** contra a main: é o vermelho que prova o defeito, e é ele que vira guarda depois
 * do conserto (skill `licao`).
 *
 * A fila são issues do GitHub com o label `atrito`. Este script nunca publica: ele monta o corpo
 * e diz o comando `gh`; quem publica é o agente, depois do OK do usuário.
 *
 * Uso:
 *   node scripts/harness/atrito.mjs gerar <atrito.json> --sessao <sessao.jsonl>   (grava .harness/atrito.md)
 *   node scripts/harness/atrito.mjs fila                                            (issues atrito abertas, a mais antiga primeiro)
 *   node scripts/harness/atrito.mjs triagem <triagem.json>                          (grava .harness/triagem.md)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isMain, ROOT } from './lib.mjs'
import { lerSessao, mascarar } from './sessao.mjs'

export const ROTULO = 'atrito'
export const CLASSES = ['skill', 'script', 'hook', 'regra', 'documentação', 'fora do harness']

const vazio = v => !String(v ?? '').trim()
const exigir = (spec, campo, motivo = '') => {
  const v = campo.split('.').reduce((o, k) => o?.[k], spec)
  if (vazio(v)) throw new Error(`falta "${campo}"${motivo}`)
  return String(v).trim()
}
const semSegredo = (spec, onde) => {
  const texto = JSON.stringify(spec)
  if (mascarar(texto) !== texto) throw new Error(`cara de segredo no ${onde}: tire o valor do texto (o mascaramento mudaria: ${diferenca(texto, mascarar(texto))})`)
}
const diferenca = (a, b) => {
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return `…${a.slice(Math.max(0, i - 20), i + 20)}…`
}

/**
 * @param spec { titulo, onde (skill/script/hook), visto: [{ turno, trecho }], deduzido, esperado }
 * @param sessao a sessão lida por lerSessao: cada citação tem de estar, literal, no turno que diz
 */
export function corpoDoAtrito(spec, sessao) {
  exigir(spec, 'titulo')
  exigir(spec, 'onde', ': a skill, o script ou o hook em que o atrito aconteceu')
  exigir(spec, 'esperado', ': o que devia ter acontecido')
  if (!Array.isArray(spec.visto) || !spec.visto.length) throw new Error('falta "visto": ao menos uma citação literal da sessão, com o turno — sem ela, o atrito é opinião')
  for (const [i, v] of spec.visto.entries()) {
    const turno = sessao.turnos[Number(v.turno) - 1]
    if (!turno) throw new Error(`visto ${i + 1}: a sessão não tem o turno ${v.turno}`)
    if (vazio(v.trecho) || !mascarar(turno.texto).includes(v.trecho)) throw new Error(`visto ${i + 1}: a citação não está no turno ${v.turno}; copie o texto literal da leitura (sessao.mjs ler), sem reescrever`)
  }
  semSegredo(spec, 'atrito')
  return [
    `**Onde:** ${spec.onde}`,
    '',
    '## Visto na sessão',
    '',
    ...spec.visto.flatMap(v => [`Turno ${v.turno}${sessao.id ? ` da sessão ${sessao.id}` : ''}:`, '', '```', v.trecho, '```', '']),
    '## Deduzido (não conferido)',
    '',
    vazio(spec.deduzido) ? 'Nada além do visto.' : spec.deduzido.trim(),
    '',
    '## O que devia ter acontecido',
    '',
    spec.esperado.trim(),
    '',
  ].join('\n')
}

/** O vermelho que prova o defeito: a saída de um teste falhando. "✖ 0 problems" e "# fail 0" não contam. */
export function vermelho(saida) {
  const s = String(saida ?? '')
  if (/^# fail [1-9]/m.test(s) || /^not ok \d+/m.test(s)) return true
  if (/✖ [1-9]\d* (?:problems?|errors?|failing)/.test(s) || /\b[1-9]\d* (?:failed|failing)\b/.test(s)) return true
  if (/AssertionError|Tests?\s+[1-9]\d* failed|exit (?:code )?[1-9]/i.test(s)) return true
  return false
}

/** @param spec { issue, classe, reproduzido: { resultado: 'sim'|'não', como }, causa, correcao?: { arquivo, teste, vermelho }, destino? } */
export function comentarioDaTriagem(spec) {
  exigir(spec, 'issue', ': o número da issue de atrito')
  if (!CLASSES.includes(spec.classe)) throw new Error(`classe "${spec.classe}" fora da lista: ${CLASSES.join(', ')}`)
  const resultado = exigir(spec, 'reproduzido.resultado')
  if (!['sim', 'não'].includes(resultado)) throw new Error(`"reproduzido.resultado" é "sim" ou "não", não "${resultado}"`)
  const como = exigir(spec, 'reproduzido.como', resultado === 'não' ? ': diga por que não deu para reproduzir' : ': diga como reproduziu na main')
  exigir(spec, 'causa')
  const fora = spec.classe === 'fora do harness'
  if (fora) exigir(spec, 'destino', ': para onde o atrito vai')
  else {
    for (const campo of ['correcao.arquivo', 'correcao.teste', 'correcao.vermelho']) exigir(spec, campo, ': a correção diz o arquivo, o teste novo e a saída dele falhando na main')
    if (!vermelho(spec.correcao.vermelho)) throw new Error('"correcao.vermelho" não está vermelho: cole a saída do teste novo FALHANDO contra a main, antes do conserto')
  }
  semSegredo(spec, 'comentário da triagem')
  return [
    `## Triagem`,
    '',
    `**Classe:** ${spec.classe}`,
    resultado === 'sim' ? `**Reproduzido:** ${como}` : `**Não reproduzido:** ${como}`,
    resultado === 'sim' ? `**Causa:** ${spec.causa}` : `**Causa provável, não conferida:** ${spec.causa}`,
    ...(fora
      ? [`**Vai para:** ${spec.destino}`]
      : ['', '### Correção proposta', '', `**Arquivo:** \`${spec.correcao.arquivo}\``, `**Teste novo:** ${spec.correcao.teste}`, '', 'Saída do teste na main, antes do conserto:', '', '```', spec.correcao.vermelho.trim(), '```']),
    '',
  ].join('\n')
}

export function fila(executar = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) {
  let saida
  try {
    saida = executar(['issue', 'list', '--label', ROTULO, '--state', 'open', '--limit', '200', '--json', 'number,title,createdAt,url'])
  } catch (error) {
    throw new Error(`não deu para ler a fila pelo gh (${error.message.split('\n')[0]}). Sem gh, a fila é a lista de issues com o label "${ROTULO}" no GitHub.`)
  }
  return JSON.parse(saida).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

const gravar = (destino, texto) => {
  const caminho = resolve(ROOT, destino)
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, texto)
  return caminho
}

if (isMain(import.meta)) {
  const args = process.argv.slice(2)
  const [acao, arquivo] = args
  const opcao = nome => (args.includes(nome) ? args[args.indexOf(nome) + 1] : undefined)
  try {
    if (acao === 'gerar' && arquivo && opcao('--sessao')) {
      const spec = JSON.parse(readFileSync(arquivo, 'utf8'))
      const corpo = gravar('.harness/atrito.md', corpoDoAtrito(spec, lerSessao(readFileSync(opcao('--sessao'), 'utf8'))))
      console.log(`corpo gravado: ${corpo}\nConfira o texto com o usuário e, com o OK dele, publique:\n  gh issue create --label ${ROTULO} --title ${JSON.stringify(spec.titulo)} --body-file ${corpo}\nSem gh, o texto pronto está no arquivo.`)
    } else if (acao === 'fila') {
      const issues = fila()
      if (!issues.length) console.log('fila vazia: nenhuma issue de atrito aberta')
      for (const i of issues) console.log(`#${i.number}  ${i.createdAt.slice(0, 10)}  ${i.title}  ${i.url}`)
    } else if (acao === 'triagem' && arquivo) {
      const spec = JSON.parse(readFileSync(arquivo, 'utf8'))
      const corpo = gravar('.harness/triagem.md', comentarioDaTriagem(spec))
      console.log(`comentário gravado: ${corpo}\nCom o OK do usuário: gh issue comment ${spec.issue} --body-file ${corpo}`)
    } else {
      console.error('uso: node scripts/harness/atrito.mjs gerar <atrito.json> --sessao <sessao.jsonl> | fila | triagem <triagem.json>')
      process.exit(2)
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
