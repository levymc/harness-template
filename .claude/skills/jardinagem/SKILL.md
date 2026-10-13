---
name: jardinagem
description: Revisão periódica do harness — fatos de memória suspeitos, tetos perto do limite, skills e agentes sem uso, guardas cuja condição de expiração já valeu, tarefas abandonadas em work/. Use quando o usuário pedir uma revisão do harness, a cada poucas semanas, ou quando o SessionStart mostrar muitos suspeitos.
---

# Jardinagem do harness

Harness que só cresce apodrece igual a código: os projetos de origem tinham dezenas de
subagentes de uso único nunca aposentados e decisões revertidas em silêncio. Esta
revisão **propõe**; apagar ou aposentar é com o usuário.

1. **Memória**: `pnpm memory verify`. Para cada suspeito, releia as citações; confirme
   (`pnpm memory touch <slug>`), corrija, ou marque `superseded`. Fatos ativos perto do
   teto → consolide (skill `memoria`).
2. **Uso**: leia `.harness/usage.jsonl` (local, pode não existir numa máquina nova —
   diga isso em vez de concluir "sem uso"). Skill ou agente sem chamada há 60+ dias →
   proponha aposentar.
3. **Guardas**: em `docs/guardrails.md`, a coluna "expira quando" já aconteceu para
   alguma? Proponha remover a guarda e registre numa ADR (`superseded`).
4. **ADRs**: alguma "Revisar quando" foi atingida? Liste para o usuário.
5. **Tarefas**: pasta em `work/` sem entrada no PROGRESS há mais de 14 dias → pergunte
   se fecha (skill `fechar-tarefa`) ou se continua.
6. **AGENTS.md**: alguma linha já é garantida por check? Remova a prosa — o teto existe
   para forçar essa poda.

Entregue uma lista curta: o que propõe mudar, com o motivo e a evidência de cada item,
e o que não conseguiu verificar.
