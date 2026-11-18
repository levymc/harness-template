/**
 * A barra pela qual o harness é julgado. O loop de melhoria (atrito → triagem → conserto) muda
 * COMO o harness trabalha; nunca a régua que o julga sem que alguém além de quem escreveu decida
 * sobre a ponta do PR. Sem isso, o agente que conserta o próprio harness pode, aos poucos,
 * afrouxar o gate, o teste ou a revisão que o reprovou — e cada passo parece razoável sozinho.
 *
 * Aqui moram os itens, as guardas e a leitura do diff; sem disco, sem rede (a entrada é a lista
 * de arquivos com o patch, venha do git local ou da API do GitHub). Quem decide se o PR pode
 * entrar é o `conferir-fluxo.mjs`, rodado da `main`.
 *
 * Máquina não separa "apertar" de "afrouxar" com certeza. Por isso, no código e na configuração
 * da barra, qualquer mudança conta, e a decisão sobre a ponta resolve. No texto das skills, conta
 * o termo que some; a frase reescrita que afrouxa e mantém o termo não é acusada, e fica para a
 * revisão fria e para quem lê. Adaptado do harness de referência (ADR 0007).
 *
 * Uso local: node scripts/harness/barra.mjs [--base origin/main]   (o que a branch muda na barra)
 */
import { execFileSync } from 'node:child_process'
import { isMain, ROOT } from './lib.mjs'

export const ITENS = {
  gate: 'o gate do CI e do harness',
  regras: 'as regras do motor e os hooks',
  pisos: 'o piso de mutação',
  sabotagem: 'a prova por sabotagem',
  revisaoFria: 'a revisão em contexto frio e a parada na segunda falha',
  atrito: 'a triagem com teste vermelho e a auditoria da sessão',
  conferidor: 'a barra e o conferidor do fluxo',
  autorizacao: 'quem autoriza o merge',
}

const TEXTO = /^(?:(?:\.claude\/skills|docs)\/.+|AGENTS|README|CLAUDE|\.github\/pull_request_template)\.md$/
/** O pulo de teste em qualquer forma: `.skip`, `.only`, `.todo`, `{ skip: … }`, `{ skip }`. */
const PULO_DE_TESTE = /\.(?:skip|only|todo)\b|\b(?:skip|only|todo)\s*:|[{,]\s*(?:skip|only|todo)\s*[,}]/
/** Os testes que o gate roda: os do harness e os do produto. Renomeado para fora, sai da barra e deixa de rodar. */
export const TESTE_DO_GATE = /^(?:scripts\/harness\/test\/[^/]+\.test\.mjs|(?:src|test)\/.+\.(?:spec|e2e-spec)\.ts)$/
const skillDaBarra = nome => new RegExp(`^\\.claude\\/skills\\/${nome}\\/SKILL\\.md$`)
const script = nomes => new RegExp(`^scripts\\/harness\\/(?:${nomes})\\.mjs$`)
const testeDe = nomes => new RegExp(`^scripts\\/harness\\/test\\/(?:${nomes})\\.test\\.mjs$`)

/**
 * O pulo só é procurado no código da linha: o texto entre aspas sai, e o que está em `${}` de
 * uma crase fica, porque roda. Texto que não fecha na linha: a linha inteira conta.
 */
export function codigoDaLinha(linha) {
  let codigo = ''
  let aspa = null
  const chaves = []
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (aspa) {
      if (c === '\\') i++
      else if (c === aspa) {
        aspa = null
        codigo += c
      } else if (aspa === '`' && c === '$' && linha[i + 1] === '{') {
        chaves.push(0)
        aspa = null
        codigo += '${'
        i++
      }
      continue
    }
    codigo += c
    if (c === '"' || c === "'" || c === '`') aspa = c
    else if (chaves.length && c === '{') chaves[chaves.length - 1]++
    else if (chaves.length && c === '}') {
      if (chaves[chaves.length - 1] === 0) {
        chaves.pop()
        aspa = '`'
      } else chaves[chaves.length - 1]--
    }
  }
  return aspa || chaves.length ? linha : codigo
}

