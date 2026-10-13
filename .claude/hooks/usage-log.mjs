/**
 * PostToolUse(Skill) e SubagentStop: registra o uso do harness em `.harness/usage.jsonl`.
 *
 * Por que: nos repositórios de origem havia 35 a 43 subagentes e ~100 skills, a maioria
 * criada para uma iniciativa e nunca aposentada — e ninguém sabia quais eram usados.
 * Sem medida, aposentar é palpite. A skill `jardinagem` lê este arquivo.
 *
 * Local (gitignored) e best-effort: nunca bloqueia, nunca falha alto.
 * O campo do nome da skill em `tool_input` não está documentado com certeza, então o
 * registro guarda o tool_input inteiro (é pequeno) em vez de adivinhar a chave.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from '../../scripts/harness/lib.mjs'
import { isMain, runHook } from './_io.mjs'

export function entry(input, now = new Date()) {
  return {
    ts: now.toISOString(),
    evento: input.hook_event_name,
    tool: input.tool_name,
    skill: input.tool_name === 'Skill' ? input.tool_input : undefined,
    agente: input.agent_type,
  }
}

if (isMain(import.meta)) {
  await runHook(input => {
    const dir = resolve(ROOT, '.harness')
    mkdirSync(dir, { recursive: true })
    appendFileSync(resolve(dir, 'usage.jsonl'), `${JSON.stringify(entry(input))}\n`)
    return null
  })
}
