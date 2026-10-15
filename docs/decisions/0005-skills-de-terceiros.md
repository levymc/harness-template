---
status: accepted
date: 2026-10-15
supersedes:
superseded_by:
---

# 0005 — Skills de terceiros: cópia fixada por SHA, com lock verificado

## Contexto

O dono do template quer que, ao derivar um projeto ou adotar o harness num repositório
existente, o agente procure na internet skills que sirvam à stack e ao domínio do
projeto. Skill é instrução que o agente executa com as permissões dele: trazer uma de
fora é um problema de supply chain e de prompt injection, e não só de conveniência.
Até aqui, a ADR 0001 só previa skills escritas no próprio repositório.

## Decisão

- Skill de terceiro é **copiada** para `.claude/skills/<nome>/` e registrada em
  `skills-lock.json` com repositório, caminho, SHA do commit revisado, hash da pasta,
  licença e se a fonte é curada. Só `scripts/harness/skills.mjs` escreve o lock.
- A regra `third-party-skills` do check-claims reprova a pasta que diverge do hash. A
  prosa dessas pastas sai das regras que leem caminhos e comandos; termo proibido e
  frontmatter continuam cobrados.
- `harness.config.json` → `skillSources.trusted` é a lista curada, consultada primeiro.
  A busca aberta só sugere. Uma skill de fora da lista entra com aprovação explícita do
  usuário e fica `trusted: false`.
- A skill `buscar-skills` conduz busca, revisão e aprovação. `iniciar-projeto` e
  `adotar-harness` a chamam.
- As skills de terceiros instaladas no template **viajam** na adoção, junto com o lock.

## Alternativas consideradas

- **Plugin/marketplace do Claude Code** — recusada. O conteúdo é resolvido na máquina,
  fica fora do diff do PR, pode mudar sem revisão e só vale para uma ferramenta.
- **Referência por branch ou tag** — recusada: o que foi revisado deixa de ser o que
  está instalado no primeiro push do upstream.
- **Busca aberta com instalação direta** — recusada: entrega a escolha de instrução
  executável a um resultado de busca.
- **Só a lista curada, sem busca** — recusada pelo dono: para muitas stacks, a skill
  útil está no repositório do fornecedor, que nenhuma lista prevê.
- **Skills de terceiros fora da camada (cada projeto busca as suas)** — recusada pelo
  dono: as skills genéricas escolhidas no template devem chegar a todos os projetos. O
  custo é que o projeto adotado precisa remover as que não servem; `iniciar-projeto` e
  `adotar-harness` pedem isso.

## Consequências

- `pnpm skills add | verify | outdated | remove | list`; o `adopt.mjs` acrescenta o
  script `skills` e cobra o critério de skills de terceiros na tarefa de adoção.
- Mais skills no repositório tensiona o "poucas" da ADR 0001. A jardinagem trata isso:
  skill de terceiro sem uso é a primeira proposta de remoção.
- Adaptar uma skill de terceiro exige tirá-la do lock e assumir a autoria. Não existe
  "pequeno ajuste local".
- Se o destino da adoção já tiver um `skills-lock.json`, o do template vira
  `.harness-proposto`, como qualquer conflito. Não há merge automático.
- No mesmo trabalho, o `file-guard` deixou de procurar termo proibido em arquivo fora
  do repositório. O caminho da pasta de configuração do usuário continha um termo e
  travou o modo plano.

## Revisar quando

- O Claude Code ganhar lock e verificação de conteúdo para plugins, e o diff deles
  passar a aparecer no PR.
- A jardinagem mostrar que a maioria das skills de terceiros instaladas fica sem uso.
