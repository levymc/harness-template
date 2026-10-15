/**
 * Peças compartilhadas pelos scripts do harness e pelos hooks.
 *
 * Node puro, sem dependência: o harness precisa rodar num repo recém-clonado, antes do
 * `pnpm install`, e no Windows sem Git Bash. Qualquer import de node_modules aqui quebra
 * a adoção em projeto que não é Node.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Raiz do repositório. `HARNESS_ROOT` existe só para os testes apontarem uma fixture. */
export const ROOT = process.env.HARNESS_ROOT
  ? resolve(process.env.HARNESS_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const toPosix = path => path.split(sep).join('/')
export const rel = (root, file) => toPosix(relative(root, file))

export function loadConfig(root = ROOT) {
  const file = resolve(root, 'harness.config.json')
  if (!existsSync(file)) throw new Error(`harness.config.json ausente em ${root}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Lista arquivos recursivamente, pulando o que nunca é fonte. */
export function walk(dir, filter = () => true, files = []) {
  if (!existsSync(dir)) return files
  if (statSync(dir).isFile()) return filter(dir) ? [dir] : []
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'coverage', '.harness'].includes(entry)) continue
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) walk(full, filter, files)
    else if (filter(full)) files.push(full)
  }
  return files
}

export function git(root, args, input) {
  return execFileSync('git', args, {
    cwd: root, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'ignore'],
  }).trim()
}

/** Arquivos versionados + novos não ignorados. É "o repositório" para os checks. */
export function repoFiles(root) {
  try {
    const out = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    return [...new Set(out.split('\0').filter(Boolean))].filter(file => existsSync(resolve(root, file)))
  } catch {
    return walk(root).map(file => rel(root, file))
  }
}

/** Quais destes caminhos o git ignora. Perguntar ao git é a única fonte honesta. */
export function ignoredByGit(root, paths) {
  if (!paths.length) return new Set()
  try {
    return new Set(git(root, ['check-ignore', '--stdin'], paths.join('\n')).split('\n').map(line => toPosix(line.trim())).filter(Boolean))
  } catch {
    return new Set() // exit 1 = nenhum ignorado
  }
}

// ── frontmatter ──────────────────────────────────────────────────────────────────
/**
 * Parser de um subconjunto de YAML: escalar, lista de escalares e lista de mapas planos.
 * É o que memória, skills, agentes e ADRs usam. Um parser completo seria dependência;
 * um parser maior que isto seria sinal de frontmatter complicado demais.
 */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return { data: null, body: text }
  const data = {}
  let key = null
  let item = null
  let bloco = null // escalar de bloco (`|`, `>-`...): comum em skills de terceiros
  for (const raw of match[1].split(/\r?\n/)) {
    if (bloco && (!raw.trim() || /^\s/.test(raw))) {
      bloco.linhas.push(raw.trim())
      data[bloco.key] = bloco.linhas.join(bloco.sep).trim()
      continue
    }
    bloco = null
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    const top = /^([\w-]+):\s*(.*)$/.exec(raw)
    if (top) {
      key = top[1]
      item = null
      if (/^[|>][-+]?$/.test(top[2].trim())) {
        bloco = { key, linhas: [], sep: top[2].trim().startsWith('|') ? '\n' : ' ' }
        data[key] = ''
        continue
      }
      data[key] = top[2] === '' ? [] : scalar(top[2])
      continue
    }
    const listItem = /^\s+-\s+(.*)$/.exec(raw)
    if (listItem && key) {
      const pair = /^([\w-]+):\s*(.*)$/.exec(listItem[1])
      if (!Array.isArray(data[key])) data[key] = []
      if (pair) {
        item = { [pair[1]]: scalar(pair[2]) }
        data[key].push(item)
      } else {
        item = null
        data[key].push(scalar(listItem[1]))
      }
      continue
    }
    const cont = /^\s+([\w-]+):\s*(.*)$/.exec(raw)
    if (cont && item) item[cont[1]] = scalar(cont[2])
    else if (cont && key && !Array.isArray(data[key])) {
      // mapa aninhado simples (ex.: metadata:) — guardado como objeto
      if (typeof data[key] !== 'object' || data[key] === null) data[key] = {}
      data[key][cont[1]] = scalar(cont[2])
    } else if (cont && key && Array.isArray(data[key]) && data[key].length === 0) {
      data[key] = { [cont[1]]: scalar(cont[2]) }
    }
  }
  return { data, body: text.slice(match[0].length) }
}

function scalar(value) {
  const v = value.trim()
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'")
  if (/^".*"$/.test(v)) return v.slice(1, -1).replace(/\\"/g, '"')
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

// ── termos proibidos ─────────────────────────────────────────────────────────────
/**
 * Os termos são guardados como sha256 + comprimento, nunca em claro: um check que
 * precisasse escrever a palavra para procurá-la violaria a própria regra.
 * O texto é normalizado (minúsculas, só [a-z0-9]) para pegar "Foo-Bar", "foo_bar", "@foobar/x".
 */
export function findForbidden(text, terms) {
  if (!terms?.length) return []
  const norm = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  const hits = new Set()
  for (const { sha256, length } of terms) {
    for (let i = 0; i + length <= norm.length; i++) {
      if (createHash('sha256').update(norm.slice(i, i + length)).digest('hex') === sha256) {
        hits.add(sha256.slice(0, 8))
        break
      }
    }
  }
  return [...hits]
}

export const hashTerm = term => ({
  sha256: createHash('sha256').update(term.toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex'),
  length: term.toLowerCase().replace(/[^a-z0-9]/g, '').length,
})

export const today = () => new Date().toISOString().slice(0, 10)

/**
 * true quando o módulo foi executado direto (e não importado por um teste).
 * Compara em minúsculas: no Windows a letra do drive chega ora `c:`, ora `C:`, e uma
 * comparação exata faria o CLI simplesmente não rodar — em silêncio, com exit 0.
 */
export function isMain(meta) {
  if (!process.argv[1]) return false
  const norm = path => toPosix(resolve(path)).toLowerCase()
  return norm(fileURLToPath(meta.url)) === norm(process.argv[1])
}