/**
 * Cada guarda diz o arquivo e o sinal de afrouxar nele. O arquivo renomeado para fora sempre conta.
 * - `mudanca`: qualquer linha que sai ou entra (fora a em branco e o comentário de linha), o arquivo apagado e o renomeado.
 * - `linha`: qualquer linha que sai (o teste das travas: trocar o valor esperado conta).
 * - `trocada`: a linha que sai e não volta igual, fora a em branco, o comentário, o import e o título de teste renomeado.
 * - `linhaCom`/`entra`: a linha com o termo que sai, ou o termo que entra mais do que sai (o pulo de teste novo).
 * - `termo`: no texto, o termo some no saldo de todos os arquivos de texto do PR.
 * - `ignora`: a linha que muda sem ser barra (no package.json, a versão de uma dependência).
 * - `skill`: o SKILL.md de uma skill da barra, apagado: a skill deixa de ser carregada.
 * - `donos`: o CODEOWNERS, pelo conjunto de donos de cada regra.
 */
const guarda = (item, arquivo, sinal) => ({ item, arquivo, mudanca: false, linha: false, trocada: false, linhaCom: null, termo: null, entra: null, ignora: null, codigo: false, skill: false, donos: false, ...sinal })
const MUDANCA = { mudanca: true }
const LINHA = { linha: true }
const SKILL = { skill: true }

