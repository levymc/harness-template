# Evals do harness

Testes (`pnpm harness:test`) provam que **os scripts e hooks funcionam**. Evals provam
que **o harness ajuda o agente** — e são a única forma honesta de saber se uma regra,
skill ou hook merece continuar. Em 2026, 60% dos harnesses públicos com tamanho para
isso não tinham nem testes nem evals.

Esta pasta ainda não tem evals rodáveis: elas dependem de falhas reais do projeto, e um
template não tem histórico. O que está aqui é o formato, para quando houver.

## Como montar

1. **Fonte**: 20 a 50 tarefas tiradas de falhas reais — correções que o usuário teve de
   fazer duas vezes, bugs que o agente introduziu, verdes que mentiram. Cada `licao`
   aplicada é uma candidata.
2. **Cada caso** em `docs/evals/casos/<slug>.json`:

   ```json
   {
     "origem": "commit ou conversa onde a falha aconteceu",
     "commit_base": "sha limpo de onde a tarefa parte",
     "pedido": "o prompt, como o usuário escreveu",
     "aceite": ["comando que tem de passar", "o que não pode acontecer"],
     "guarda_relacionada": "check-claims:<id> | caminho do hook/skill"
   }
   ```

3. **Rodar**: modelo fixo, um caso por worktree limpa, harness completo vs. harness sem
   a peça em teste (ablação). Mude **uma** peça por vez.
4. **Decidir**: peça que não muda o resultado em nenhum caso é candidata a sair
   (skill `jardinagem`). Peça que muda para pior sai.

## Exemplos de caso (do esqueleto deste template)

- **O e2e verde que não compilava** — pedido: "ative `useDefineForClassFields`, os
  campos de classe ficam mais modernos". Aceite: o build continua verde, ou o agente
  recusa citando o fato de memória sobre o Vitest. Guarda: o typecheck do hook Stop.
- **Coluna sem migration** — pedido: "adicione prioridade aos items". Aceite: existe uma
  migration nova e o e2e passa. Guarda: o teste de paridade model ↔ schema.

## Exemplo de caso do harness

- **Estudo de skills por objetivo** — pedido: "Utilizando a skill de buscar skills, me
  ajude a procurar skills que me ajudem em construir um sistema, com nestjs em um turbo
  repo (utilizando a estrutura do harness-template), que consulte no google por últimas
  notícias sobre plano de saúde no mercado brasileiro". Aceite: sai um estudo com as
  capacidades do objetivo, cada candidata com fonte, SHA, veredito da revisão e notas
  de ranking, e as lacunas declaradas; nada é instalado sem aprovação; o que é do
  projeto futuro é recomendado para o projeto derivado, não instalado no template.
  Guarda: a skill `buscar-skills`.
