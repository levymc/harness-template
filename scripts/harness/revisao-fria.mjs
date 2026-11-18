/**
 * Revisão em contexto frio: monta o pedido para um agente NOVO (subagente `revisor-frio`) só
 * com o critério de aceite, as decisões declaradas, o diff dos commits e a saída do gate — e
 * confere a resposta dele (achado com arquivo e linha, ou "Nada a apontar.").
 *
 * Por que: quem escreveu tende a defender o próprio diff, e o subagente que herda a conversa
 * herda o raciocínio junto. O pedido é um arquivo, e o arquivo é tudo o que o revisor recebe;
 * o raciocínio de quem escreveu (`work/` com o PROGRESS.md, `.harness/` com as tentativas)
 * fica de fora — inclusive do diff.
 *
 * Uso:
 *   node scripts/harness/revisao-fria.mjs pedido (--tarefa work/<pasta> | --criterio <arquivo>)
 *        --comando "<cmd>" --saida <arquivo> [--comando … --saida …] [--decisoes <arquivo>]
 *        [--base origin/main] [--destino .harness/revisao-fria.md]
 *   node scripts/harness/revisao-fria.mjs achados [--pedido .harness/revisao-fria.md]
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isMain, ROOT } from './lib.mjs'
import { commitTypeOf } from './rules/commit-message-format.mjs'

export const ENTRADAS = ['criterio', 'diff', 'saidas', 'decisoes']
export const NADA = 'Nada a apontar.'
export const DESTINO = '.harness/revisao-fria.md'
export const LENTE_NATIVA = '.claude/skills/validar-antes-de-concluir/references/funcionalidade-nativa.md'
/** O log inteiro de uma suíte afoga o diff; fica o fim, onde os runners põem o resumo. */
export const LIMITE_DA_SAIDA = 20000
/** O que nunca vai ao revisor, nem pelo diff: o raciocínio de quem escreveu. */
export const FORA_DO_DIFF = [':(exclude)work', ':(exclude).harness']
// "- caminho:linha — o que está errado"; aceita intervalo (12-14) e hífen no lugar do travessão.
const ACHADO = /^-\s+`?([^\s`:]+)`?:(\d+)(?:-(\d+))?`?\s+[—–-]\s+(\S.*)$/

const vazio = v => v === undefined || v === null || !String(v).trim()

export function cortarSaida(texto, arquivo) {
  if (texto.length <= LIMITE_DA_SAIDA) return texto
  const linhas = texto.split('\n')
  let tamanho = 0
  let inicio = linhas.length
  while (tamanho + linhas[inicio - 1].length + 1 <= LIMITE_DA_SAIDA) tamanho += linhas[--inicio].length + 1
  const onde = arquivo ? `; a saída inteira está em ${arquivo}` : ''
  return `[cortado: ficaram de fora as primeiras ${inicio} de ${linhas.length} linhas (${texto.length} caracteres)${onde}]\n${linhas.slice(inicio).join('\n')}`
}

/** O critério de aceite da tarefa, como o task.json o declara. */
export function criterioDaTarefa(task) {
  const linhas = [`Objetivo: ${task.objetivo}`, '', ...task.criterios.map(c => `- ${c.descricao}`)]
  if (task.fora_de_escopo?.length) linhas.push('', 'Fora de escopo:', ...task.fora_de_escopo.map(f => `- ${f}`))
  return linhas.join('\n')
}

/** Com um commit `feat` na branch, a lente "funcionalidade nativa" entra; só `fix`, não (a correção fica do tamanho do defeito). */
export function lenteDoPr(mensagens) {
  const tipos = new Set(mensagens.map(commitTypeOf))
  if (tipos.has('feat')) return { aplica: true, motivo: 'há commit feat na branch' }
  if (tipos.has('fix')) return { aplica: false, motivo: 'a branch tem fix e nenhum feat: correção de bug' }
  return { aplica: false, motivo: 'nenhum commit feat na branch' }
}

export function recusaForaDeCommit(porcelain) {
  const linhas = porcelain.split('\n').filter(Boolean).map(l => `- ${l.slice(3)}`)
  return `há mudança fora de commit, e o revisor lê só o diff dos commits — commite ou descarte:\n${linhas.join('\n')}`
}

