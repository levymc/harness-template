# Gastar menos uso com o agente

O limite de uso se gasta sobretudo **relendo contexto**. Cada chamada ao modelo relê a conversa
inteira até ali: mensagens, saídas de comando, arquivos lidos, skills e instruções. O texto que o
modelo escreve pesa bem menos. Medições num harness de referência mostraram as sessões longas
dominando a conta: as duas maiores sessões de uma semana somaram mais de um terço de toda a
releitura, e baixar o teto de compactação cortou cerca de um terço do contexto por chamada.

Nenhum dos hábitos abaixo é regra do harness: cada pessoa decide na própria sessão.

## Duas sessões curtas custam menos que uma longa

A mesma quantidade de trabalho em duas sessões faz cada chamada reler bem menos. Troque de sessão:

- **quando a tarefa termina** — a skill `fechar-tarefa` destila o que vale e apaga a pasta; a
  próxima tarefa começa numa sessão nova;
- **quando o assunto muda** — pergunta sem ligação com a tarefa vai para uma sessão nova;
- **no meio de um trabalho longo** — o estado já mora fora da conversa: o `task.json` e o
  `PROGRESS.md` da tarefa em `work/`, que o hook SessionStart imprime na sessão seguinte, a
  memória em `docs/memory/` e o histórico do git. Antes de trocar, deixe no PROGRESS o que foi
  feito, o que falta e as decisões em aberto.

## Baixar o teto de compactação na configuração pessoal

A compactação resume a conversa quando o contexto chega a um teto; com o teto mais baixo, cada
chamada relê menos, e o resumo guarda menos detalhe da parte antiga. É escolha de cada pessoa e
mora na configuração pessoal (`~/.claude/settings.json`), nunca no `.claude/settings.json` do
repositório, que vale para todos:

- na sessão, pelo comando `/autocompact`;
- no arquivo, pela chave `autoCompactWindow` (número de tokens, ou `"auto"`).

Comece entre 300 mil e 400 mil tokens e ajuste se a sessão passar a esquecer o que precisava.

## Trabalho mecânico aceita modelo menor e esforço baixo

Juntar a `main` na branch, rodar o gate e ler a saída, olhar o CI: trabalho que não pede
raciocínio roda bem com um modelo menor e esforço baixo (`/model`, `/effort`, que mudam só a
sua configuração). O que decide — diagnóstico, desenho da mudança, revisão, conflito — fica no
modelo e no esforço de sempre. O esforço muda sobretudo o texto escrito, que pesa menos que a
releitura: sessão curta e teto de compactação economizam mais. O harness não fixa modelo nem
esforço em skill, agente ou configuração do time.