export const GUARDAS = [
  guarda(ITENS.gate, /^\.github\/workflows\//, MUDANCA),
  guarda(ITENS.gate, /^\.github\/actions\//, MUDANCA),
  guarda(ITENS.gate, /^package\.json$/, { mudanca: true, ignora: /^\s*"[@\w./-]+"\s*:\s*"[\^~]?\d[\w.+-]*"\s*,?\s*$/ }),
  guarda(ITENS.gate, /(?:^|\/)\.npmrc$/, MUDANCA),
  guarda(ITENS.gate, /^harness\.config\.json$/, MUDANCA),
  guarda(ITENS.gate, /^(?:vitest\.config(?:\.\w+)?\.ts|tsconfig(?:\.\w+)?\.json|\.oxlintrc\.json)$/, MUDANCA),
  guarda(ITENS.gate, script('check-claims|lib|suite|teto-de-memoria|memory|skills'), MUDANCA),
  guarda(ITENS.gate, TESTE_DO_GATE, { trocada: true, linhaCom: PULO_DE_TESTE, entra: PULO_DE_TESTE, codigo: true }),
  guarda(ITENS.gate, TEXTO, { termo: /\bgate\b|--no-verify|push forçado|pre-push/i }),
  guarda(ITENS.gate, skillDaBarra('pre-push'), SKILL),

  guarda(ITENS.regras, /^\.claude\/settings\.json$/, MUDANCA),
  guarda(ITENS.regras, /^\.claude\/hooks\//, MUDANCA),
  guarda(ITENS.regras, /^scripts\/harness\/rules\//, MUDANCA),
  guarda(ITENS.regras, /^docs\/guardrails\.md$/, LINHA),
  guarda(ITENS.regras, testeDe('hooks|rules'), LINHA),

  guarda(ITENS.pisos, /^stryker(?:\.\w+)?\.config\.json$/, MUDANCA),
  guarda(ITENS.pisos, script('mutacao|recorte'), MUDANCA),
  guarda(ITENS.pisos, testeDe('mutacao'), LINHA),
  guarda(ITENS.pisos, TEXTO, { termo: /\bpiso|muta[çc][ãa]o|sobreviv/i }),
  guarda(ITENS.pisos, skillDaBarra('cobrir-lacunas-de-teste'), SKILL),

  guarda(ITENS.sabotagem, script('prove'), MUDANCA),
  guarda(ITENS.sabotagem, testeDe('prove'), LINHA),
  guarda(ITENS.sabotagem, TEXTO, { termo: /sabot|prove que pega|prove\.mjs/i }),
  guarda(ITENS.sabotagem, skillDaBarra('licao'), SKILL),

  guarda(ITENS.revisaoFria, script('revisao-fria|falhas'), MUDANCA),
  guarda(ITENS.revisaoFria, /^\.claude\/agents\/revisor-frio\.md$/, MUDANCA),
  guarda(ITENS.revisaoFria, /^\.claude\/skills\/validar-antes-de-concluir\/references\//, MUDANCA),
  guarda(ITENS.revisaoFria, testeDe('validacao'), LINHA),
  guarda(ITENS.revisaoFria, TEXTO, { termo: /contexto frio|revis[ãa]o fria|revisor-frio|segunda falha/i }),
  guarda(ITENS.revisaoFria, skillDaBarra('validar-antes-de-concluir'), SKILL),

  guarda(ITENS.atrito, script('atrito|sessao|conferir-sessao'), MUDANCA),
  guarda(ITENS.atrito, testeDe('atrito'), LINHA),
  guarda(ITENS.atrito, TEXTO, { termo: /teste (?:novo )?vermelho|vermelho (?:contra|na) a? ?main/i }),
  guarda(ITENS.atrito, skillDaBarra('triar-atrito'), SKILL),

  guarda(ITENS.conferidor, script('barra|conferir-fluxo'), MUDANCA),
  guarda(ITENS.conferidor, testeDe('barra|conferir-fluxo'), LINHA),
  guarda(ITENS.conferidor, TEXTO, { termo: /conferidor|barra n[ãa]o se mexe|barra pela qual|decis[ãa]o (?:do merge )?(?:tomada )?na ponta/i }),

  guarda(ITENS.autorizacao, /^\.github\/CODEOWNERS$/, { mudanca: true, donos: true }),
  guarda(ITENS.autorizacao, TEXTO, { termo: /autoriza[çc][ãa]o do merge|agente nunca faz merge|nunca faz merge/i }),
]

/** O patch só tem os blocos @@: a linha com "-" saiu, a com "+" entrou, e o resto é contexto. */
export function linhasDoPatch(patch) {
  const removidas = []
  const adicionadas = []
  for (const linha of String(patch ?? '').split('\n')) {
    if (linha.startsWith('@@') || linha.startsWith('---') || linha.startsWith('+++')) continue
    if (linha.startsWith('-')) removidas.push(linha.slice(1))
    else if (linha.startsWith('+')) adicionadas.push(linha.slice(1))
  }
  return { removidas, adicionadas }
}

const curta = linha => {
  const t = linha.trim()
  return t.length > 100 ? `${t.slice(0, 97)}...` : t
}
const global = re => new RegExp(re.source, `${re.flags.replace('g', '')}g`)
const contar = (linhas, re) => linhas.reduce((n, l) => n + (l.match(global(re)) || []).length, 0)
// A linha de continuação de bloco (` * texto`) é comentário; a abertura `/*` conta, porque embrulha o código de baixo.
const ehComentario = linha => /^\s*(?:\/\/|#|\*(?!\/)|\*\/)/.test(linha)
const ehImport = linha => /^\s*import\s+(?!["'])[^;]*\bfrom\s*["']/.test(linha)
const TITULO_DE_TESTE = /^\s*(?:describe|it|test)\(\s*['"`]/

const regraDeDonos = linha => {
  const t = linha.trim()
  if (!t || t.startsWith('#')) return null
  const [padrao, ...donos] = t.split(/\s+/)
  return { padrao, donos: new Set(donos.map(d => d.toLowerCase())), linha: t }
}

/** O CODEOWNERS por bloco de troca: a ordem dos donos e o comentário não mudam quem aprova; ganhar ou perder dono muda. */
export function donosMudados(patch) {
  const blocos = []
  let atual = null
  for (const linha of String(patch ?? '').split('\n')) {
    const lado = linha[0]
    if ((lado !== '-' && lado !== '+') || linha.startsWith('---') || linha.startsWith('+++')) {
      atual = null
      continue
    }
    const regra = regraDeDonos(linha.slice(1))
    if (!regra) continue
    if (!atual || (lado === '-' && atual.entram.length)) blocos.push((atual = { saem: [], entram: [] }))
    ;(lado === '-' ? atual.saem : atual.entram).push(regra)
  }
  for (const { saem, entram } of blocos) {
    for (const [i, antes] of saem.entries()) {
      const depois = entram[i]
      if (!depois || depois.padrao !== antes.padrao) return `perdeu a linha "${antes.linha}"`
      const perdeu = [...antes.donos].filter(d => !depois.donos.has(d))
      if (perdeu.length) return `a regra de ${antes.padrao} perdeu ${perdeu.join(', ')}`
      const ganhou = [...depois.donos].filter(d => !antes.donos.has(d))
      if (ganhou.length) return `a regra de ${antes.padrao} ganhou ${ganhou.join(', ')}, que aprova sozinho`
    }
    if (entram.length > saem.length) return `ganhou a regra "${entram[saem.length].linha}", que tira a regra geral daquele caminho`
  }
  return null
}

function sinal(g, removidas, adicionadas, { termo = true, caminho = '', patch = '' } = {}) {
  if (g.donos) return donosMudados(patch)
  const codigoFonte = /\.(?:mjs|ts|json|ya?ml)$/.test(caminho)
  const teste = TESTE_DO_GATE.test(caminho) || /\.test\.mjs$/.test(caminho)
  const conta = l => l.trim() !== '' && !(g.ignora && g.ignora.test(l)) && !(codigoFonte && ehComentario(l)) && !(teste && ehImport(l))
  const doCodigo = linhas => (g.codigo ? linhas.filter(l => !ehComentario(l)).map(codigoDaLinha) : linhas)
  const comPulo = re => l => doCodigo([l]).some(c => re.test(c))
  if (g.mudanca || g.linha) {
    const saiu = removidas.find(conta)
    if (saiu) return `perdeu a linha "${curta(saiu)}"`
  }
  if (g.mudanca) {
    const entrou = adicionadas.find(conta)
    if (entrou) return `ganhou a linha "${curta(entrou)}"`
  }
  if (g.trocada) {
    const voltam = new Set(adicionadas.map(l => l.trim()))
    const titulos = new Set(adicionadas.filter(l => TITULO_DE_TESTE.test(l)).map(l => codigoDaLinha(l).trim()))
    const renomeado = l => TITULO_DE_TESTE.test(l) && titulos.has(codigoDaLinha(l).trim())
    const saiu = removidas.find(l => conta(l) && !voltam.has(l.trim()) && !renomeado(l))
    if (saiu) return `perdeu a linha "${curta(saiu)}"`
  }
  if (g.linhaCom) {
    const saiu = removidas.find(comPulo(g.linhaCom))
    if (saiu) return `perdeu a linha "${curta(saiu)}"`
  }
  if (g.termo && termo) {
    const antes = contar(removidas, g.termo)
    const depois = contar(adicionadas, g.termo)
    if (antes > depois) return `perdeu a linha "${curta(removidas.find(l => g.termo.test(l)))}" (o termo aparece ${antes} vez(es) no que sai e ${depois} no que entra)`
  }
  if (g.entra && contar(doCodigo(adicionadas), g.entra) > contar(doCodigo(removidas), g.entra)) {
    return `ganhou a linha "${curta(adicionadas.find(comPulo(g.entra)))}"`
  }
  return null
}

/**
 * @param arquivos [{ caminho, anterior?, status: 'added'|'modified'|'removed'|'renamed', patch?, alteracoes? }]
 * @returns {{ achados: { item, caminho, motivo }[], semPatch: string[] }} o que mexe na barra, um achado por item e
 *   arquivo, e os arquivos da barra que vieram sem diff (o GitHub corta o patch grande): sem ler, vai para a decisão.
 */
export function mudancasNaBarra(arquivos) {
  const achados = []
  const semPatch = new Set()
  const acusar = (item, caminho, motivo) => {
    if (!achados.some(a => a.item === item && a.caminho === caminho)) achados.push({ item, caminho, motivo })
  }
  const noTexto = new Map()
  for (const arquivo of arquivos) {
    const { caminho, anterior, status } = arquivo
    const { removidas, adicionadas } = linhasDoPatch(arquivo.patch)
    const semDiff = arquivo.patch === undefined || arquivo.patch === null
    for (const g of GUARDAS) {
      const agora = g.arquivo.test(caminho)
      const antes = anterior ? g.arquivo.test(anterior) : agora
      if (!agora && !antes) continue
      if (antes && !agora) acusar(g.item, caminho, `saiu de ${anterior} para ${caminho}, fora da barra`)
      else if (g.mudanca && status === 'removed') acusar(g.item, caminho, 'o arquivo foi apagado')
      else if (g.skill && status === 'removed') acusar(g.item, caminho, 'o arquivo foi apagado: a skill da barra deixa de ser carregada')
      else if (status === 'removed' && semDiff) acusar(g.item, caminho, 'o arquivo foi apagado, sem o diff para conferir')
      else if (g.mudanca && status === 'renamed') acusar(g.item, caminho, `foi renomeado de ${anterior} para ${caminho}`)
      else if (semDiff) {
        const semNadaQueSai = (status === 'renamed' && (arquivo.alteracoes ?? 1) === 0) || (status === 'added' && !g.mudanca)
        if (!semNadaQueSai) semPatch.add(caminho)
      } else {
        const saldoNoTexto = g.termo !== null && g.arquivo === TEXTO
        const motivo = sinal(g, removidas, adicionadas, { termo: !saldoNoTexto, caminho, patch: arquivo.patch })
        if (motivo) acusar(g.item, caminho, motivo)
        if (saldoNoTexto) {
          const saldo = noTexto.get(g) ?? { removidas: [], adicionadas: [], perdeu: [] }
          saldo.removidas.push(...removidas)
          // Só o termo que entra numa skill compensa: docs e README o agente não lê como regra.
          if (caminho.startsWith('.claude/skills/')) saldo.adicionadas.push(...adicionadas)
          if (contar(removidas, g.termo) > contar(adicionadas, g.termo)) saldo.perdeu.push({ caminho, linha: removidas.find(l => g.termo.test(l)) })
          noTexto.set(g, saldo)
        }
      }
    }
  }
  for (const [g, saldo] of noTexto) {
    const antes = contar(saldo.removidas, g.termo)
    const depois = contar(saldo.adicionadas, g.termo)
    if (antes <= depois) continue
    for (const { caminho, linha } of saldo.perdeu) {
      acusar(g.item, caminho, `perdeu a linha "${curta(linha)}" (o termo aparece ${antes} vez(es) no que sai e ${depois} no que entra, somados os arquivos de texto; se o texto só encurtou, diga por quê no PR — não devolva o termo só para a conta fechar)`)
    }
  }
  return { achados, semPatch: [...semPatch] }
}

const STATUS = { A: 'added', M: 'modified', D: 'removed', R: 'renamed' }

/** Os arquivos da branch contra a base, no formato que a API do GitHub dá, lidos do git local. */
export function arquivosDoGit(raiz, base) {
  const git = args => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return git(['diff', '--name-status', '-M', `${base}...HEAD`]).split('\n').filter(Boolean).map(linha => {
    const [codigo, a, b] = linha.split('\t')
    const status = STATUS[codigo[0]] ?? 'modified'
    const caminho = b ?? a
    const patch = git(['diff', '-M', `${base}...HEAD`, '--', ...(b ? [a, b] : [a])])
    return { caminho, anterior: b ? a : undefined, status, patch, alteracoes: patch.split('\n').filter(l => /^[+-](?![+-])/.test(l)).length }
  })
}

if (isMain(import.meta)) {
  const args = process.argv.slice(2)
  const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/main'
  const { achados, semPatch } = mudancasNaBarra(arquivosDoGit(ROOT, base))
  if (!achados.length && !semPatch.length) {
    console.log(`✓ a branch não mexe na barra (contra ${base})`)
  } else {
    console.log(`⚠ a branch mexe na barra (contra ${base}). O PR só entra com a decisão de quem não o escreveu sobre a ponta — revisão aprovada no último commit, ou o comentário "Autorização do merge" (docs/harness.md). Liste isto no PR:`)
    for (const a of achados) console.log(`  - ${a.item}: ${a.caminho} — ${a.motivo}`)
    for (const c of semPatch) console.log(`  - ${c}: sem diff para conferir`)
  }
}
