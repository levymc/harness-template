/**
 * Skills de terceiros: copiadas para `.claude/skills/<nome>/`, fixadas por commit SHA e
 * por hash em `skills-lock.json`.
 *
 * Por que cópia fixada e não plugin/marketplace: skill é instrução que o agente executa
 * com as permissões dele. O que ela diz precisa estar no diff do PR, revisável, e não
 * pode mudar debaixo do projeto porque alguém deu push no upstream. Branch e tag mudam;
 * SHA não. O hash pega a edição local silenciosa — quem quiser mudar uma skill de
 * terceiro tira do lock e assume a autoria (ver docs/harness.md, "Skills de terceiros").
 *
 * Achar e revisar candidatas é trabalho da skill buscar-skills; este script só instala o
 * que o usuário aprovou e confere que nada mudou.
 *
 * Uso:
 *   node scripts/harness/skills.mjs add <repo> <caminho-da-skill> --ref <sha> [--nota <texto>]
 *   node scripts/harness/skills.mjs verify
 *   node scripts/harness/skills.mjs outdated
 *   node scripts/harness/skills.mjs remove <nome>
 *   node scripts/harness/skills.mjs list
 * `<repo>` é `dono/nome` (GitHub) ou URL/caminho de um repositório git.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { findForbidden, git, isMain, loadConfig, parseFrontmatter, rel, ROOT, today, walk } from './lib.mjs'

export const LOCK = 'skills-lock.json'
const SKILLS = '.claude/skills'
const SHA = /^[0-9a-f]{40}$/
const BINARY = /\.(png|jpe?g|gif|ico|webp|pdf|zip|gz|woff2?|ttf|eot|mp4)$/i

export const repoUrl = repo => (/^[\w.-]+\/[\w.-]+$/.test(repo) && !existsSync(repo) ? `https://github.com/${repo}.git` : repo)

/**
 * Hash da árvore: caminho + conteúdo, em ordem. Texto vai com fim de linha normalizado —
 * senão o mesmo commit dá hash diferente num checkout Windows com autocrlf.
 */
