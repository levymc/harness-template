/**
 * Lê a sessão do agente no arquivo que o Claude Code grava (`<config>/projects/<pasta>/<id>.jsonl`),
 * não num resumo, e tira dela o trecho de um atrito, sem segredo.
 *
 * Por que o arquivo e não a memória do agente: o relato de atrito escrito "de cabeça" mistura o
 * que aconteceu com o que o agente acha que aconteceu. O trecho literal, com o número do turno,
 * deixa quem tria conferir. O mascaramento é deliberadamente mais simples que o do harness de
 * referência: cobre as formas comuns; o que ele não pegar, a pessoa confere antes de publicar.
 *
 * Uso:
 *   node scripts/harness/sessao.mjs achar [--pasta <pasta de trabalho>]   (as sessões da pasta, a mais nova primeiro)
 *   node scripts/harness/sessao.mjs ler <sessao.jsonl> [--inteiro]        (todos os turnos, numerados e mascarados)
 *   node scripts/harness/sessao.mjs trecho <sessao.jsonl> <38-42[,50-55]> [destino.md]
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isMain } from './lib.mjs'

export const MASCARA = '[mascarado]'
const CREDENCIAL = 'secret|password|passwd|senha|token|api[_-]?key|access[_-]?key|private[_-]?key|credential'

/** Na ordem: o que tem forma conhecida sai antes das regras por nome, para não sobrar pedaço. */
const REGRAS = [
  [/-----BEGIN ([A-Z ]*)PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, `-----BEGIN $1PRIVATE KEY----- ${MASCARA} -----END $1PRIVATE KEY-----`],
  [/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|npm_[A-Za-z0-9]{30,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, MASCARA],
  [/\b(Authorization:\s*(?:[A-Za-z]+\s+)?)[^\s"'\\]+/gi, `$1${MASCARA}`],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, `$1 ${MASCARA}`],
  [/\b((?:Set-)?Cookie:\s*)[^"'\n\\]+/gi, `$1${MASCARA}`],
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+(?::[^\s/@]+)?@/gi, `$1${MASCARA}@`],
  [/(?<![\w.+%-])(?!git@)[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g, MASCARA],
  [new RegExp(`([?&][\\w.-]*(?:${CREDENCIAL}|signature)[\\w.-]*=)[^\\s&"'\\\\)]+`, 'gi'), `$1${MASCARA}`],
  // Nome de credencial com dois-pontos, ou colado no = (password=x). Com espaço em volta do = é
  // código (`const token = lerToken()`) e fica.
  [new RegExp(`((?:^|[^\\w])[\\w.-]*(?:${CREDENCIAL})[\\w.-]*(?:\\\\?"?\\s*:\\s*|=)\\\\?["']?)(?!\\[mascarado\\])[^\\s"'\\\\,;]+`, 'gi'), `$1${MASCARA}`],
  // Toda atribuição em MAIÚSCULAS perde o valor, até PORT=3000: o conteúdo de um .env lido na sessão não sai, e o nome fica.
  [/(?<![\w?&])([A-Z][A-Z0-9_]*=)(?!\[mascarado\])("[^"\n]*"|'[^'\n]*'|[^\s"'\\]+)/g, `$1${MASCARA}`],
]

export function mascarar(texto) {
  return REGRAS.reduce((t, [re, troca]) => t.replace(re, troca), String(texto ?? ''))
}

const COMPACTADO = '[contexto compactado aqui: o que veio antes foi resumido para o agente]'
export const QUEM = { pessoa: 'pessoa', agente: 'agente', ferramenta: 'agente chamou ferramenta', resultado: 'resultado da ferramenta', aviso: 'aviso da ferramenta', sistema: 'sistema' }

const textoDe = conteudo => {
  if (typeof conteudo === 'string') return conteudo
  if (!Array.isArray(conteudo)) return conteudo == null ? '' : JSON.stringify(conteudo)
  return conteudo.map(c => (typeof c === 'string' ? c : c.type === 'image' ? '[imagem]' : c.text ?? '')).join('\n')
}

/** Notificação, aviso e saída de comando chegam como registro "user", mas quem escreveu foi a ferramenta. */
const daPessoa = (r, texto) => {
  const origens = [r.origin?.kind, r.turnOrigin].filter(Boolean)
  if (origens.length) return origens.every(o => o === 'human')
  return !/^\s*<(?:system-reminder|task-notification|local-command-stdout|command-name)>/.test(texto)
}

/** @returns {{ id, turnos: { n, quem, texto, hora, ferramenta?, entrada? }[], ilegiveis: number }} */
export function lerSessao(texto) {
  const registros = []
  let ilegiveis = 0
  for (const linha of String(texto).split(/\r?\n/)) {
    if (!linha.trim()) continue
    try {
      registros.push(JSON.parse(linha))
    } catch {
      ilegiveis++
    }
  }
  // No arquivo de um subagente, toda linha é isSidechain: ali ela é a sessão inteira.
  const doSubagente = !registros.some(r => !r.isSidechain && (r.type === 'user' || r.type === 'assistant'))
  const turnos = []
  for (const r of registros) {
    if ((!doSubagente && r.isSidechain) || r.isMeta || (r.type !== 'user' && r.type !== 'assistant')) continue
    const hora = r.timestamp
    if (r.isCompactSummary) {
      turnos.push({ quem: 'sistema', texto: COMPACTADO, hora })
      continue
    }
    const conteudo = r.message?.content
    const partes = typeof conteudo === 'string' ? [{ type: 'text', text: conteudo }] : conteudo ?? []
    for (const c of partes) {
      if (c.type === 'text') turnos.push({ quem: r.type === 'assistant' ? 'agente' : daPessoa(r, c.text) ? 'pessoa' : 'aviso', texto: c.text, hora })
      else if (c.type === 'tool_use') turnos.push({ quem: 'ferramenta', texto: `${c.name} ${JSON.stringify(c.input)}`, ferramenta: c.name, entrada: c.input, hora })
      else if (c.type === 'tool_result') turnos.push({ quem: 'resultado', texto: (c.is_error ? '[erro] ' : '') + textoDe(c.content), erro: Boolean(c.is_error), hora })
    }
  }
  return {
    id: registros.findLast(r => r.sessionId)?.sessionId,
    turnos: turnos.filter(t => String(t.texto).trim()).map((t, i) => ({ n: i + 1, ...t })),
    ilegiveis,
  }
}

/** A pasta do projeto como o Claude Code a nomeia: todo caractere fora de [a-zA-Z0-9] vira hífen. */
export const pastaDoProjeto = cwd => String(cwd).replace(/[^a-zA-Z0-9]/g, '-')

export function pastaDeSessoes({ cwd = process.cwd(), home = homedir(), env = process.env } = {}) {
  return join(env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'projects', pastaDoProjeto(cwd))
}

export function acharSessoes(opcoes = {}) {
  const pasta = pastaDeSessoes(opcoes)
  if (!existsSync(pasta)) return []
  return readdirSync(pasta).filter(f => f.endsWith('.jsonl'))
    .map(f => ({ arquivo: join(pasta, f), modificado: statSync(join(pasta, f)).mtime }))
    .sort((a, b) => b.modificado - a.modificado)
}

/** "38-42,50" → [38..42, 50]; recusa forma errada e turno fora da sessão. */
export function turnosDoTrecho(total, spec) {
  const numeros = new Set()
  for (const parte of String(spec ?? '').split(',').map(p => p.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(parte)
    if (!m) throw new Error(`"${parte}" não é turno nem intervalo (use 38, 38-42 ou 38-42,50-55)`)
    const [de, ate] = [Number(m[1]), Number(m[2] ?? m[1])]
    if (de < 1 || de > ate) throw new Error(`intervalo inválido: ${parte}`)
    if (ate > total) throw new Error(`a sessão tem ${total} turnos, e o trecho vai até o ${ate}`)
    for (let n = de; n <= ate; n++) numeros.add(n)
  }
  if (!numeros.size) throw new Error('o trecho precisa de pelo menos um turno, como 38-42')
  return [...numeros].sort((a, b) => a - b)
}

export const cercado = texto => {
  const maior = Math.max(0, ...[...texto.matchAll(/`+/g)].map(m => m[0].length))
  const cerca = '`'.repeat(Math.max(3, maior + 1))
  return `${cerca}\n${texto}\n${cerca}`
}

export function trecho(sessao, spec) {
  const numeros = turnosDoTrecho(sessao.turnos.length, spec)
  return [
    `# Trecho da sessão${sessao.id ? ` ${sessao.id}` : ''}`,
    '',
    `Turnos ${spec} de ${sessao.turnos.length}. Texto literal, com tokens, chaves e valores de variável trocados por ${MASCARA}.`,
    ...numeros.flatMap(n => {
      const t = sessao.turnos[n - 1]
      return ['', `### Turno ${n} · ${QUEM[t.quem]} · ${t.hora ?? 'sem hora'}`, '', cercado(mascarar(t.texto))]
    }),
    '',
  ].join('\n')
}

const LIMITE_DA_LEITURA = 2000

if (isMain(import.meta)) {
  const [acao, arquivo, spec, destino] = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const args = process.argv.slice(2)
  const opcao = nome => (args.includes(nome) ? args[args.indexOf(nome) + 1] : undefined)
  try {
    if (acao === 'achar') {
      const cwd = opcao('--pasta') ?? process.cwd()
      const achadas = acharSessoes({ cwd })
      if (!achadas.length) throw new Error(`nenhuma sessão em ${pastaDeSessoes({ cwd })}; passe a pasta de trabalho com --pasta ou acerte o CLAUDE_CONFIG_DIR`)
      for (const s of achadas) console.log(`${s.modificado.toISOString().slice(0, 16).replace('T', ' ')} UTC  ${s.arquivo}`)
    } else if (acao === 'ler' && arquivo) {
      const s = lerSessao(readFileSync(arquivo, 'utf8'))
      console.log(`sessão ${s.id ?? 'sem id'}, ${s.turnos.length} turnos${s.ilegiveis ? `, ${s.ilegiveis} linha(s) ilegível(is)` : ''}`)
      for (const t of s.turnos) {
        const texto = mascarar(t.texto)
        const corte = !args.includes('--inteiro') && texto.length > LIMITE_DA_LEITURA
        console.log(`\n#${t.n} · ${QUEM[t.quem]} · ${t.hora ?? 'sem hora'}\n${corte ? `${texto.slice(0, LIMITE_DA_LEITURA)}\n[… ${texto.length - LIMITE_DA_LEITURA} caracteres cortados; --inteiro mostra tudo]` : texto}`)
      }
    } else if (acao === 'trecho' && arquivo && spec) {
      const saida = destino ?? '.harness/trecho.md'
      writeFileSync(saida, trecho(lerSessao(readFileSync(arquivo, 'utf8')), spec))
      console.log(`trecho gravado: ${saida}`)
    } else {
      console.error('uso: node scripts/harness/sessao.mjs achar [--pasta <pasta>] | ler <sessao.jsonl> [--inteiro] | trecho <sessao.jsonl> <38-42> [destino.md]')
      process.exit(2)
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
