/**
 * Parada do laço: anota cada tentativa de fazer o gate passar e manda PARAR quando a mesma
 * falha (mesmo teste, mesma mensagem) aparece duas vezes seguidas.
 *
 * Por que: a terceira tentativa com a mesma hipótese gasta tempo e não traz informação nova.
 * O agente em laço "conserta" a mesma coisa de jeitos cada vez mais tortos — até afrouxar o
 * teste. Quem decide o próximo passo, depois da segunda falha igual, é quem conduz a tarefa.
 *
 * Uso:
 *   node scripts/harness/falhas.mjs falhou --teste "<nome>" --mensagem "<linha de erro>" --tentativa "<o que mudou>" [--registro <arquivo>]
 *   node scripts/harness/falhas.mjs passou [--registro <arquivo>]
 * O registro padrão é .harness/tentativas.json (fora do git: é raciocínio de quem escreveu, e a
 * revisão fria não pode lê-lo). Sai 3 quando é hora de parar e grava, ao lado do registro, o
 * rascunho do bloqueio (.bloqueio.md) para o PROGRESS.md da tarefa e para o usuário.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isMain, ROOT } from './lib.mjs'

export const LIMITE = 2
export const REGISTRO = '.harness/tentativas.json'

const vazio = v => v === undefined || v === null || !String(v).trim()

/** O que muda de uma execução para outra sem mudar a falha: hora, duração, endereço de memória, espaço. */
export function normalizar(mensagem) {
  return String(mensagem ?? '')
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<hora>')
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g, '<hora>')
    .replace(/\b\d+(?:[.,]\d+)?\s?(?:ms|s)\b/g, '<duração>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<endereço>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function mesmaFalha(a, b) {
  return a?.resultado === 'falhou' && b?.resultado === 'falhou'
    && a.teste.trim() === b.teste.trim() && normalizar(a.mensagem) === normalizar(b.mensagem)
}

export function registrar(historico, evento) {
  if (evento.resultado === 'passou') return [...historico, { resultado: 'passou' }]
  const erros = []
  if (evento.resultado !== 'falhou') erros.push(`resultado desconhecido: "${evento.resultado}" (use falhou ou passou)`)
  if (vazio(evento.teste)) erros.push('falta --teste: o nome do teste ou do passo do gate que falhou')
  if (vazio(evento.mensagem)) erros.push('falta --mensagem: a linha de erro, copiada da saída como está')
  if (vazio(evento.tentativa)) erros.push('falta --tentativa: o que foi mudado antes de rodar de novo')
  if (erros.length) throw new Error(`tentativa recusada:\n- ${erros.join('\n- ')}`)
  const { resultado, teste, mensagem, tentativa } = evento
  return [...historico, { resultado, teste: teste.trim(), mensagem: mensagem.trim(), tentativa: tentativa.trim() }]
}

/** Só conta a sequência do fim: uma falha diferente ou um "passou" no meio zera a contagem. */
export function decidir(historico) {
  const ultima = historico.at(-1)
  if (!ultima || ultima.resultado !== 'falhou') return { parar: false, repeticoes: 0 }
  let repeticoes = 1
  for (let i = historico.length - 2; i >= 0 && mesmaFalha(historico[i], ultima); i--) repeticoes++
  return { parar: repeticoes >= LIMITE, repeticoes, falha: ultima, tentativas: historico.slice(-repeticoes) }
}

/** O rascunho do bloqueio: vai para o PROGRESS.md da tarefa e é o que se diz ao usuário. */
export function rascunhoDoBloqueio({ falha, tentativas }, data) {
  return [
    `### ${data} — BLOQUEADO em ${falha.teste}`,
    `- a mesma verificação falhou ${tentativas.length} vezes seguidas pelo mesmo motivo, e as tentativas pararam.`,
    `- mensagem: \`${falha.mensagem}\``,
    '- já tentado:',
    ...tentativas.map((t, i) => `  ${i + 1}. ${t.tentativa}`),
    '- próximo passo: decisão de quem conduz (outra hipótese, cortar escopo, ou relatar atrito com a skill `relatar-atrito` se o harness atrapalhou).',
    '',
  ].join('\n')
}

/** Data local da máquina, não a UTC: à noite no Brasil a UTC já é o dia seguinte. */
export const hoje = () => new Date().toLocaleDateString('sv-SE')

const OPCOES = ['--teste', '--mensagem', '--tentativa', '--registro']

function opcoes(args) {
  const o = {}
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined) throw new Error(`opção sem valor: "${args[i]}"`)
    if (!OPCOES.includes(args[i])) throw new Error(`opção desconhecida: ${args[i]} (use ${OPCOES.join(', ')})`)
    o[args[i].slice(2)] = args[i + 1]
  }
  return o
}

if (isMain(import.meta)) {
  const [resultado, ...resto] = process.argv.slice(2)
  try {
    if (resultado !== 'falhou' && resultado !== 'passou') {
      throw new Error('uso: node scripts/harness/falhas.mjs falhou --teste "<nome>" --mensagem "<linha de erro>" --tentativa "<o que mudou>" [--registro <arquivo>]\n     node scripts/harness/falhas.mjs passou [--registro <arquivo>]')
    }
    const o = opcoes(resto)
    const arquivo = resolve(ROOT, o.registro || REGISTRO)
    mkdirSync(dirname(arquivo), { recursive: true })
    const historico = registrar(existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : [], { ...o, resultado })
    writeFileSync(arquivo, `${JSON.stringify(historico, null, 2)}\n`)
    const decisao = decidir(historico)
    if (!decisao.parar) {
      console.log(resultado === 'passou' ? 'passou: contagem zerada.' : `falha ${decisao.repeticoes} de ${LIMITE} iguais seguidas: pode tentar de novo, com OUTRA hipótese.`)
    } else {
      const destino = arquivo.replace(/\.json$/, '') + '.bloqueio.md'
      writeFileSync(destino, rascunhoDoBloqueio(decisao, hoje()))
      console.error(`PARE: ${decisao.repeticoes} falhas iguais seguidas em "${decisao.falha.teste}". Não tente a terceira vez com a mesma hipótese: registre o bloqueio no PROGRESS.md (rascunho em ${destino}) e leve a decisão ao usuário.`)
      process.exit(3)
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
