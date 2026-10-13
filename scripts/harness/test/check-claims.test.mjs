/**
 * Cada regra do check-claims vista FALHAR com a regressão que ela existe para pegar, e
 * vista PASSAR no caso vizinho legítimo. A fixture base passa em todas.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { RULES, runChecks } from '../check-claims.mjs'
import { cleanup, makeRepo, read, reindex, TERMO, write } from './fixture.mjs'

const repos = []
function repo(extra) {
  const root = makeRepo(extra)
  repos.push(root)
  return root
}
after(() => repos.forEach(cleanup))

const erros = (root, only) => runChecks(root, { only }).map(e => e.erro)

describe('fixture base', () => {
  it('passa em todas as regras — senão os testes abaixo não provam nada', () => {
    assert.deepEqual(runChecks(repo()), [])
  })
})

describe('cited-path', () => {
  it('pega caminho citado que não existe', () => {
    assert.match(erros(repo({ 'docs/x.md': 'veja `src/sumiu.ts`' }), 'cited-path')[0], /src\/sumiu\.ts/)
  })
  it('aceita caminho gerado, que o git ignora', () => {
    assert.deepEqual(erros(repo({ 'docs/x.md': 'gerado em `src/gerado.ts`', '.gitignore': 'src/gerado.ts\n' }), 'cited-path'), [])
  })
  it('aceita caminho com marcador de modelo', () => {
    assert.deepEqual(erros(repo({ 'docs/x.md': 'crie `docs/decisions/NNNN-slug.md`' }), 'cited-path'), [])
  })
})

describe('pnpm-script', () => {
  it('pega script citado que não existe', () => {
    assert.match(erros(repo({ 'docs/x.md': 'rode `pnpm deploy:tudo`' }), 'pnpm-script')[0], /deploy:tudo/)
  })
  it('pega script citado dentro de bloco de código', () => {
    assert.match(erros(repo({ 'docs/x.md': 'passos:\n\n```bash\npnpm install\npnpm sumiu\n```\n' }), 'pnpm-script')[0], /sumiu/)
  })
  it('aceita `pnpm <bin>` de dependência instalada', () => {
    const pkg = JSON.stringify({ name: 'fx', scripts: { test: 'x' }, devDependencies: { 'drizzle-kit': '1.0.0' } })
    assert.deepEqual(erros(repo({ 'package.json': pkg, 'docs/x.md': 'rode `pnpm drizzle-kit generate`' }), 'pnpm-script'), [])
  })
  it('ignora prosa fora de backtick e subcomandos do pnpm', () => {
    assert.deepEqual(erros(repo({ 'docs/x.md': 'se o pnpm reclamar, rode `pnpm install` e `pnpm test`' }), 'pnpm-script'), [])
  })
})

describe('script-flag', () => {
  it('pega flag que o script não conhece', () => {
    assert.match(erros(repo({ 'docs/x.md': 'rode `node scripts/tool.mjs --nao`' }), 'script-flag')[0], /--nao/)
  })
  it('aceita flag que o script conhece', () => {
    assert.deepEqual(erros(repo({ 'docs/x.md': 'rode `node scripts/tool.mjs --sim`' }), 'script-flag'), [])
  })
  it('não junta trechos de código diferentes numa citação só', () => {
    // falso positivo real: `prove.mjs` … `catch` … `--force"` em três lugares do texto
    const texto = 'use `scripts/tool.mjs` com cuidado; o `catch` nunca roda; e o `--force` é outro assunto'
    assert.deepEqual(erros(repo({ 'docs/x.md': texto }), 'script-flag'), [])
  })
})

describe('agents-md-ceiling', () => {
  it('pega AGENTS.md acima do teto', () => {
    assert.match(erros(repo({ 'AGENTS.md': 'linha\n'.repeat(25) }), 'agents-md-ceiling')[0], /teto 20/)
  })
})

describe('pending-markers', () => {
  it('pega marcador pendente esquecido', () => {
    assert.equal(erros(repo({ 'AGENTS.md': '# A\n<!-- pendente: comandos -->\n' }), 'pending-markers').length, 1)
  })
  it('ignora o marcador citado dentro de backtick', () => {
    assert.deepEqual(erros(repo({ 'docs/x.md': 'substitua cada `<!-- pendente: … -->`' }), 'pending-markers'), [])
  })
})

describe('forbidden-terms', () => {
  it('pega o termo mesmo com caixa e pontuação no meio', () => {
    assert.equal(erros(repo({ 'src/b.ts': `// ${TERMO.slice(0, 4).toUpperCase()}-${TERMO.slice(4)}\n` }), 'forbidden-terms').length, 1)
  })
  it('pega o termo no nome do arquivo', () => {
    assert.equal(erros(repo({ [`docs/${TERMO}.txt`]: 'nada\n' }), 'forbidden-terms').length, 1)
  })
  it('não acusa texto parecido', () => {
    assert.deepEqual(erros(repo({ 'src/b.ts': `// ${TERMO.slice(0, -1)}\n` }), 'forbidden-terms'), [])
  })
})

describe('skill-frontmatter', () => {
  it('pega skill sem frontmatter (nunca dispara)', () => {
    assert.match(erros(repo({ '.claude/skills/x/SKILL.md': '# sem frontmatter\n' }), 'skill-frontmatter')[0], /sem frontmatter/)
  })
  it('pega name diferente da pasta', () => {
    assert.match(erros(repo({ '.claude/skills/x/SKILL.md': '---\nname: y\ndescription: uma descrição longa o suficiente para valer aqui\n---\n' }), 'skill-frontmatter')[0], /≠ pasta/)
  })
})

describe('agent-frontmatter', () => {
  it('pega subagente sem tools (herdaria todas)', () => {
    assert.match(erros(repo({ '.claude/agents/x.md': '---\nname: x\ndescription: d\n---\n' }), 'agent-frontmatter')[0], /sem tools/)
  })
})

describe('single-skill-source', () => {
  it('pega cópia de skill em pasta de outra ferramenta', () => {
    assert.equal(erros(repo({ '.cursor/skills/ok/SKILL.md': 'cópia' }), 'single-skill-source').length, 1)
  })
})

describe('settings-hygiene', () => {
  const settings = obj => ({ '.claude/settings.json': JSON.stringify(obj) })
  it('pega auto-memória ligada (segunda memória fora do repo)', () => {
    assert.match(erros(repo(settings({})), 'settings-hygiene').join(), /autoMemoryEnabled/)
  })
  it('pega caminho absoluto de máquina', () => {
    assert.match(erros(repo(settings({ autoMemoryEnabled: false, x: 'C:\\Users\\alguem\\x' })), 'settings-hygiene').join(), /absoluto/)
  })
  it('pega hook que aponta para script inexistente', () => {
    const s = settings({ autoMemoryEnabled: false, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/sumiu.mjs"' }] }] } })
    assert.match(erros(repo(s), 'settings-hygiene').join(), /sumiu\.mjs/)
  })
})

describe('guardrails-sensors', () => {
  const linha = sensor => ({ 'docs/guardrails.md': `| Nunca | Por quê | Sensor | Origem | Expira |\n|---|---|---|---|---|\n| x | y | ${sensor} | z | w |\n` })
  it('pega sensor que aponta para regra inexistente', () => {
    assert.match(erros(repo(linha('`check-claims:inventada`')), 'guardrails-sensors')[0], /inventada/)
  })
  it('pega proibição sem sensor nenhum', () => {
    assert.match(erros(repo(linha('—')), 'guardrails-sensors')[0], /sem sensor/)
  })
  it('aceita "revisão" como gap declarado e arquivo que existe como sensor', () => {
    assert.deepEqual(erros(repo(linha('revisão')), 'guardrails-sensors'), [])
    assert.deepEqual(erros(repo(linha('`src/a.ts`')), 'guardrails-sensors'), [])
  })
})

describe('adr-shape', () => {
  it('pega número de ADR repetido', () => {
    const adr = '---\nstatus: accepted\n---\n\n## Revisar quando\n\nx\n'
    assert.match(erros(repo({ 'docs/decisions/0001-outra.md': adr }), 'adr-shape').join(), /0001 usado/)
  })
  it('pega ADR sem condição de revisão', () => {
    assert.match(erros(repo({ 'docs/decisions/0002-x.md': '---\nstatus: accepted\n---\n\n# x\n' }), 'adr-shape').join(), /Revisar quando/)
  })
})

describe('md-links', () => {
  it('pega link relativo quebrado', () => {
    assert.match(erros(repo({ 'docs/x.md': '[ver](../sumiu.md)' }), 'md-links')[0], /sumiu/)
  })
  it('ignora link externo, âncora e link dentro de código', () => {
    assert.deepEqual(erros(repo({ 'docs/x.md': '[a](https://x.dev) [b](#topo) `[c](sumiu.md)`\n[d](../AGENTS.md)' }), 'md-links'), [])
  })
})

describe('no-sync', () => {
  it('pega sync() em código de produção', () => {
    assert.equal(erros(repo({ 'src/db.ts': 'await sequelize.sync()\n' }), 'no-sync').length, 1)
  })
  it('aceita sync() em teste', () => {
    assert.deepEqual(erros(repo({ 'src/db.spec.ts': 'await sequelize.sync()\n' }), 'no-sync'), [])
  })
})

describe('env-example', () => {
  it('pega variável lida e não documentada', () => {
    assert.match(erros(repo({ 'src/b.ts': 'process.env.SEGREDO_NOVO\n' }), 'env-example')[0], /SEGREDO_NOVO/)
  })
})

describe('memory', () => {
  const fato = (extra = '') => `---\nname: f2\ndescription: um segundo fato para os testes de memória\ntype: gotcha\nstatus: active\nverified: 2000-01-01\ncitations:\n  - path: src/a.ts\n    anchor: 'âncora-viva'\n---\n\nX.\n\n**Por quê:** y.\n\n**Como aplicar:** z.\n${extra}`
  it('pega citação cujo trecho sumiu do código', () => {
    const root = repo()
    write(root, 'src/a.ts', 'export const a = 1\n')
    assert.match(erros(root, 'memory').join(), /trecho citado não aparece/)
  })
  it('pega índice fora de sincronia', () => {
    const root = repo()
    write(root, 'docs/memory/f2.md', fato())
    assert.match(erros(root, 'memory').join(), /fora de sincronia/)
    reindex(root)
    assert.deepEqual(erros(root, 'memory'), [])
  })
  it('pega fato sem **Por quê:** e link para fato inexistente', () => {
    const root = repo()
    write(root, 'docs/memory/f2.md', fato('[[fantasma]]').replace('**Por quê:** y.', ''))
    reindex(root)
    const e = erros(root, 'memory').join()
    assert.match(e, /Por quê/)
    assert.match(e, /fantasma/)
  })
  it('pega teto de fatos ativos', () => {
    const root = repo()
    for (let i = 0; i < 5; i++) write(root, `docs/memory/f${i}x.md`, fato().replace('name: f2', `name: f${i}x`))
    reindex(root)
    assert.match(erros(root, 'memory').join(), /6 fatos ativos \(teto 5\)/)
  })
  it('pega fato numa pasta que não corresponde a nenhum contexto', () => {
    const root = repo()
    write(root, 'docs/memory/inventado/f2.md', fato())
    reindex(root)
    assert.match(erros(root, 'memory').join(), /pasta "inventado" não corresponde a nenhum contexto/)
  })
  it('aceita fato na pasta de um contexto existente, inclusive subcontexto', () => {
    const root = repo({ 'docs/contexts/api/index.md': '# API\n', 'docs/contexts/api/auth/index.md': '# Auth\n' })
    write(root, 'docs/memory/api/auth/f2.md', fato())
    reindex(root)
    assert.deepEqual(erros(root, 'memory'), [])
    assert.match(read(root, 'docs/memory/MEMORY.md'), /## api\/auth\n\nContexto: \[docs\/contexts\/api\/auth\]\(\.\.\/contexts\/api\/auth\/index\.md\)\n\n- \[f2\]\(api\/auth\/f2\.md\)/)
  })
  it('pega slug repetido em contextos diferentes ([[slug]] ficaria ambíguo)', () => {
    const root = repo({ 'docs/contexts/api/index.md': '# API\n' })
    write(root, 'docs/memory/api/fato-ok.md', read(root, 'docs/memory/fato-ok.md'))
    reindex(root)
    assert.match(erros(root, 'memory').join(), /slug "fato-ok" existe em/)
  })
  it('pega campo context: no frontmatter (a pasta é o contexto)', () => {
    const root = repo()
    write(root, 'docs/memory/f2.md', fato().replace('type: gotcha\n', 'type: gotcha\ncontext: api\n'))
    reindex(root)
    assert.match(erros(root, 'memory').join(), /não use "context:"/)
  })
  it('aceita o tipo no formato da auto-memória (metadata.type)', () => {
    const root = repo()
    write(root, 'docs/memory/f2.md', fato().replace('type: gotcha\n', 'metadata:\n  type: gotcha\n'))
    reindex(root)
    assert.deepEqual(erros(root, 'memory'), [])
  })
  it('pega superseded sem dizer o que substituiu', () => {
    const root = repo()
    write(root, 'docs/memory/f2.md', fato().replace('status: active', 'status: superseded'))
    reindex(root)
    assert.match(erros(root, 'memory').join(), /superseded_by/)
  })
})

describe('work-tasks', () => {
  const task = JSON.stringify({ objetivo: 'o', criterios: [{ descricao: 'd', passa: false }] })
  it('aceita tarefa bem formada', () => {
    assert.deepEqual(erros(repo({ 'work/2026-01-01-a/task.json': task, 'work/2026-01-01-a/PROGRESS.md': 'x' }), 'work-tasks'), [])
  })
  it('pega critério sem passa:boolean e tarefa sem PROGRESS', () => {
    const e = erros(repo({ 'work/a/task.json': JSON.stringify({ objetivo: 'o', criterios: [{ descricao: 'd' }] }) }), 'work-tasks').join()
    assert.match(e, /passa:boolean/)
    assert.match(e, /sem PROGRESS/)
  })
  it('pega teto de tarefas abertas', () => {
    const extra = {}
    for (const n of ['a', 'b', 'c']) Object.assign(extra, { [`work/${n}/task.json`]: task, [`work/${n}/PROGRESS.md`]: 'x' })
    assert.match(erros(repo(extra), 'work-tasks')[0], /3 tarefas abertas \(teto 2\)/)
  })
})

describe('registro de regras', () => {
  it('toda regra tem teste neste arquivo', () => {
    const fonte = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    const semTeste = RULES.map(r => r.id).filter(id => !fonte.includes(`describe('${id}'`))
    assert.deepEqual(semTeste, [], 'regra sem teste é regra nunca vista falhar')
  })
})
