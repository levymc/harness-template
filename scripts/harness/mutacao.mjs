/**
 * Mutação do PR: o Stryker muta só as linhas que o PR adiciona, em fatias, e cada arquivo
 * reprova abaixo do `break` da configuração. `planejar` diz as fatias; `rodar` roda uma.
 *
 * Por que só as linhas novas: mutar o repositório inteiro a cada PR não cabe no tempo, e o
 * que o PR pode ter deixado sem teste é o que ele trouxe. Por que mutação e não cobertura:
 * linha executada não é linha verificada — o teste que roda o código e não confere o
 * resultado dá 100% de cobertura e mata zero mutantes.
 *
 * Dois alvos, um por runner:
 *   - `harness`: scripts .mjs com node:test (`stryker.config.json`, command runner). O Stryker
 *     não sabe que teste cobre cada mutante; a fatia roda só os testes que ALCANÇAM os arquivos
 *     dela pelos imports (transitivo: a regra do motor é testada pelo catálogo que a importa)
 *     ou que os rodam como processo (o caminho do .mjs entre aspas, como os testes de hook).
 *   - `produto`: src/ com Vitest (`stryker.produto.config.json`); o runner do Vitest mede a
 *     cobertura por teste sozinho.
 *
 * Adaptado do harness de referência, que fatia o mesmo jeito.
 *
 * Uso:
 *   node scripts/harness/mutacao.mjs planejar --base origin/main
 *   node scripts/harness/mutacao.mjs rodar --alvo harness --arquivos "a.mjs:1-9,b.mjs:3-4"
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, posix } from 'node:path'
import { isMain, ROOT } from './lib.mjs'

export const ALVOS = Object.freeze({
  harness: 'stryker.config.json',
  produto: 'stryker.produto.config.json',
})
export const MARCA_DA_MUTACAO = 'MUTACAO_DO_PR'
/** Perto de 1,7 mutante por linha: a fatia cheia fica em uns 100 mutantes. */
export const LINHAS_POR_FATIA = 60
export const TETO_DE_MEMORIA_MB = 2048
export const TETO_DO_PROCESSO = './scripts/harness/teto-de-memoria.mjs'
const TESTE = /\.test\.mjs$/

/** As linhas que o diff `-U0` adiciona, por arquivo (caminho do lado novo). */
export function linhasAdicionadas(diff) {
  const porArquivo = new Map()
  let atual = null
  let linha = 0
  for (const texto of diff.split('\n')) {
    const arquivo = texto.match(/^\+\+\+ (?:b\/(.+)|\/dev\/null)$/)
    if (arquivo) {
      atual = arquivo[1] ?? null
      continue
    }
    const bloco = texto.match(/^@@ -\S+ \+(\d+)(?:,\d+)? @@/)
    if (bloco) {
      linha = Number(bloco[1])
      continue
    }
    if (atual === null || !texto.startsWith('+') || texto.startsWith('+++')) continue
    if (!porArquivo.has(atual)) porArquivo.set(atual, [])
    porArquivo.get(atual).push({ numero: linha, texto: texto.slice(1) })
    linha += 1
  }
  return porArquivo
}

/** O arquivo entra quando casa um glob positivo do `mutate` e nenhum negativo (`!`), como no Stryker. */
export function mutavel(caminho, globs) {
  const casa = glob => posix.matchesGlob(caminho, glob)
  return globs.some(g => !g.startsWith('!') && casa(g)) && !globs.some(g => g.startsWith('!') && casa(g.slice(1)))
}

/** [1, 2, 3, 7] vira [[1, 3], [7, 7]]. */
export function faixas(numeros) {
  const resultado = []
  for (const n of [...new Set(numeros)].sort((a, b) => a - b)) {
    const ultima = resultado.at(-1)
    if (ultima && n === ultima[1] + 1) ultima[1] = n
    else resultado.push([n, n])
  }
  return resultado
}

