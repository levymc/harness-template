/**
 * Um repositório mínimo que passa em TODAS as regras — o ponto de partida de cada teste.
 *
 * Cada teste parte daqui, introduz UMA regressão e confere que a regra certa reclama; e
 * confere também o caso vizinho legítimo que a regra NÃO pode acusar. Os dois sentidos:
 * um detector que só é testado no "tem de pegar" deriva para bloquear tudo.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashTerm } from '../lib.mjs'
import { renderIndex, loadFacts } from '../memory.mjs'

export const TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
/** Termo proibido só dos testes — o mecanismo é o mesmo dos termos reais. */
export const TERMO = 'proibidao'

const BASE = {
  'harness.config.json': JSON.stringify({
    ceilings: { agentsMdLines: 20, activeFacts: 5, factLines: 40, openTasks: 2 },
    protectedBranches: ['main'],
    forbiddenTerms: [{ ...hashTerm(TERMO), nota: 'teste' }],
    proseRoots: ['AGENTS.md', 'docs', '.claude'],
    env: { example: '.env.example', sources: ['src'], declarations: [] },
    safeRmTargets: ['node_modules', 'dist'],
    checks: { disabled: [] },
  }, null, 2),
  'AGENTS.md': '# Agentes\n\nRode `pnpm test`. Veja `src/a.ts`.\n',
  'package.json': JSON.stringify({ name: 'fx', scripts: { test: 'echo ok', 'harness:check': 'node x' } }),
  '.env.example': 'FOO=1\n',
  'src/a.ts': 'export const a = process.env.FOO // âncora-viva\n',
  'scripts/harness/memory.mjs': '// o índice gerado cita este script\n',
  'scripts/tool.mjs': "if (process.argv.includes('--sim')) console.log('sim')\n",
  '.claude/settings.json': JSON.stringify({
    autoMemoryEnabled: false,
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/h.mjs"' }] }] },
  }, null, 2),
  '.claude/hooks/h.mjs': '',
  '.claude/skills/ok/SKILL.md': '---\nname: ok\ndescription: Uma skill válida com descrição longa o bastante para disparar.\n---\n\nCorpo.\n',
  '.claude/agents/ok.md': '---\nname: ok\ndescription: agente válido\ntools: Read, Grep\n---\n\nCorpo.\n',
  'docs/guardrails.md': '| Nunca | Por quê | Sensor | Origem | Expira quando |\n|---|---|---|---|---|\n| sync | schema | `check-claims:no-sync` | x | nunca |\n| julgar | x | revisão | x | nunca |\n',
  'docs/decisions/0001-uma.md': '---\nstatus: accepted\n---\n\n# 0001\n\n## Revisar quando\n\nnunca\n',
  'docs/memory/fato-ok.md': `---
name: fato-ok
description: um fato válido usado como base de todos os testes
type: gotcha
status: active
verified: 2000-01-01
citations:
  - path: src/a.ts
    anchor: 'âncora-viva'
---

Fato.

**Por quê:** porque sim.

**Como aplicar:** assim.
`,
}

export function makeRepo(extra = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'harness-fx-'))
  for (const [path, content] of Object.entries({ ...BASE, ...extra })) write(root, path, content)
  reindex(root)
  git(root, ['init', '-q', '-b', 'main'])
  git(root, ['config', 'user.email', 'fx@example.com'])
  git(root, ['config', 'user.name', 'fx'])
  return root
}

export function write(root, path, content) {
  const full = resolve(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

export const read = (root, path) => readFileSync(resolve(root, path), 'utf8')
export const reindex = root => write(root, 'docs/memory/MEMORY.md', renderIndex(loadFacts(root)))
export const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
export const cleanup = root => rmSync(root, { recursive: true, force: true })

/** Executa um script do template com a fixture como raiz e um JSON no stdin. */
export function run(script, { root, input, args = [] } = {}) {
  const r = spawnSync(process.execPath, [resolve(TEMPLATE, script), ...args], {
    cwd: root ?? TEMPLATE,
    input: input === undefined ? '' : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...(root ? { HARNESS_ROOT: root } : {}) },
  })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
