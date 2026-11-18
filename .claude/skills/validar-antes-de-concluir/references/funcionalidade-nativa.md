# Lente "funcionalidade nativa"

Esta mudança traz funcionalidade nova. Funcionalidade encaixada com remendos passa no gate e
na revisão comum, porque cada pedaço está certo sozinho. O custo aparece depois: duas versões
da mesma coisa, que divergem na primeira mudança que só uma delas recebe.

## A pergunta

"Se quem escreveu o código soubesse desta funcionalidade desde o começo, como ele seria?"

Imagine essa versão e compare o diff com ela. Onde o diff põe o novo ao lado do que já existe,
em vez de dentro, há um achado.

## Os sinais

- uma variável que recalcula um valor que o código já tem;
- um `if (tipoNovo)` espalhado em código que já escolhe pelo tipo;
- um arquivo, módulo ou componente copiado de um existente para servir uma variante;
- uma flag ou um booleano que repete o que um tipo já diz;
- uma validação ou um caminho duplicado ao lado do comum;
- um teste que só prova que "nada mais mudou", sem provar o comportamento novo;
- um segundo sistema para algo que o código já tem (log, retry, configuração, contagem).

## A saída

Cada sinal vira um achado, no formato do pedido: arquivo e linha, o sinal e a proposta de
dobrar o novo para dentro do que já existe, sem inventar camada nova. O que tem comportamento
de fato diferente continua separado, e o achado diz por que não junta. Sem sinal, a lente não
acrescenta nada.

## Regras da dobra

1. Teste reescrito ou apagado por causa da lente volta a ser provado: a sabotagem que o teste
   antigo pegava, o novo também pega (`scripts/harness/prove.mjs`, skill `cobrir-lacunas-de-teste`).
2. A dobra sai num commit próprio — `refactor` quando não muda comportamento — para a revisão
   vê-la separada da funcionalidade.
3. Em correção de bug, a lente não roda: a correção fica do tamanho do defeito, e a dobra, se
   fizer falta, vira tarefa própria.
