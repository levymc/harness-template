# Perguntas por degrau

Uma seção por degrau da régua da mão humana: o que procurar, o sinal de presente e o erro comum.

## 0 · Barreiras

O agente erra, e o sistema percebe sozinho?

- **Procure:** tipo, teste, lint e hook que rodam no commit e no CI; regra que barra a ação
  perigosa (push forçado, segredo, apagar fora do repositório) — aqui, o motor de regras.
- **Presente:** o gate falha alto quando a regra é violada, e a falha diz o que corrigir.
- **Erro comum:** a regra existe só como texto no guia. Pedir ao agente que lembre não é barreira.
- **Pergunta-chave:** se eu apagar este controle, algum teste ou check fica vermelho?

## 1 · Skills

O pedido repetido virou skill?

- **Presente:** a skill traz o que o modelo não sabe sozinho (o comando do repositório, a regra
  do projeto), não conselho genérico.
- **Erro comum:** skill que duplica outra, ou que só repete boas práticas.

## 2 · Sequência

As skills que sempre andam juntas viraram uma que as chama na ordem?

- **Presente:** a sessão segue do começo ao fim sem a pessoa dizer a próxima skill.
- **Erro comum:** a ordem mora na cabeça de quem conduz, ou o laço não tem parada.
- **Pergunta-chave:** cada laço termina por um fato (gate verde, nenhum achado que bloqueia), e
  não por cansaço? (A segunda falha igual para as tentativas: `falhas.mjs`.)

## 3 · Escolha

A skill certa carrega só quando cabe?

- **Procure:** descrições com "Use quando"; dois pedidos diferentes levando a skills diferentes.
- **Presente:** dá para mostrar isso numa sessão real.
- **Erro comum:** descrição vaga, que carrega em todo pedido ou em nenhum.

## 4 · Começa sozinho

A tarefa pronta chega ao agente sem a pessoa avisar?

- **Procure:** um gatilho (label, issue nova) que entrega o trabalho ao agente.
- **Presente também pede:** um critério de pronto que o agente não consegue editar e um estado
  que sobrevive entre sessões (`work/<tarefa>/task.json` e `PROGRESS.md`).
- **Trava:** o código que o agente gera roda sem ler os segredos. Vale também para 5, 6 e 7.
- **Erro comum:** começa sozinho sem critério de pronto e declara vitória cedo.

## 5 · Vigia o PR

O comentário no PR volta ao agente, e outra instância revisa?

- **Presente:** a falha do CI ou o comentário volta ao agente sem a pessoa repassar; a revisão é
  de outra instância (`revisor-frio`, ou uma pessoa).
- **Erro comum:** o mesmo agente implementa e se aprova (a regra `no-merge-by-agent` barra o
  caminho óbvio disso).

## 6 · Release

O merge vira release sem disparo à mão, por fases e com volta rápida?

## 7 · Lê o log

O erro em produção vira issue e conserto sem alguém ler o log?

## 8 · Aprende

O erro repetido vira regra, teste ou skill?

- **Procure:** a fila de atritos, a escada da `licao`, e o PR que fechou cada atrito.
- **Presente:** o mesmo erro não volta, porque virou lint, teste ou skill; dá para ligar o
  atrito ao PR. O que não vira guarda e vale lembrar vai para `docs/memory/`, com citação.
- **Filtro:** a lição vira norma do projeto, não preferência de uma pessoa: peça o segundo caso
  ou a decisão de quem responde pelo repositório.
- **Erro comum:** corrigir e esquecer, ou guardar a lição na configuração pessoal de alguém.