export function montarPedido(entrada, { lente } = {}) {
  const erros = []
  const extras = Object.keys(entrada).filter(k => !ENTRADAS.includes(k))
  if (extras.length) erros.push(`o revisor recebe só ${ENTRADAS.join(', ')}; tire ${extras.map(k => `"${k}"`).join(', ')}`)
  if (vazio(entrada.criterio)) erros.push('falta o critério de aceite')
  if (vazio(entrada.diff)) erros.push('falta o diff: sem mudança não há o que revisar')
  else if (!/^(diff --git |@@ )/m.test(entrada.diff)) erros.push('o diff não parece saída de git diff')
  const saidas = [].concat(entrada.saidas || [])
  if (!saidas.length) erros.push('falta a saída do gate (--comando/--saida): o revisor confere o que rodou')
  saidas.forEach((s, i) => {
    if (vazio(s?.comando)) erros.push(`saída ${i + 1} sem comando`)
    if (vazio(s?.texto)) erros.push(`saída ${i + 1} vazia: cole o que o comando mostrou`)
  })
  if (erros.length) throw new Error(`pedido recusado:\n- ${erros.join('\n- ')}`)

  return [
    '# Revisão em contexto frio',
    'Você revisa uma mudança sem ter participado dela. Abaixo estão só o critério de aceite, as decisões declaradas, o diff e a saída dos testes e do gate. Pode ler o código e a documentação do repositório para entender o contexto; não altere nada nele. **Não leia** `work/` nem `.harness/`: ali está o raciocínio de quem escreveu, que esta revisão deve evitar.',
    'Os testes já passaram. Procure o que passa no gate e ainda assim está errado: critério de aceite que o diff não cumpre, teste que não prova o que diz provar (passaria sem a mudança?), caminho de erro sem tratamento, comentário ou documentação que contradiz o código, instrução que cita caminho ou comando que não existe, guarda afrouxada.',
    'Confira cada decisão declarada contra o diff. Vira achado a decisão que o diff não mostra ou contradiz, e a escolha que o diff mostra (valor padrão, corte de escopo) sem estar declarada.',
    ...(lente === undefined ? [] : [descerTitulos(lente.trim())]),
    '## Como responder',
    `Um achado por linha, no formato \`- caminho/do/arquivo:linha — o que está errado e por quê\`, com o caminho como aparece no diff. Sem achado, responda só \`${NADA}\`. Não reescreva o código e não resuma a mudança.`,
    '## Critério de aceite',
    entrada.criterio.trim(),
    '## Decisões declaradas',
    vazio(entrada.decisoes) ? 'Nenhuma decisão além do critério.' : entrada.decisoes.trim(),
    '## Diff',
    cerca(entrada.diff, 'diff'),
    '## Saída dos testes e do gate',
    ...saidas.flatMap(s => [`\`${s.comando.trim()}\``, cerca(cortarSaida(s.texto, s.arquivo), 'text')]),
  ].join('\n\n') + '\n'
}

export function lerAchados(resposta) {
  const texto = String(resposta ?? '').trim()
  if (texto.replace(/[`*]/g, '').toLowerCase() === NADA.toLowerCase()) return []
  const erros = []
  const achados = []
  for (const linha of texto.split(/\r?\n/).map(l => l.trim())) {
    if (!linha.startsWith('- ')) continue
    const m = linha.match(ACHADO)
    if (!m) {
      erros.push(`achado sem arquivo e linha: "${linha.slice(0, 80)}"`)
      continue
    }
    achados.push({ arquivo: m[1], linha: Number(m[2]), ate: m[3] ? Number(m[3]) : undefined, oQue: m[4].trim() })
  }
  if (!achados.length && !erros.length) erros.push(`resposta fora do formato: nenhum "- arquivo:linha — …" e nem "${NADA}"`)
  if (erros.length) throw new Error(`resposta recusada:\n- ${erros.join('\n- ')}`)
  return achados
}

export const respostaDo = pedido => `${pedido.replace(/\.md$/, '')}.resposta.md`

/** A chamada ao revisor: só onde está o pedido, a raiz e onde gravar a resposta. */
export function chamada(pedido, raiz) {
  return `Leia o arquivo ${pedido} e faça a revisão que ele pede. O repositório revisado está em ${raiz}. Grave a resposta, só ela, em ${respostaDo(pedido)}.`
}

export function provaDaRevisao(pedido, achados) {
  const hash = createHash('sha256').update(pedido).digest('hex').slice(0, 12)
  return {
    oQueProva: `Revisão em contexto frio: ${achados.length ? `${achados.length} achado(s)` : 'nada a apontar'}.`,
    pedido: `sha256 ${hash}`,
    saida: achados.length ? achados.map(a => `${a.arquivo}:${a.linha}${a.ate ? `-${a.ate}` : ''} — ${a.oQue}`).join('\n') : NADA,
  }
}

function descerTitulos(texto) {
  let aberta = null
  return texto.split('\n').map(linha => {
    const marca = linha.match(/^\s*(`{3,}|~{3,})/)?.[1]
    if (marca && !aberta) aberta = marca
    else if (marca && marca[0] === aberta[0] && marca.length >= aberta.length) aberta = null
    else if (!aberta && /^#+ /.test(linha)) return `#${linha}`
    return linha
  }).join('\n')
}