/** Reparte as linhas em fatias de até `maximo`, cortando a faixa que não cabe; cada fatia é `arquivo:início-fim,…`. */
export function fatiar(linhasPorArquivo, maximo) {
  const fatias = []
  let atual = []
  let ocupadas = 0
  const fechar = () => {
    if (atual.length) fatias.push(atual)
    atual = []
    ocupadas = 0
  }
  for (const [arquivo, numeros] of linhasPorArquivo) {
    for (const [inicio, fim] of faixas(numeros)) {
      let de = inicio
      while (de <= fim) {
        const ate = Math.min(fim, de + (maximo - ocupadas) - 1)
        atual.push(`${arquivo}:${de}-${ate}`)
        ocupadas += ate - de + 1
        de = ate + 1
        if (ocupadas === maximo) fechar()
      }
    }
  }
  fechar()
  return fatias.map(arquivos => arquivos.join(','))
}

/** Linha nova que desliga o Stryker sem dizer o motivo depois de `:`. O motivo é o que a revisão lê. */
export function desligadasSemMotivo(linhasPorArquivo) {
  const faltas = []
  for (const [arquivo, linhas] of linhasPorArquivo) {
    for (const { numero, texto } of linhas) {
      if (/Stryker\s+disable/.test(texto) && !/Stryker\s+disable[^:]*:\s*\S/.test(texto)) faltas.push(`${arquivo}:${numero}`)
    }
  }
  return faltas
}