export function hashDir(dir) {
  const hash = createHash('sha256')
  for (const file of walk(dir).map(f => rel(dir, f)).sort()) {
    const bytes = readFileSync(resolve(dir, file))
    hash.update(`${file}\0`)
    hash.update(BINARY.test(file) ? bytes : bytes.toString('utf8').replace(/\r\n/g, '\n'))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function readLock(root = ROOT) {
  const file = resolve(root, LOCK)
  if (!existsSync(file)) return { skills: {} }
  const lock = JSON.parse(readFileSync(file, 'utf8'))
  return { ...lock, skills: lock.skills ?? {} }
}

function writeLock(root, lock) {
  const skills = Object.fromEntries(Object.entries(lock.skills).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(resolve(root, LOCK), `${JSON.stringify({
    $comentario: 'Gerado por scripts/harness/skills.mjs. Não edite à mão: o check-claims compara o hash de cada pasta.',
    ...lock,
    skills,
  }, null, 2)}\n`)
}

/** Pastas (relativas à raiz) das skills de terceiros. O check-claims não cobra a prosa delas. */
export function lockedDirs(root = ROOT) {
  try {
    return Object.keys(readLock(root).skills).map(nome => `${SKILLS}/${nome}`)
  } catch {
    return [] // lock inválido: a regra third-party-skills acusa; a prosa é cobrada inteira
  }
}

/** Toda entrada do lock tem pasta, e a pasta é exatamente a que foi aprovada. */
export function verifyLock(root = ROOT) {
  let lock
  try {
    lock = readLock(root)
  } catch (error) {
    return [`${LOCK} não é JSON válido: ${error.message}`]
  }
  const erros = []
  for (const [nome, entrada] of Object.entries(lock.skills)) {
    const dir = resolve(root, SKILLS, nome)
    if (!existsSync(resolve(dir, 'SKILL.md'))) {
      erros.push(`${LOCK} lista "${nome}", mas ${SKILLS}/${nome}/SKILL.md não existe — reinstale ou rode \`skills.mjs remove ${nome}\``)
    } else if (hashDir(dir) !== entrada.sha256) {
      erros.push(`${SKILLS}/${nome} difere do que foi aprovado (${entrada.repo}@${String(entrada.ref).slice(0, 7)}). Skill de terceiro não se edita: reinstale, ou remova do lock e assuma a autoria`)
    }
  }
  return erros
}

function licenca(dir, raiz, data) {
  if (data.license) return String(data.license)
  for (const base of [dir, raiz]) {
    const arquivo = readdirSync(base).find(n => /^licen[cs]e/i.test(n))
    if (arquivo) return `${rel(raiz, resolve(base, arquivo))}: ${readFileSync(resolve(base, arquivo), 'utf8').split('\n').find(l => l.trim())?.trim() ?? ''}`
  }
  return 'não encontrada'
}

export function add(root, { repo, path, ref, nota = '' }) {
  if (!repo || !path) throw new Error('uso: skills.mjs add <repo> <caminho-da-skill> --ref <sha>')
  if (!SHA.test(ref ?? '')) throw new Error(`--ref precisa ser um SHA de 40 caracteres (recebido "${ref}"). Branch e tag mudam depois da revisão; SHA não`)
  const config = loadConfig(root)
  const lock = readLock(root)
  const tmp = resolve(root, 'tmp', `skill-${randomBytes(4).toString('hex')}`)
  mkdirSync(tmp, { recursive: true })
  try {
    git(tmp, ['init', '-q'])
    git(tmp, ['-c', 'core.autocrlf=false', 'fetch', '-q', '--depth', '1', repoUrl(repo), ref])
    git(tmp, ['-c', 'core.autocrlf=false', 'checkout', '-q', 'FETCH_HEAD'])
    const origem = resolve(tmp, path)
    if (!existsSync(resolve(origem, 'SKILL.md'))) throw new Error(`${repo}@${ref.slice(0, 7)} não tem ${path}/SKILL.md`)
    const { data } = parseFrontmatter(readFileSync(resolve(origem, 'SKILL.md'), 'utf8'))
    const nome = data?.name
    if (!nome || !/^[\w-]+$/.test(nome)) throw new Error(`${path}/SKILL.md sem "name" válido no frontmatter`)
    if (!data.description || String(data.description).length < 40) throw new Error(`${path}/SKILL.md sem description (ou curta) — a skill nunca dispararia`)
    const destino = resolve(root, SKILLS, nome)
    if (existsSync(destino) && !lock.skills[nome]) throw new Error(`${SKILLS}/${nome} já existe e é do projeto — não sobrescrevo uma skill local`)
    const arquivos = walk(origem).map(f => rel(origem, f))
    const proibidos = arquivos.filter(f => findForbidden(`${f}\n${BINARY.test(f) ? '' : readFileSync(resolve(origem, f), 'utf8')}`, config.forbiddenTerms).length)
    if (proibidos.length) throw new Error(`termo proibido (forbiddenTerms) em: ${proibidos.join(', ')}`)

    rmSync(destino, { recursive: true, force: true })
    cpSync(origem, destino, { recursive: true, filter: f => !/[\\/]\.git([\\/]|$)/.test(f) })
    const fontes = (config.skillSources?.trusted ?? []).map(s => s.repo)
    lock.skills[nome] = {
      repo,
      path,
      ref,
      sha256: hashDir(destino),
      license: licenca(origem, tmp, data),
      trusted: fontes.includes(repo),
      aprovadoEm: today(),
      nota,
    }
    writeLock(root, lock)
    return { nome, arquivos: arquivos.length, ...lock.skills[nome] }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
    try {
      rmdirSync(resolve(root, 'tmp')) // só se ficou vazio
    } catch {}
  }
}

export function remove(root, nome) {
  const lock = readLock(root)
  if (!lock.skills[nome]) throw new Error(`"${nome}" não está no ${LOCK} — skill do projeto não se remove por aqui`)
  rmSync(resolve(root, SKILLS, nome), { recursive: true, force: true })
  delete lock.skills[nome]
  writeLock(root, lock)
}

/** Só informa: atualizar é revisar de novo e rodar `add` com o SHA novo. */
export function outdated(root) {
  return Object.entries(readLock(root).skills).map(([nome, e]) => {
    try {
      const head = git(root, ['ls-remote', repoUrl(e.repo), 'HEAD']).split(/\s/)[0]
      return { nome, ref: e.ref, head, desatualizada: Boolean(head) && head !== e.ref }
    } catch (error) {
      return { nome, ref: e.ref, erro: error.message.split('\n')[0] }
    }
  })
}

export function list(root) {
  const lock = readLock(root).skills
  const dir = resolve(root, SKILLS)
  const locais = existsSync(dir) ? readdirSync(dir).filter(n => existsSync(resolve(dir, n, 'SKILL.md'))) : []
  return locais.sort().map(nome => ({ nome, origem: lock[nome] ? `${lock[nome].repo}@${lock[nome].ref.slice(0, 7)}${lock[nome].trusted ? '' : ' (fora da lista curada)'}` : 'projeto' }))
}

if (isMain(import.meta)) {
  const [cmd, ...args] = process.argv.slice(2)
  const valor = nome => (args.includes(nome) ? args[args.indexOf(nome) + 1] : undefined)
  const posicionais = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
  try {
    if (cmd === 'add') {
      const r = add(ROOT, { repo: posicionais[0], path: posicionais[1], ref: valor('--ref'), nota: valor('--nota') })
      console.log(`✓ ${r.nome} instalada de ${r.repo}@${r.ref.slice(0, 7)} (${r.arquivos} arquivo(s), licença: ${r.license})${r.trusted ? '' : '\n  ⚠ fonte fora de skillSources.trusted — registre no PR quem aprovou'}`)
    } else if (cmd === 'verify') {
      const erros = verifyLock(ROOT)
      if (erros.length) {
        for (const e of erros) console.error(`✗ ${e}`)
        process.exit(1)
      }
      console.log(`✓ ${Object.keys(readLock(ROOT).skills).length} skill(s) de terceiros batem com o ${LOCK}`)
    } else if (cmd === 'outdated') {
      for (const r of outdated(ROOT)) {
        console.log(r.erro ? `? ${r.nome}: ${r.erro}` : `${r.desatualizada ? '↑' : '='} ${r.nome} ${r.ref.slice(0, 7)}${r.desatualizada ? ` → upstream ${r.head.slice(0, 7)} (revise antes de atualizar)` : ''}`)
      }
    } else if (cmd === 'remove') {
      remove(ROOT, posicionais[0])
      console.log(`✓ ${posicionais[0]} removida`)
    } else if (cmd === 'list') {
      for (const s of list(ROOT)) console.log(`${s.nome.padEnd(24)} ${s.origem}`)
    } else {
      console.error('uso: skills.mjs add <repo> <caminho> --ref <sha> [--nota <t>] | verify | outdated | remove <nome> | list')
      process.exit(2)
    }
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exit(1)
  }
}
