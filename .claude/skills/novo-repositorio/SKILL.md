---
name: novo-repositorio
description: A partir deste template, cria um repositório novo no GitHub (público ou privado, na conta ou organização do usuário) já com o harness e o objetivo do projeto, ou leva o harness a um repositório que já existe e ainda não tem. Use quando o usuário pedir para iniciar, criar ou montar outro repositório com base no harness-template, ou para colocar o harness num repositório existente (URL ou pasta).
---

# Novo repositório a partir do template

Esta skill roda **no template** e cuida da parte mecânica: GitHub, clone, branch e
cópia da camada. A parte de julgamento é feita pelas skills que já existem e não se
repete aqui: `iniciar-projeto` (repo novo) ou `adotar-harness` (repo existente), e
`buscar-skills` no modo objetivo.

Criar repositório e dar push são ações para fora da máquina. Mostre o comando e
confirme antes de cada uma. Branch e PR são feitos por você; **merge nunca**.

## 1. Entrevista (1–4 perguntas por rodada)

- **Objetivo** do repositório, em uma ou duas frases. Ele alimenta o
  `iniciar-projeto`, a primeira ADR e o `buscar-skills`.
- **Novo ou existente?** Se for existente, peça a URL do GitHub ou a pasta local e
  vá para a etapa 4.
- **Dono:** a conta do usuário (`gh api user --jq .login`) ou uma organização. Liste as
  opções com `gh api user/orgs --jq '.[].login'`.
- **Nome**, **descrição** e **visibilidade**: público ou privado. Não escolha a
  visibilidade por ele.
- **Pasta local** onde clonar. Sugira a pasta-mãe deste template.

## 2. Conferir a origem

- A origem é o remoto `origin` deste template (`git remote get-url origin`). Ele
  precisa estar marcado como template no GitHub: `gh api repos/<dono>/<repo> --jq .is_template`.
  Se vier `false`, peça ao usuário para marcar (`gh repo edit <dono>/<repo> --template`).
  Isso muda a configuração do repositório, então só com o "sim" dele.
- O GitHub copia a **branch padrão do remoto**, não esta pasta. Rode `git fetch origin`
  e `git log --oneline origin/main..HEAD`. Se houver commits locais ou um PR aberto
  que ainda não chegou à `main`, avise que o repo novo nasce **sem** eles e pergunte
  se quer esperar o merge.
- O `gh` precisa estar autenticado (`gh auth status`) numa conta com acesso ao template
  e ao dono escolhido.

## 3. Repositório novo

1. Criar. Mostre o comando e confirme antes:

   ```bash
   gh repo create <dono>/<nome> --template <dono-template>/<repo-template> --private --description "<descrição>"
   ```

   Use `--public` no lugar de `--private` se essa foi a resposta. O GitHub gera a
   `main` a partir do template, num commit novo e sem o histórico. Por isso não há push
   para a `main`: o hook bloquearia, e com razão.
2. Clonar na pasta escolhida com `git clone <url> <pasta>/<nome>`. A geração pelo
   template leva alguns segundos; se o clone vier vazio, espere e tente de novo.
3. Criar a branch de trabalho: `git -C <pasta>/<nome> switch -c chore/iniciar-projeto`.
4. Seguir a skill `iniciar-projeto` **no repositório novo**, com o objetivo da etapa 1
   já respondido. Ela inclui o `buscar-skills` no modo objetivo, e o estudo fica no
   `work/` do repo novo.
5. Rodar `pnpm install` e `pnpm check` **no repo novo**. Commitar na branch, dar push
   da branch e abrir o PR (`gh pr create --repo <dono>/<nome> --base main`) com o que
   foi verificado e o que não foi. O merge é do usuário.

## 4. Repositório existente

1. Se veio uma URL, clone na pasta escolhida. Se veio uma pasta, confira que é um
   repositório git com a árvore limpa (`git -C <pasta> status --short`). Árvore suja:
   pare e pergunte.
2. Já tem harness (`harness.config.json` na raiz)? Então isto não é adoção. Diga isso
   e sugira a skill `jardinagem` ou a comparação com este template.
3. Branch de trabalho no destino: `git -C <pasta> switch -c chore/adotar-harness`.
4. Instalar a camada. Primeiro rode
   `node scripts/harness/adopt.mjs <pasta> --dry-run`, mostre o relatório (conflitos
   viram `.harness-proposto`, nada é sobrescrito) e depois rode sem `--dry-run`.
5. Seguir a skill `adotar-harness` a partir da etapa 2 (arqueologia) **no destino**. O
   adopt já abriu a tarefa em `work/` lá, e o objetivo da etapa 1 entra na entrevista e
   no `buscar-skills`.
6. Rodar o `harness:check` do destino, commitar na branch, dar push da branch e abrir o
   PR. Merge nunca.

## Trabalhando em outro repositório desta sessão

Os hooks desta sessão guardam **este** template:
- o Stop roda o check daqui, não o de lá;
- o bloqueio de commit na `main` olha a branch daqui;
- o termo proibido não é conferido em arquivo fora deste repo.

No repositório novo ou adotado:
- Commite só na branch de trabalho, nunca na `main`. O hook não vai te parar lá.
- Rode o check de lá (`node scripts/harness/check-claims.mjs` dentro dele) antes de cada
  commit. Ele herda os `forbiddenTerms` e cobra o que o hook daqui não vê.
- Para trabalho longo (adoção com arqueologia, várias sessões), ofereça continuar numa
  sessão aberta **no repositório de destino**, onde os hooks dele valem. Entregue um
  prompt pronto com:
  - objetivo;
  - repositório e branch;
  - tarefa aberta em `work/`;
  - próximo passo da skill.

## Fechar

Resumo ao usuário:
- URL do repositório e do PR;
- visibilidade;
- o que foi feito em cada etapa;
- o que foi verificado e **o que não foi** (por exemplo, e2e sem banco);
- o próximo passo, que é o merge, dele.
