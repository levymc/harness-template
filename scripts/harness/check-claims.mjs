/**
 * Confere se o repositório fala a verdade SOBRE SI MESMO.
 *
 * Por que existe: em todo repositório trabalhado por agentes que serviu de base para este
 * template, o defeito sério mais comum não foi lógica errada — foi afirmação não
 * verificada. Um flag documentado que o script não conhecia (exit 0, nada feito). Um
 * caminho de bootstrap movido por um commit e nunca atualizado no AGENTS.md. Skills sem
 * frontmatter, que nunca disparavam. Um AGENTS.md acima do teto que ele mesmo declarava.
 * Prosa não falha, então decai; isto falha.
 *
 * Cada regra tem um id. `docs/guardrails.md` cita as regras pelo id
 * (`check-claims:<id>`), e a regra `guardrails-sensors` confere que o id existe.
 *
 * O que este script NÃO faz: julgar comportamento. Existência, forma e coerência. O que
 * o código FAZ é trabalho de teste.
 *
 * Uso:
 *   node scripts/harness/check-claims.mjs                 todas as regras
 *   node scripts/harness/check-claims.mjs --list          lista as regras
 *   node scripts/harness/check-claims.mjs --only <id>     uma regra
 *   node scripts/harness/check-claims.mjs --hash-term <t> gera a entrada de forbiddenTerms
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { findForbidden, hashTerm, ignoredByGit, isMain, loadConfig, parseFrontmatter, rel, repoFiles, ROOT, toPosix, walk } from './lib.mjs'
import { lintMemory } from './memory.mjs'

/**
 * Só o que está em backtick ou bloco de código conta como comando — prosa casaria.
 * Devolve os trechos SEPARADOS (bloco, linha a linha): concatenados, uma regex
 * atravessava de um trecho para o outro, e `prove.mjs` + `catch` + `--force"` em três
 * lugares do texto virava "prove.mjs catch --force".
 */
