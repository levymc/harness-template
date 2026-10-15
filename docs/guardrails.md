# Proibições e seus sensores

Toda proibição deste repositório está aqui, com o sensor que a impõe. **Sensor** é um
id de regra (`check-claims:<id>`), um hook ou um teste — a regra `guardrails-sensors`
confere que ele existe. Proibição sem sensor possível é marcada **revisão** e fica
assumida como gap, à vista, em vez de fingir cobertura.

Toda linha diz de onde veio e **quando pode sair**: guarda sem condição de expiração
vira peso morto que ninguém ousa remover.

| Nunca | Por quê | Sensor | Origem | Expira quando |
|---|---|---|---|---|
| Mudar schema sem migration | código lê coluna que o banco não tem → 500 em toda página | `test/schema-parity.e2e-spec.ts` | deploy sem migrate versionado num projeto de origem | nunca, enquanto houver banco relacional |
| Usar `sync()` / `synchronize: true` | o ORM altera o schema fora do controle de versão | `check-claims:no-sync` | idem | idem |
| Migrar banco não-local pelo agente | produção muda sem revisão humana | `.claude/hooks/bash-guard.mjs` | ADR 0002 | se o deploy ganhar migração com aprovação explícita |
| Commit na branch protegida, `--force`, `--no-verify`, `reset --hard`, `clean -f` | difícil ou impossível de desfazer | `.claude/hooks/bash-guard.mjs` | regras só em prosa nos projetos de origem | nunca |
| Ler ou citar `.env`, chave ou credencial | segredo no contexto vaza para logs e provedores | `.claude/hooks/file-guard.mjs` | — | nunca |
| Variável de ambiente lida e não documentada | setup quebra numa máquina nova | `check-claims:env-example` | — | nunca |
| Termo proibido em qualquer arquivo ou comando | pedido explícito do dono do repositório | `check-claims:forbidden-terms` | pedido do usuário | quando o dono retirar o termo |
| Instrução que cita caminho, script ou flag inexistente | o agente executa a instrução falsa, recebe exit 0 e segue | `check-claims:cited-path` `check-claims:pnpm-script` `check-claims:script-flag` | flag documentado que o script ignorava | nunca |
| `AGENTS.md` crescer além do teto | o que entra em toda sessão e ninguém lê não protege nada | `check-claims:agents-md-ceiling` | AGENTS.md de 229 linhas com teto declarado de 200 | se o teto for revisto em ADR |
| Skill sem frontmatter, ou copiada em pasta de outra ferramenta | skill sem `description` nunca dispara; cópias divergem | `check-claims:skill-frontmatter` `check-claims:single-skill-source` | 12 skills inertes; 7 cópias divergentes da mesma skill | nunca |
| Editar skill de terceiro travada, ou instalá-la sem SHA fixo | o agente executa instrução que ninguém revisou; push no upstream muda o projeto em silêncio | `check-claims:third-party-skills` `scripts/harness/skills.mjs` | ADR 0005 | se o Claude Code passar a fixar e verificar plugins por conta própria |
| Instalar skill de fora de `skillSources.trusted` sem aprovação explícita do usuário | fonte desconhecida, risco de prompt injection e supply chain | revisão | ADR 0005 | nunca |
| Subagente sem `tools:` | herda todas as ferramentas, inclusive escrita | `check-claims:agent-frontmatter` | metade dos subagentes dos projetos de origem | nunca |
| Segunda memória fora de `docs/memory` | dois sistemas sem dono, um deles fora do git | `check-claims:settings-hygiene` | três sistemas de memória num só projeto | se a auto-memória passar a ser versionável no repo |
| Fato de memória com citação morta ou índice dessincronizado | memória que mente é pior que nenhuma | `check-claims:memory` | índice escrito à mão com linha quebrada | nunca |
| Acumular tarefas abertas em `work/` | ruído em toda sessão; 634 pastas num projeto de origem | `check-claims:work-tasks` | idem | nunca |
| ADR sem condição de revisão, ou número repetido | decisão vira dogma; três números de ADR duplicados num projeto de origem | `check-claims:adr-shape` | idem | nunca |
| Link relativo quebrado na documentação | bootstrap aponta para arquivo movido | `check-claims:md-links` | índice da documentação movido por um commit e nunca atualizado no AGENTS.md | nunca |
| Concluir "pronto" sem dizer o que não foi verificado | passo pulado em silêncio parece aprovação | revisão | recorrente | nunca |
| Contornar um bloqueio de hook por outro caminho | anula a guarda e esconde o motivo | revisão | — | nunca |
