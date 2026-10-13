/**
 * A memória do projeto: fatos em `docs/memory/`, um por arquivo, organizados em pastas
 * que espelham os contextos de `docs/contexts/`.
 *
 * Por que existe, e por que é código e não convenção: nos repositórios de onde este
 * template saiu, a memória era um `decisions.md` append-only que chegou a 565 KB e
 * 6.700 linhas, com entradas fora de ordem, duplicadas e com encoding quebrado. "Leia as
 * últimas 3–5 entradas" virou a única forma de usar — ou seja, ninguém usava. E o índice
 * escrito à mão já tinha linha quebrada. Aqui:
 *
 *   - a PASTA de um fato é o contexto dele: `docs/memory/esqueleto/testes/x.md` pertence a
 *     `docs/contexts/esqueleto/testes/`. Não existe campo `context:` no frontmatter — ele
 *     seria uma segunda fonte de verdade fadada a divergir da pasta. Toda pasta de memória
 *     precisa de um `docs/contexts/<mesmo caminho>/index.md`; fato sem contexto mora na
 *     raiz de `docs/memory/`;
 *   - o índice (`MEMORY.md`) é GERADO, agrupado por contexto, e o lint reprova se estiver
 *     fora de sincronia;
 *   - todo fato cita onde no código ele se apoia (`citations:` com `path` + `anchor`), e
 *     o lint reprova citação que não existe mais — a memória não pode mentir;
 *   - `verify` marca como SUSPEITO o fato cujos arquivos citados mudaram no git depois
 *     da data `verified:` — staleness medida por mudança de código, não por calendário
 *     (a ideia é a verificação just-in-time da memória do Copilot, feita aqui de forma
 *     determinística);
 *   - tetos de quantidade e de tamanho obrigam a consolidar em vez de acumular.
 *
 * Uso:
 *   node scripts/harness/memory.mjs index           regrava docs/memory/MEMORY.md
 *   node scripts/harness/memory.mjs lint            erros de forma, contexto, citação e teto (exit 1)
 *   node scripts/harness/memory.mjs verify          lista fatos suspeitos (exit 0)
 *   node scripts/harness/memory.mjs new <slug> --type gotcha [--context esqueleto/testes]
 *   node scripts/harness/memory.mjs touch <slug>    renova `verified:` depois de conferir
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { git, isMain, loadConfig, parseFrontmatter, rel, ROOT, today, walk } from './lib.mjs'

// A ordem é a dos fatos dentro de cada contexto no índice: o contexto do projeto vem
// antes das armadilhas.
export const TYPES = ['project', 'gotcha', 'reference', 'feedback']
const STATUS = ['active', 'superseded']
const TYPE_LABEL = {
  project: 'projeto',
  gotcha: 'armadilha',
  reference: 'referência',
  feedback: 'como trabalhar',
}
const memDir = root => resolve(root, 'docs/memory')
const RESERVED = new Set(['MEMORY.md', 'README.md'])
const contextIndex = (root, context) => resolve(root, 'docs/contexts', context, 'index.md')

export function loadFacts(root = ROOT) {
  const dir = memDir(root)
  if (!existsSync(dir)) return []
  return walk(dir, file => file.endsWith('.md'))
    .map(full => rel(dir, full))
    .filter(file => !RESERVED.has(file))
    .sort()
    .map(file => {
      const text = readFileSync(resolve(dir, file), 'utf8')
      const { data, body } = parseFrontmatter(text)
      // Compatível com o formato da auto-memória do Claude Code, que aninha o tipo em
      // `metadata.type` — é o formato que um projeto adotado provavelmente já tem.
      if (data && !data.type && data.metadata?.type) data.type = data.metadata.type
      const context = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
      return { file, slug: file.split('/').pop().replace(/\.md$/, ''), context, text, data, body }
    })
}

const ordemTipo = f => (TYPES.includes(f.data?.type) ? TYPES.indexOf(f.data.type) : TYPES.length)

export function renderIndex(facts) {
  const ativos = facts.filter(f => f.data?.status !== 'superseded')
  const substituidos = facts.filter(f => f.data?.status === 'superseded')
  const out = [
    '# Memória do projeto — índice',
    '',
    '<!-- GERADO por `node scripts/harness/memory.mjs index`. Não edite à mão: o lint compara. -->',
    '',
    'Agrupado pelos contextos de `docs/contexts/`. Antes de agir com base num fato, confira',
    'as citações dele (`memory.mjs verify`).',
    '',
  ]
  // raiz (projeto inteiro) primeiro; depois os contextos em ordem alfabética, pai antes de filho
  const contextos = [...new Set(ativos.map(f => f.context))].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  for (const context of contextos) {
    if (context === '') out.push('## Projeto inteiro', '')
    else out.push(`## ${context}`, '', `Contexto: [docs/contexts/${context}](../contexts/${context}/index.md)`, '')
    const grupo = ativos.filter(f => f.context === context).sort((a, b) => ordemTipo(a) - ordemTipo(b) || a.slug.localeCompare(b.slug))
    for (const f of grupo) out.push(`- [${f.data.name}](${f.file}) · ${TYPE_LABEL[f.data.type] ?? f.data.type} — ${f.data.description}`)
    out.push('')
  }
  if (substituidos.length) {
    out.push('## Substituídos (não use; ficam pelo histórico)', '')
    for (const f of substituidos) out.push(`- ${f.file.replace(/\.md$/, '')} → ${f.data.superseded_by ?? '?'}`)
    out.push('')
  }
  return out.join('\n')
}

export function writeIndex(root = ROOT) {
  writeFileSync(resolve(memDir(root), 'MEMORY.md'), renderIndex(loadFacts(root)))
}

/** Erros que fazem a memória mentir, se desligar do seu contexto ou crescer sem controle. */
export function lintMemory(root = ROOT, config = loadConfig(root)) {
  const erros = []
  const facts = loadFacts(root)
  const { activeFacts, factLines } = config.ceilings

  const porSlug = new Map()
  for (const f of facts) porSlug.set(f.slug, [...(porSlug.get(f.slug) ?? []), f.file])
  for (const [slug, arquivos] of porSlug) {
    if (arquivos.length > 1) erros.push(`docs/memory: o slug "${slug}" existe em ${arquivos.join(' e ')} — [[${slug}]] ficaria ambíguo; slug é único na árvore toda`)
  }

  for (const f of facts) {
    const where = `docs/memory/${f.file}`
    if (f.context && !existsSync(contextIndex(root, f.context))) {
      erros.push(`${where}: a pasta "${f.context}" não corresponde a nenhum contexto — crie docs/contexts/${f.context}/index.md ou mova o fato para um contexto existente (ou para a raiz, se não tiver contexto)`)
    }
    const d = f.data
    if (!d) {
      erros.push(`${where}: sem frontmatter`)
      continue
    }
    if (d.name !== f.slug) erros.push(`${where}: name "${d.name}" ≠ nome do arquivo "${f.slug}"`)
    if (d.context !== undefined) erros.push(`${where}: não use "context:" no frontmatter — o contexto é a pasta onde o fato está`)
    if (!d.description || String(d.description).length < 20) erros.push(`${where}: description ausente ou curta demais para decidir relevância`)
    if (!TYPES.includes(d.type)) erros.push(`${where}: type "${d.type}" inválido (use ${TYPES.join('|')})`)
    if (!STATUS.includes(d.status)) erros.push(`${where}: status "${d.status}" inválido (use ${STATUS.join('|')})`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.verified ?? '')) erros.push(`${where}: verified precisa ser YYYY-MM-DD`)
    if (d.status === 'superseded' && !d.superseded_by) erros.push(`${where}: superseded sem superseded_by (aponte o fato, ADR ou guarda que o substituiu)`)

    if (d.status === 'active') {
      const linhas = f.text.split('\n').length
      if (linhas > factLines) erros.push(`${where}: ${linhas} linhas (teto ${factLines}). Um fato por arquivo; o resto é doc.`)
      if (!/\*\*Por qu[eê]:\*\*/.test(f.body)) erros.push(`${where}: falta a linha **Por quê:** — fato sem motivo não sabe quando deixou de valer`)
      if (!/\*\*Como aplicar:\*\*/.test(f.body)) erros.push(`${where}: falta a linha **Como aplicar:**`)
      // feedback é sobre como trabalhar, não sobre código: citação é opcional nele
      const cits = Array.isArray(d.citations) ? d.citations : []
      if (d.type !== 'feedback' && !cits.length) erros.push(`${where}: sem citations — fato sobre o código precisa dizer onde no código ele se apoia`)
      for (const c of cits) {
        if (!c?.path) {
          erros.push(`${where}: citação sem path`)
          continue
        }
        const alvo = resolve(root, c.path)
        if (!existsSync(alvo)) {
          erros.push(`${where}: cita ${c.path}, que não existe mais — atualize o fato ou marque superseded`)
        } else if (c.anchor && !readFileSync(alvo, 'utf8').includes(c.anchor)) {
          erros.push(`${where}: o trecho citado não aparece mais em ${c.path} (${JSON.stringify(c.anchor)}) — o código mudou; o fato ainda vale?`)
        }
      }
    }
    for (const [, link] of f.body.matchAll(/\[\[([\w-]+)\]\]/g)) {
      if (!porSlug.has(link)) erros.push(`${where}: [[${link}]] não é nenhum fato`)
    }
  }

  const ativos = facts.filter(f => f.data?.status === 'active').length
  if (ativos > activeFacts) {
    erros.push(`docs/memory: ${ativos} fatos ativos (teto ${activeFacts}). Consolide (skill memoria) ou promova a guarda (skill licao).`)
  }

  const indice = resolve(memDir(root), 'MEMORY.md')
  const esperado = renderIndex(facts)
  if (!existsSync(indice) || readFileSync(indice, 'utf8').replace(/\r\n/g, '\n') !== esperado) {
    erros.push('docs/memory/MEMORY.md fora de sincronia — rode `pnpm memory index`')
  }
  return erros
}