export function codeSpans(text) {
  const blocks = [...text.matchAll(/```[\w-]*\r?\n([\s\S]*?)```/g)].map(m => m[1])
  const inline = [...text.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map(m => m[1])
  return inline.concat(blocks.flatMap(block => block.split(/\r?\n/)))
}

/** Caminho com marcador de modelo (`NNNN`, `YYYY`, `<x>`) é exemplo, não afirmação. */
const isPlaceholder = path => /NNNN|YYYY|XXXX|<|>|\*/.test(path)

const BINARY = /\.(png|jpe?g|gif|ico|webp|pdf|zip|gz|woff2?|ttf|eot|mp4|lockb)$/i

export const RULES = [
  {
    id: 'cited-path',
    descricao: 'caminho citado na prosa do harness existe (ou é gerado/ignorado pelo git)',
    run({ root, prose }) {
      const citados = prose.flatMap(({ nome, texto }) =>
        [...texto.matchAll(/(?<![\w/.-])(?:src|test|scripts|docs|migrations|\.claude|work|\.github)\/[\w./()-]*\.\w{1,5}\b/g)]
          .map(m => ({ nome, caminho: m[0] }))
          .filter(c => !isPlaceholder(c.caminho)))
      const ignorados = ignoredByGit(root, [...new Set(citados.map(c => c.caminho))])
      return citados
        .filter(c => !ignorados.has(c.caminho) && !existsSync(resolve(root, c.caminho)))
        .map(c => `${c.nome} cita ${c.caminho}, que não existe`)
    },
  },
  {
    id: 'pnpm-script',
    descricao: '`pnpm <script>` citado existe no package.json',
    run({ root, prose }) {
      const pkg = resolve(root, 'package.json')
      if (!existsSync(pkg)) return []
      const manifesto = JSON.parse(readFileSync(pkg, 'utf8'))
      // `pnpm <bin>` também roda binário de dependência (`pnpm drizzle-kit generate`): falso
      // positivo visto na primeira adoção num repositório real. Dependência conta como alvo.
      const scripts = new Set([
        ...Object.keys(manifesto.scripts ?? {}),
        ...Object.keys(manifesto.dependencies ?? {}),
        ...Object.keys(manifesto.devDependencies ?? {}),
      ])
      const SUB = new Set(['install', 'add', 'remove', 'exec', 'dlx', 'why', 'up', 'update', 'store', 'list', 'run', 'create', 'outdated', 'audit', 'i'])
      const erros = []
      for (const { nome, texto } of prose) {
        for (const [, alvo] of codeSpans(texto).join('\n').matchAll(/\bpnpm (?:-s |run )?([a-z][\w:-]*)/g)) {
          if (!SUB.has(alvo) && !scripts.has(alvo)) erros.push(`${nome} cita "pnpm ${alvo}", que não está nos scripts do package.json`)
        }
      }
      return erros
    },
  },
  {
    id: 'script-flag',
    descricao: 'flag citado para um script existe no script',
    run({ root, prose }) {
      const erros = []
      for (const { nome, texto } of prose) {
        const citacoes = codeSpans(texto).flatMap(trecho =>
          [...trecho.matchAll(/\b((?:scripts|\.claude\/hooks)\/[\w/-]+\.mjs)[ \t]+(?:[\w<>-]+[ \t]+)?(--[\w-]+)/g)])
        for (const [, script, flag] of citacoes) {
          const alvo = resolve(root, script)
          if (!existsSync(alvo)) erros.push(`${nome} cita ${script}, que não existe`)
          else if (!readFileSync(alvo, 'utf8').includes(`'${flag}'`)) erros.push(`${nome} manda rodar ${script} ${flag}, e o script não conhece esse flag`)
        }
      }
      return erros
    },
  },
  {
    id: 'agents-md-ceiling',
    descricao: 'AGENTS.md dentro do teto de linhas',
    run({ root, config }) {
      const file = resolve(root, 'AGENTS.md')
      if (!existsSync(file)) return ['AGENTS.md não existe — é o ponto de entrada de todo agente']
      const linhas = readFileSync(file, 'utf8').split('\n').length
      const teto = config.ceilings.agentsMdLines
      return linhas > teto
        ? [`AGENTS.md tem ${linhas} linhas (teto ${teto}). Ele entra em contexto em TODA sessão. Remova o que um check já garante, mova a explicação para docs/harness.md, ou transforme a lição em check.`]
        : []
    },
  },
  {
    id: 'pending-markers',
    descricao: 'nenhum marcador `<!-- pendente` sobrou na prosa do harness',
    run({ prose }) {
      return prose
        // menção ao marcador dentro de backtick (como na skill que explica o marcador) não conta
        .filter(({ texto }) => texto.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '').includes('<!-- pendente'))
        .map(({ nome }) => `${nome} ainda tem marcador <!-- pendente --> — complete com o usuário (skill adotar-harness)`)
    },
  },
  {
    id: 'forbidden-terms',
    descricao: 'nenhum termo proibido (guardado por hash) em arquivo do repositório',
    run({ root, config, files }) {
      const erros = []
      for (const file of files) {
        if (BINARY.test(file)) continue
        const full = resolve(root, file)
        if (statSync(full).size > 2_000_000) continue
        const hits = findForbidden(readFileSync(full, 'utf8'), config.forbiddenTerms)
        // o nome do arquivo também conta
        hits.push(...findForbidden(file, config.forbiddenTerms))
        if (hits.length) erros.push(`${file} contém termo proibido (hash ${[...new Set(hits)].join(', ')})`)
      }
      return erros
    },
  },
  {
    id: 'skill-frontmatter',
    descricao: 'toda skill tem frontmatter com name = pasta e description',
    run({ root }) {
      const dir = resolve(root, '.claude/skills')
      return walk(dir, f => f.endsWith('SKILL.md')).flatMap(file => {
        const pasta = toPosix(dirname(file)).split('/').pop()
        const { data } = parseFrontmatter(readFileSync(file, 'utf8'))
        const where = rel(root, file)
        if (!data) return [`${where}: sem frontmatter — a skill nunca dispara`]
        const erros = []
        if (data.name !== pasta) erros.push(`${where}: name "${data.name}" ≠ pasta "${pasta}"`)
        if (!data.description || String(data.description).length < 40) erros.push(`${where}: description ausente ou curta — é ela que decide quando a skill dispara`)
        return erros
      })
    },
  },
  {
    id: 'agent-frontmatter',
    descricao: 'todo subagente tem name, description e `tools:` explícito',
    run({ root }) {
      return walk(resolve(root, '.claude/agents'), f => f.endsWith('.md')).flatMap(file => {
        const { data } = parseFrontmatter(readFileSync(file, 'utf8'))
        const where = rel(root, file)
        const nome = toPosix(file).split('/').pop().replace(/\.md$/, '')
        if (!data) return [`${where}: sem frontmatter`]
        const erros = []
        if (data.name !== nome) erros.push(`${where}: name "${data.name}" ≠ arquivo "${nome}"`)
        if (!data.description) erros.push(`${where}: sem description`)
        if (!data.tools || (Array.isArray(data.tools) && !data.tools.length)) erros.push(`${where}: sem tools: — subagente herdaria TODAS as ferramentas`)
        return erros
      })
    },
  },
  {
    id: 'single-skill-source',
    descricao: 'skills só em .claude/skills — nenhuma cópia por ferramenta',
    run({ files }) {
      return files
        .filter(file => /(^|\/)SKILL\.md$/.test(file) && !file.startsWith('.claude/skills/'))
        .map(file => `${file}: skill fora de .claude/skills. Cópias por ferramenta divergem (já vimos 7 cópias da mesma skill, todas diferentes); aponte para a fonte única.`)
    },
  },
  {
    id: 'settings-hygiene',
    descricao: '.claude/settings.json sem caminho absoluto, com auto-memória desligada e hooks que existem',
    run({ root }) {
      const file = resolve(root, '.claude/settings.json')
      if (!existsSync(file)) return ['.claude/settings.json ausente']
      const texto = readFileSync(file, 'utf8')
      const erros = []
      const settings = JSON.parse(texto)
      if (/[A-Za-z]:\\\\|"\/(Users|home)\//.test(texto)) erros.push('.claude/settings.json tem caminho absoluto de máquina — use $CLAUDE_PROJECT_DIR ou caminho relativo')
      if (settings.autoMemoryEnabled !== false) {
        erros.push('.claude/settings.json precisa de "autoMemoryEnabled": false — a memória do projeto é docs/memory/, versionada; a auto-memória do Claude fica numa pasta local da máquina e vira um segundo sistema que ninguém revisa')
      }
      for (const [, script] of texto.matchAll(/CLAUDE_PROJECT_DIR\}?\/([\w./-]+\.mjs)/g)) {
        if (!existsSync(resolve(root, script))) erros.push(`.claude/settings.json chama ${script}, que não existe`)
      }
      return erros
    },
  },
  {
    id: 'guardrails-sensors',
    descricao: 'toda linha de docs/guardrails.md aponta para um sensor que existe',
    run({ root }) {
      const file = resolve(root, 'docs/guardrails.md')
      if (!existsSync(file)) return []
      const ids = new Set(RULES.map(r => r.id))
      const erros = []
      for (const linha of readFileSync(file, 'utf8').split('\n')) {
        if (!/^\|/.test(linha) || /^\|\s*-/.test(linha) || /^\|\s*Nunca\s*\|/i.test(linha)) continue
        const cols = linha.split('|').map(c => c.trim())
        const sensor = cols[3] ?? ''
        if (/revis[aã]o/i.test(sensor)) continue
        const refs = [...sensor.matchAll(/`([^`]+)`/g)].map(m => m[1])
        if (!refs.length) {
          erros.push(`docs/guardrails.md: "${cols[1]}" sem sensor — nomeie o check/hook/teste, ou escreva "revisão" e assuma o gap`)
          continue
        }
        for (const ref of refs) {
          const [alvo, id] = ref.split(':')
          if (alvo === 'check-claims' && !ids.has(id)) erros.push(`docs/guardrails.md: sensor check-claims:${id} não existe`)
          else if (alvo !== 'check-claims' && !existsSync(resolve(root, alvo))) erros.push(`docs/guardrails.md: sensor ${alvo} não existe`)
        }
      }
      return erros
    },
  },
  {
    id: 'adr-shape',
    descricao: 'ADRs numeradas sem repetição, com status válido e condição de revisão',
    run({ root }) {
      const dir = resolve(root, 'docs/decisions')
      const vistos = new Map()
      const erros = []
      for (const file of walk(dir, f => /\/\d{4}-[\w-]+\.md$/.test(toPosix(f)))) {
        const nome = toPosix(file).split('/').pop()
        const num = nome.slice(0, 4)
        if (num === '0000') continue // o molde
        if (vistos.has(num)) erros.push(`docs/decisions: número ${num} usado por ${vistos.get(num)} e ${nome}`)
        vistos.set(num, nome)
        const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'))
        if (!['accepted', 'superseded', 'declined'].includes(data?.status)) erros.push(`docs/decisions/${nome}: status precisa ser accepted|superseded|declined`)
        if (data?.status === 'superseded' && !data.superseded_by) erros.push(`docs/decisions/${nome}: superseded sem superseded_by`)
        if (!/^## Revisar quando/m.test(body)) erros.push(`docs/decisions/${nome}: falta "## Revisar quando" — decisão sem condição de revisão vira dogma`)
      }
      return erros
    },
  },
  {
    id: 'md-links',
    descricao: 'links relativos em Markdown resolvem',
    run({ root, prose }) {
      const erros = []
      for (const { nome, texto } of prose) {
        const semCodigo = texto.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '')
        for (const [, alvo] of semCodigo.matchAll(/\]\(([^)\s]+)\)/g)) {
          if (/^(https?:|mailto:|#)/.test(alvo) || isPlaceholder(alvo)) continue
          const limpo = decodeURI(alvo.split('#')[0])
          if (!existsSync(resolve(root, dirname(nome), limpo))) erros.push(`${nome}: link quebrado para ${alvo}`)
        }
      }
      return erros
    },
  },
  {
    id: 'no-sync',
    descricao: '`sequelize.sync()` nunca fora de teste — schema só muda por migration',
    run({ root, files }) {
      return files
        .filter(file => /^src\/.*\.ts$/.test(file) && !file.endsWith('.spec.ts'))
        .filter(file => /\.sync\(|synchronize:\s*true/.test(readFileSync(resolve(root, file), 'utf8')))
        .map(file => `${file} usa sync()/synchronize:true — o schema só muda por migration em migrations/ (ver docs/decisions/0002-migrations-sql-versionadas.md)`)
    },
  },
  {
    id: 'env-example',
    descricao: 'toda variável de ambiente lida pelo código está no .env.example',
    run({ root, config }) {
      const exemplo = resolve(root, config.env?.example ?? '.env.example')
      if (!existsSync(exemplo)) return []
      const declaradas = new Set([...readFileSync(exemplo, 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]))
      const lidas = new Map()
      for (const base of config.env?.sources ?? []) {
        for (const file of walk(resolve(root, base), f => /\.(ts|mjs|js)$/.test(f) && !/\.spec\.ts$/.test(f))) {
          for (const [, nome] of readFileSync(file, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) lidas.set(nome, rel(root, file))
        }
      }
      for (const file of config.env?.declarations ?? []) {
        if (!existsSync(resolve(root, file))) continue
        for (const [, nome] of readFileSync(resolve(root, file), 'utf8').matchAll(/^\s+([A-Z][A-Z0-9_]+)[?!]?\s*:/gm)) lidas.set(nome, file)
      }
      return [...lidas].filter(([nome]) => !declaradas.has(nome)).map(([nome, file]) => `${file} lê ${nome}, que não está no ${config.env?.example ?? '.env.example'}`)
    },
  },
  {
    id: 'memory',
    descricao: 'memória: forma, citações vivas, índice gerado em sincronia, tetos',
    run({ root, config }) {
      return lintMemory(root, config)
    },
  },
  {
    id: 'work-tasks',
    descricao: 'tarefas abertas em work/ dentro do teto, cada uma com task.json válido',
    run({ root, config }) {
      const dir = resolve(root, 'work')
      if (!existsSync(dir)) return []
      const pastas = walk(dir, f => f.endsWith('task.json')).map(f => dirname(f))
      const erros = []
      if (pastas.length > config.ceilings.openTasks) {
        erros.push(`work/: ${pastas.length} tarefas abertas (teto ${config.ceilings.openTasks}). Feche (skill fechar-tarefa) antes de abrir outra.`)
      }
      for (const pasta of pastas) {
        const where = rel(root, pasta)
        let task
        try {
          task = JSON.parse(readFileSync(resolve(pasta, 'task.json'), 'utf8'))
        } catch {
          erros.push(`${where}/task.json não é JSON válido`)
          continue
        }
        if (!task.objetivo) erros.push(`${where}/task.json sem objetivo`)
        if (!Array.isArray(task.criterios) || !task.criterios.length) erros.push(`${where}/task.json sem criterios de aceite`)
        else if (task.criterios.some(c => typeof c.passa !== 'boolean' || !c.descricao)) erros.push(`${where}/task.json: todo critério precisa de descricao e passa:boolean`)
        if (!existsSync(resolve(pasta, 'PROGRESS.md'))) erros.push(`${where} sem PROGRESS.md`)
      }
      return erros
    },
  },
]

function proseFiles(root, config) {
  return config.proseRoots
    .flatMap(entry => walk(resolve(root, entry), f => f.endsWith('.md')))
    .map(file => ({ nome: rel(root, file), texto: readFileSync(file, 'utf8') }))
}

export function runChecks(root = ROOT, { only } = {}) {
  const config = loadConfig(root)
  const ctx = { root, config, files: repoFiles(root), prose: proseFiles(root, config) }
  const desligadas = new Set(config.checks?.disabled ?? [])
  const resultado = []
  for (const rule of RULES) {
    if (only && rule.id !== only) continue
    if (desligadas.has(rule.id)) continue
    for (const erro of [...new Set(rule.run(ctx))]) resultado.push({ rule: rule.id, erro })
  }
  return resultado
}

if (isMain(import.meta)) {
  const args = process.argv.slice(2)
  const valor = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  if (args.includes('--list')) {
    for (const r of RULES) console.log(`${r.id.padEnd(20)} ${r.descricao}`)
    process.exit(0)
  }
  if (args.includes('--hash-term')) {
    console.log(JSON.stringify({ ...hashTerm(valor('--hash-term') ?? ''), nota: '<por que este termo não pode aparecer>' }))
    process.exit(0)
  }
  const erros = runChecks(ROOT, { only: valor('--only') })
  if (erros.length) {
    console.error('✗ o repositório afirma coisas sobre si que não são verdade:\n')
    for (const { rule, erro } of erros) console.error(`  [${rule}] ${erro}`)
    process.exit(1)
  }
  console.log(`✓ ${RULES.length} regras conferidas`)
}