/** Os arquivos que `origem` usa: o import relativo entre aspas e o `.mjs` com pasta citado entre aspas (o teste que roda o script). */
export function referencias(origem, texto, caminhos) {
  const usados = new Set()
  const usar = caminho => caminho !== origem && usados.add(caminho)
  const pasta = posix.dirname(origem)
  for (const m of texto.matchAll(/["'`](\.{1,2}\/[^"'`$]+)["'`]/g)) {
    const alvo = posix.normalize(posix.join(pasta, m[1]))
    for (const caminho of caminhos) if (caminho === alvo) usar(caminho)
  }
  for (const m of texto.matchAll(/["'`]([\w.-]+(?:\/[\w.-]+)+\.mjs)["'`]/g)) {
    for (const caminho of caminhos) if (caminho === m[1] || caminho.endsWith(`/${m[1]}`)) usar(caminho)
  }
  return usados
}

/** Os testes que alcançam algum dos `alvos` pelo grafo (transitivo), em ordem alfabética. */
export function testesQueUsam(alvos, grafo) {
  const alcanca = new Map()
  const visita = (origem, caminho = new Set()) => {
    if (alcanca.has(origem)) return alcanca.get(origem)
    if (caminho.has(origem)) return new Set()
    caminho.add(origem)
    const todos = new Set()
    for (const usado of grafo.get(origem) ?? []) {
      todos.add(usado)
      for (const indireto of visita(usado, caminho)) todos.add(indireto)
    }
    caminho.delete(origem)
    alcanca.set(origem, todos)
    return todos
  }
  return [...grafo.keys()].filter(c => TESTE.test(c) && alvos.some(alvo => visita(c).has(alvo))).sort()
}

/** A fatia só junta arquivos com os mesmos testes: roda os testes de todos eles a cada mutante. */
export function fatiarPorTestes(linhasPorArquivo, grafo, maximo) {
  const grupos = new Map()
  for (const [arquivo, numeros] of linhasPorArquivo) {
    const chave = testesQueUsam([arquivo], grafo).join('\n')
    if (!grupos.has(chave)) grupos.set(chave, new Map())
    grupos.get(chave).set(arquivo, numeros)
  }
  return [...grupos.values()].flatMap(grupo => fatiar(grupo, maximo))
}

/** Os arquivos do relatório JSON abaixo do `break`: o Stryker aplica o break à fatia, e o arquivo fraco some na média. */
export function abaixoDoBreak(relatorio) {
  const detectado = new Set(['Killed', 'Timeout'])
  const valido = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage'])
  const abaixo = []
  for (const [arquivo, { mutants }] of Object.entries(relatorio.files)) {
    const validos = mutants.filter(m => valido.has(m.status))
    if (!validos.length) continue
    const placar = (100 * validos.filter(m => detectado.has(m.status)).length) / validos.length
    if (placar < relatorio.thresholds.break) abaixo.push({ arquivo, placar })
  }
  return abaixo
}

export const arquivosDaFatia = arquivos => [...new Set(arquivos.split(',').map(a => a.replace(/:\d+-\d+$/, '')))]

/** A configuração da fatia: a base com o `mutate` dela e, no harness, o `node --test` só dos testes dela, com o teto de RAM. */
export function configDaFatia(base, alvo, arquivos, testes = []) {
  const config = { ...base, mutate: arquivos.split(','), jsonReporter: { fileName: 'reports/mutation/mutation.json' } }
  delete config.$comentario
  if (alvo === 'harness') {
    const aspas = t => `"${t}"`
    config.commandRunner = { command: `node --max-old-space-size=${TETO_DE_MEMORIA_MB} --import ${aspas(TETO_DO_PROCESSO)} --test ${testes.map(aspas).join(' ')}` }
  }
  return config
}

// --- disco, git e processos ---

const git = (raiz, args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const lerConfig = (raiz, alvo) => JSON.parse(readFileSync(join(raiz, ALVOS[alvo]), 'utf8'))

export function grafoDoRepositorio(raiz) {
  const caminhos = git(raiz, ['-c', 'core.quotePath=false', 'ls-files', '--cached', '--others', '--exclude-standard', '*.mjs']).split('\n').filter(Boolean)
  return new Map(caminhos.map(c => [c, referencias(c, readFileSync(join(raiz, c), 'utf8'), caminhos)]))
}

/** @returns {{ codigo: number, matriz: { fatia, alvo, arquivos }[], linhas: string[] }} */
export function planejar(raiz, base) {
  const diff = git(raiz, ['-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '--no-renames', '--diff-filter=AM', `${base}...HEAD`])
  const adicionadas = [...linhasAdicionadas(diff)].filter(([, linhas]) => linhas.some(l => l.texto.trim()))
  const semMotivo = desligadasSemMotivo(new Map(adicionadas))
  if (semMotivo.length) return { codigo: 1, matriz: [], linhas: ['Stryker desligado sem o motivo depois de `:` (o motivo é o que a revisão lê):', ...semMotivo.map(l => `- ${l}`)] }
  const matriz = []
  const linhas = []
  for (const alvo of Object.keys(ALVOS)) {
    const { mutate } = lerConfig(raiz, alvo)
    const mutaveis = new Map(adicionadas.filter(([arquivo]) => mutavel(arquivo, mutate)).map(([arquivo, l]) => [arquivo, l.map(x => x.numero)]))
    if (!mutaveis.size) continue
    const fatias = alvo === 'harness' ? fatiarPorTestes(mutaveis, grafoDoRepositorio(raiz), LINHAS_POR_FATIA) : fatiar(mutaveis, LINHAS_POR_FATIA)
    for (const arquivos of fatias) matriz.push({ fatia: matriz.length + 1, alvo, arquivos })
    linhas.push(`${alvo}: ${[...mutaveis.values()].flat().length} linha(s) nova(s) em ${mutaveis.size} arquivo(s), ${fatias.length} fatia(s)`)
  }
  if (!matriz.length) return { codigo: 0, matriz, linhas: ['Nada a mutar: o PR não adiciona linha em arquivo que um `mutate` cobre.'] }
  return { codigo: 0, matriz, linhas: [...linhas, ...matriz.map(f => `- fatia ${f.fatia} (${f.alvo}): ${f.arquivos}`)] }
}

export function rodar(raiz, alvo, arquivos) {
  if (!ALVOS[alvo]) return { codigo: 1, linhas: [`alvo desconhecido: ${alvo} (use ${Object.keys(ALVOS).join(' ou ')})`] }
  // Com inPlace, o Stryker guarda os originais em .stryker-tmp/backup-*; a corrida cortada deixa o backup e os fontes mutados.
  const tmp = join(raiz, '.stryker-tmp')
  const backups = existsSync(tmp) ? readdirSync(tmp).filter(n => n.startsWith('backup-')) : []
  if (backups.length) {
    return { codigo: 1, linhas: [`Uma corrida anterior foi cortada e deixou ${backups.map(b => `.stryker-tmp/${b}`).join(', ')}: os fontes podem estar mutados.`, 'Confira com `git status` e `git diff`, devolva cada arquivo e apague a pasta .stryker-tmp.'] }
  }
  let testes = []
  if (alvo === 'harness') {
    const grafo = grafoDoRepositorio(raiz)
    const alvos = arquivosDaFatia(arquivos)
    const semTeste = alvos.filter(a => testesQueUsam([a], grafo).length === 0)
    if (semTeste.length) return { codigo: 1, linhas: ['Nenhum teste alcança estes arquivos; escreva o teste (todo mutante sobreviveria):', ...semTeste.map(a => `- ${a}`)] }
    testes = testesQueUsam(alvos, grafo)
    console.log(`Testes da fatia (${testes.length}):\n${testes.map(t => `- ${t}`).join('\n')}`)
  }
  // Stryker disable next-line StringLiteral: o prefixo só dá nome à pasta temporária.
  const pasta = mkdtempSync(join(tmpdir(), 'mutacao-'))
  try {
    const config = join(pasta, 'stryker.json')
    writeFileSync(config, JSON.stringify(configDaFatia(lerConfig(raiz, alvo), alvo, arquivos, testes), null, 2))
    // Herdado de um `node --test`, o NODE_TEST_CONTEXT faria cada mutante só reportar ao pai — e todo mutante sobreviveria.
    const { NODE_TEST_CONTEXT, ...ambiente } = process.env
    ambiente[MARCA_DA_MUTACAO] = '1'
    const bin = join(raiz, 'node_modules', '@stryker-mutator', 'core', 'bin', 'stryker.js')
    const stryker = spawnSync(process.execPath, [bin, 'run', config], { cwd: raiz, env: ambiente, stdio: 'inherit' })
    if (stryker.status !== 0) return { codigo: 1, linhas: [] }
    const abaixo = abaixoDoBreak(JSON.parse(readFileSync(join(raiz, 'reports', 'mutation', 'mutation.json'), 'utf8')))
    if (!abaixo.length) return { codigo: 0, linhas: [] }
    return { codigo: 1, linhas: ['A fatia passou na soma, mas estes arquivos ficaram abaixo do break; cada sobrevivente está no relatório acima:', ...abaixo.map(a => `- ${a.arquivo}: ${a.placar.toFixed(2)}%`)] }
  } finally {
    rmSync(pasta, { recursive: true, force: true, maxRetries: 10 })
  }
}

const USO = 'uso: node scripts/harness/mutacao.mjs planejar --base origin/main | rodar --alvo harness|produto --arquivos "a.mjs:1-9,b.mjs:3-4"'

if (isMain(import.meta)) {
  const [modo, ...args] = process.argv.slice(2)
  const valor = nome => (args.includes(nome) ? args[args.indexOf(nome) + 1] : undefined)
  if (modo === 'planejar' && valor('--base')) {
    const r = planejar(ROOT, valor('--base'))
    // No planejar, o stdout é só a matriz que o workflow lê; o resumo vai ao stderr.
    process.stdout.write(`${JSON.stringify(r.matriz)}\n`)
    for (const linha of r.linhas) console.error(linha)
    process.exitCode = r.codigo
  } else if (modo === 'rodar' && valor('--alvo') && valor('--arquivos')) {
    const r = rodar(ROOT, valor('--alvo'), valor('--arquivos'))
    for (const linha of r.linhas) console.log(linha)
    process.exitCode = r.codigo
  } else {
    console.error(USO)
    process.exitCode = 2
  }
}