/** Fatos cujos arquivos citados mudaram depois de `verified`. Aviso, não erro. */
export function suspects(root = ROOT) {
  const out = []
  for (const f of loadFacts(root)) {
    if (f.data?.status !== 'active') continue
    for (const c of Array.isArray(f.data.citations) ? f.data.citations : []) {
      if (!c?.path || !existsSync(resolve(root, c.path))) continue
      let quando = ''
      try {
        const status = git(root, ['status', '--porcelain', '--', c.path])
        // `??` = arquivo novo, sem histórico: não pode ter mudado DEPOIS da verificação.
        // Sem esta exceção, todo fato de um repositório recém-criado nasce suspeito.
        if (status && !status.startsWith('??')) quando = 'alterado e não commitado'
        else {
          const data = git(root, ['log', '-1', '--format=%cs', '--', c.path])
          if (data && data > f.data.verified) quando = `commit em ${data}`
        }
      } catch {
        continue // sem git: não há como saber, e não inventamos
      }
      if (quando) out.push({ slug: f.slug, path: c.path, quando, verified: f.data.verified })
    }
  }
  return out
}

function findFact(root, slug) {
  const fact = loadFacts(root).find(f => f.slug === slug)
  if (!fact) throw new Error(`${slug} não existe`)
  return resolve(memDir(root), fact.file)
}