function cerca(conteudo, linguagem) {
  const maior = Math.max(2, ...[...conteudo.matchAll(/`+/g)].map(m => m[0].length))
  const c = '`'.repeat(maior + 1)
  return `${c}${linguagem}\n${conteudo.replace(/\s+$/, '')}\n${c}`
}

/** Opção fora da lista é recusada: uma --conversa descartada em silêncio pareceria aceita. */
function opcoes(args, permitidas) {
  const o = { saidas: [] }
  for (let i = 0; i < args.length; i += 2) {
    const chave = args[i].replace(/^--/, '')
    const valor = args[i + 1]
    if (!args[i].startsWith('--') || valor === undefined) throw new Error(`opção sem valor: "${args[i]}"`)
    if (!permitidas.includes(args[i])) throw new Error(`opção desconhecida: ${args[i]} (use ${permitidas.join(', ')}); o revisor recebe só critério, decisões, diff e saídas`)
    if (chave === 'comando') o.saidas.push({ comando: valor })
    else if (chave === 'saida') {
      const ultima = o.saidas.at(-1)
      if (!ultima || ultima.arquivo) throw new Error(`--saida ${valor} sem o --comando que a produziu antes`)
      ultima.arquivo = valor
    } else o[chave] = valor
  }
  return o
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

export function gerarPedido(o, cwd = ROOT) {
  if (!o.tarefa && !o.criterio) throw new Error('falta --tarefa work/<pasta> (o critério sai do task.json) ou --criterio <arquivo>')
  const criterio = o.tarefa
    ? criterioDaTarefa(JSON.parse(readFileSync(resolve(cwd, o.tarefa, 'task.json'), 'utf8')))
    : readFileSync(resolve(cwd, o.criterio), 'utf8')
  // O diff sai dos commits: mudança fora de commit não chegaria ao revisor, e ele aprovaria o que não viu.
  const sujo = git(['status', '--porcelain', '--', '.', ...FORA_DO_DIFF], cwd)
  if (sujo.trim()) throw new Error(recusaForaDeCommit(sujo))
  const base = o.base || 'origin/main'
  const diff = git(['diff', `${base}...HEAD`, '--', '.', ...FORA_DO_DIFF], cwd)
  const saidas = o.saidas.map(s => {
    if (!s.arquivo) throw new Error(`--comando "${s.comando}" sem a --saida dele`)
    return { comando: s.comando, texto: readFileSync(resolve(cwd, s.arquivo), 'utf8'), arquivo: resolve(cwd, s.arquivo) }
  })
  const mensagens = git(['log', '--format=%B%x00', `${base}..HEAD`], cwd).split('\0').map(m => m.trim()).filter(Boolean)
  const lente = lenteDoPr(mensagens)
  const textoDaLente = resolve(cwd, LENTE_NATIVA)
  const usaLente = lente.aplica && existsSync(textoDaLente)
  const pedido = montarPedido(
    { criterio, diff, saidas, decisoes: o.decisoes ? readFileSync(resolve(cwd, o.decisoes), 'utf8') : undefined },
    usaLente ? { lente: readFileSync(textoDaLente, 'utf8') } : {},
  )
  return { pedido, lente: { ...lente, aplica: usaLente } }
}

if (isMain(import.meta)) {
  const [acao, ...resto] = process.argv.slice(2)
  try {
    if (acao === 'pedido') {
      const o = opcoes(resto, ['--tarefa', '--criterio', '--comando', '--saida', '--decisoes', '--base', '--destino'])
      const { pedido, lente } = gerarPedido(o)
      const destino = resolve(ROOT, o.destino || DESTINO)
      mkdirSync(dirname(destino), { recursive: true })
      writeFileSync(destino, pedido)
      const hash = createHash('sha256').update(pedido).digest('hex').slice(0, 12)
      console.log(`pedido gravado: ${destino} (sha256 ${hash}, ${pedido.length} caracteres)`)
      console.log(`lente "funcionalidade nativa": ${lente.aplica ? 'aplicada' : 'não aplicada'} (${lente.motivo})`)
      console.log('chame o subagente `revisor-frio` (nunca um fork, que herda a conversa) com esta frase, sem uma palavra a mais:')
      console.log(chamada(destino, ROOT))
    } else if (acao === 'achados') {
      const o = opcoes(resto, ['--pedido'])
      const pedido = resolve(ROOT, o.pedido || DESTINO)
      const resposta = respostaDo(pedido)
      if (!existsSync(resposta)) throw new Error(`a resposta do revisor não está em ${resposta}; se ela veio só na notificação do subagente, copie-a para lá e rode de novo`)
      const prova = provaDaRevisao(readFileSync(pedido, 'utf8'), lerAchados(readFileSync(resposta, 'utf8')))
      writeFileSync(`${resposta.replace(/\.md$/, '')}.prova.json`, `${JSON.stringify(prova, null, 2)}\n`)
      console.log(prova.oQueProva)
      console.log(prova.saida)
    } else {
      throw new Error('uso: node scripts/harness/revisao-fria.mjs pedido … | achados …')
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
