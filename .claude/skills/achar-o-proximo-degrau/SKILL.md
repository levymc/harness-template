---
name: achar-o-proximo-degrau
description: 'Mede a maturidade agêntica de um repositório ou do harness por duas réguas, com prova por degrau, e devolve o próximo controle a construir. Use quando perguntarem em que degrau o harness está, o que falta ao agente, ou se uma mudança em skill, hook ou gate pula etapa.'
---

# Achar o próximo degrau

A pergunta "em que nível estamos?" não vale a resposta. A que vale é: **qual é o próximo
controle que, se existir, tira uma pessoa de um passo sem deixar o erro passar?** Esta skill
mede para achar esse controle, não para dar nota.

Duas réguas medem coisas diferentes, e só as duas juntas mostram o buraco:

- **Régua da capacidade**: o que o sistema sabe fazer sem a pessoa, em níveis (aqui, do 3 ao 7).
- **Régua da mão humana**: qual passo alguém ainda faz à mão, em degraus de 0 a 8.

Cada degrau tem dois eixos, que não andam juntos:

- **Capacidade comprovada**: o controle existe e foi visto barrando o erro.
- **Autonomia concedida**: quanto o agente pode fazer ali sem pedir — decisão de quem responde
  pelo repositório, não consequência da capacidade.

O buraco mais perigoso é a autonomia concedida acima da capacidade comprovada: o agente faz
merge sozinho e nenhum sensor confere o comportamento. Menos aprovação humana não é, por si,
mais maturidade; o sinal certo é a pessoa conseguir ver e interromper barato.

## Restrições

- Cada degrau dado como presente cita a prova no passo 4 ou 5 da escala "Quão firme é a prova",
  lida nesta sessão. Apontar a linha da regra não basta. Intenção, plano ou prompt não são prova.
- Os degraus se somam. Um degrau alto não compensa um de baixo que falta.
- Não recomende agente em segundo plano, agente que responde ao PR, release no merge ou conserto
  a partir do log (degraus 4 a 7) enquanto o código que o agente gera puder ler os segredos.
- Não grave o estado do projeto nesta skill nem na memória: o estado sai de uma leitura nova,
  com data. Sem porcentagem, sem nota: presente, parcial ou ausente por degrau.
- Não proponha subir a autonomia concedida; mostre onde a capacidade já a sustenta e onde não.
- Quem implementa não revisa o próprio trabalho: revisão da mesma instância não é prova.

## Antes do degrau 0

A IA amplifica o que o time já tem. Confira, sem dar degrau: controle de versão em tudo, PR
pequeno, uma regra escrita sobre o uso de IA, e os dados internos que o agente precisa ao
alcance dele. Faltando algum, é o primeiro buraco.

## As duas réguas, lado a lado

| Régua da mão humana | O passo que sai da mão da pessoa | Nível da capacidade que ele exige |
|---|---|---|
| 0 · barreiras | lembrar o agente de não errar | 6 · harness: tipo, teste, lint, hook, gate no CI |
| 1 · skills | repetir o mesmo pedido | 5 · skills e ferramentas, sobre o contexto do 3 |
| 2 · sequência | chamar as skills sempre na mesma ordem | 5 · uma skill que chama as outras, com parada definida |
| 3 · escolha | decidir qual skill cabe no caso | 3 e 5 · descrição que diz quando usar e quando não |
| 4 · começa sozinho | avisar o agente que a tarefa está pronta | 7 · agente em segundo plano com critério de pronto |
| 5 · vigia o PR | ler comentário e falha do CI e responder | 6 e 7 · o erro volta ao agente; revisor separado de quem implementa |
| 6 · release | disparar a release | pipeline que sobe no merge, por fases |
| 7 · lê o log | olhar o log depois da release | 7 · agente que abre o bug e corrige pelo erro visto |
| 8 · aprende | corrigir o mesmo erro de novo | 4 · cada erro vira regra, teste ou skill versionada |

## Guias e sensores

Um degrau só fecha com as duas peças: **guia** (age antes: AGENTS.md, skill, convenção) e
**sensor** (age depois: teste, lint, tipo, hook, revisão). Regra de guia sem sensor é pedido,
não barreira. Prefira o sensor que roda mais cedo e mais barato (lint antes de revisão por
modelo). Neste template, o mapa guia → sensor é o `docs/guardrails.md`.

## Quão firme é a prova

1. Alguém disse. Não vale sozinho.
2. Aponta a linha: o arquivo com a regra, o workflow, o hook.
3. Mostra que o erro não passa: segue o caminho do erro e ele para no controle.
4. Rodou: um teste, um run do CI ou um comando que falha alto quando o controle some
   (`scripts/harness/prove.mjs` é este passo, executável).
5. Viu acontecer no uso real: a sessão em que a skill carregou, o PR que o agente abriu.

Presente pede o passo 4 ou 5. Parcial é o 2 ou 3, ou um controle que cobre só parte dos casos.
Nos degraus 1 a 3 não há erro que um teste barre: presente pede o passo 5, uma sessão real
(`scripts/harness/sessao.mjs ler` mostra). Teste escrito pelo próprio agente conta como passo 4
só se outra peça (sabotagem, revisor frio, uso real) confirmou que ele pega o erro.

## Passos

1. **Recorte.** O que está sendo medido: o repositório, o harness ou uma mudança. Para uma
   mudança, meça a escada como ela fica depois e procure o salto (passo 7).
2. **Leia na fonte**, com a data: AGENTS.md, skills, hooks, `docs/guardrails.md`, workflows,
   uma tarefa recente em `work/` (ou o histórico dela no git), um PR recente.
3. **Confira a base** ("Antes do degrau 0").
4. **Meça de baixo para cima**, degrau 0 primeiro: capacidade presente, parcial ou ausente, com
   a prova e o passo dela; e a autonomia concedida ali, como o repositório a declara (ou "não
   declarada", em "Não checado").
5. **Procure o retorno desperdiçado.** Comentários humanos em PRs recentes que um sensor pegaria
   são erro que ainda volta pela mão de alguém: candidatos a próximo controle. A fila de atritos
   (`node scripts/harness/atrito.mjs fila`) também.
6. **Ache o buraco mais baixo**: o primeiro parcial ou ausente de baixo para cima, ou o primeiro
   onde a autonomia passa da capacidade. Não o mais vistoso de cima.
7. **Procure o salto**: degrau alto presente sobre um de baixo ausente bloqueia — diga o que
   quebra em silêncio.
8. **Proponha um controle**, o menor que fecha o buraco, com o critério de aceite em DADO /
   QUANDO / ENTÃO e quem decide. Prefira a regra que barra à instrução que pede: **o mesmo aviso
   escrito duas vezes no texto vira lint, teste ou hook** (skill `licao`).

As perguntas de cada degrau estão em `references/perguntas-por-degrau.md`; leia só a do degrau
que está medindo.

## O que devolver

- Recorte e data da leitura; a base, se faltar algo.
- A escada: uma linha por degrau, 0 a 8, com capacidade (e prova) e autonomia concedida.
- O próximo degrau e o controle proposto, com o critério de aceite.
- Saltos e excessos, cada um com o que quebra.
- Não checado: o que não deu para ler e por quê.

## Quando não usar

- Revisar lógica de negócio de um PR (revisão de código), decidir a autonomia (é de quem
  responde pelo repositório), escrever os testes do controle (`testes-agenticos`), provar que
  uma mudança está pronta (`validar-antes-de-concluir`).
