---
name: pre-push
description: 'Roda localmente, na mesma ordem, os passos do CI antes de um push ou PR. Use quando for dar git push, abrir PR, ou o usuário perguntar se está pronto para subir. Nunca dê push "para ver se o CI passa".'
---

# Pre-push — espelho do CI

Os passos abaixo são os do CI deste projeto, na mesma ordem. Se o CI mudar, esta skill
muda no mesmo commit.

<!-- pendente: os passos do CI, um por linha, com o comando exato; termine com o check do harness -->

Pare no primeiro vermelho e conserte; não pule passo. Se um passo não puder rodar aqui,
**diga qual não rodou** no resumo e no PR — passo pulado em silêncio parece aprovação.

Gate verde é o passo 1 da skill `validar-antes-de-concluir`, não o "pronto": antes de
abrir PR, faça também a prova do comportamento e a revisão fria dela. E rode
`node scripts/harness/barra.mjs --base origin/main`: se a branch mexe na barra, a lista vai
no corpo do PR, e o merge depende da decisão de quem não o escreveu.

Nunca: `--no-verify`, push para branch protegida, `--force` (o hook `bash-guard`
bloqueia os três).