function newFact(root, slug, type, context = '') {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug ?? '')) throw new Error('slug em kebab-case: memory.mjs new <slug> --type <tipo> [--context <caminho>]')
  if (!TYPES.includes(type)) throw new Error(`--type precisa ser ${TYPES.join('|')}`)
  const ctx = context.replace(/^\/+|\/+$/g, '')
  if (ctx && !existsSync(contextIndex(root, ctx))) throw new Error(`contexto "${ctx}" não existe — crie docs/contexts/${ctx}/index.md antes, ou omita --context`)
  if (loadFacts(root).some(f => f.slug === slug)) throw new Error(`${slug} já existe — atualize em vez de duplicar`)
  const file = resolve(memDir(root), ctx, `${slug}.md`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `---
name: ${slug}
description: <uma linha que permita decidir relevância sem abrir o arquivo>
type: ${type}
status: active
verified: ${today()}
citations:
  - path: <caminho/do/arquivo>
    anchor: '<trecho literal que precisa continuar existindo>'
---

<o fato, em 1–5 linhas>

**Por quê:** <o incidente ou a razão>

**Como aplicar:** <o que fazer diferente por causa disto>
`)
  return file
}

function touch(root, slug) {
  const file = findFact(root, slug)
  const text = readFileSync(file, 'utf8')
  writeFileSync(file, text.replace(/^verified:.*$/m, `verified: ${today()}`))
}

// ── CLI ──────────────────────────────────────────────────────────────────────────
if (isMain(import.meta)) {
  const [cmd, arg] = process.argv.slice(2)
  const flag = name => {
    const i = process.argv.indexOf(name)
    return i > -1 ? process.argv[i + 1] : undefined
  }
  try {
    if (cmd === 'index') {
      writeIndex()
      console.log('✓ docs/memory/MEMORY.md regravado')
    } else if (cmd === 'lint') {
      const erros = lintMemory()
      if (erros.length) {
        console.error('✗ memória:\n' + erros.map(e => `  - ${e}`).join('\n'))
        process.exit(1)
      }
      console.log(`✓ memória: ${loadFacts().length} fatos conferidos`)
    } else if (cmd === 'verify') {
      const s = suspects()
      if (!s.length) console.log('✓ nenhum fato suspeito')
      for (const x of s) console.log(`? ${x.slug}: ${x.path} (${x.quando}; verificado em ${x.verified}) — releia, corrija ou rode \`memory.mjs touch ${x.slug}\``)
    } else if (cmd === 'new') {
      console.log(`✓ criado ${newFact(ROOT, arg, flag('--type'), flag('--context'))} — preencha, depois \`memory.mjs index\``)
    } else if (cmd === 'touch') {
      touch(ROOT, arg)
      console.log(`✓ ${arg}: verified = ${today()}`)
    } else {
      console.error('uso: memory.mjs index|lint|verify|new <slug> --type <tipo> [--context <caminho>]|touch <slug>')
      process.exit(1)
    }
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exit(1)
  }
}
