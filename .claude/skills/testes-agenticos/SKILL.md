---
name: testes-agenticos
description: 'Método de teste pelo contrato observável (DADO/QUANDO/ENTÃO), sem mock interno nem espera por tempo, e a classificação de testes ruins (placebo, órfão, acoplado). Use quando escrever, revisar ou auditar testes — de módulo, de hook, de skill ou de fluxo com agente.'
---

# Testes pelo contrato observável

Teste responde "que comportamento o sistema promete", não "que função foi chamada". Um teste
que passa pelo motivo errado é pior que nenhum: dá confiança falsa (ver `docs/harness.md`,
"Lição vira guarda").

## Restrições

- Ao implementar ou corrigir comportamento, siga RED → GREEN → REFACTOR: primeiro o teste que
  reproduz o gap (vermelho, visto), depois o mínimo para passar, depois simplificar sem mudar
  o contrato. Antes de concluir, skill `validar-antes-de-concluir`.
- Auditoria avalia **um teste por vez**. Reescrita mecânica em lote só quando preserva
  comportamento, tem diff verificável e é seguida da auditoria de cada título afetado.
- Nenhum lote fecha com `skip`, `todo`, `only`, placebo ou risco conhecido não declarado.
- Teste que só confere prosa de `SKILL.md` ou de documentação por substring é **placebo**: o
  que garante a prosa é o `check-claims` (caminho, comando e flag citados existem), não um
  `includes('frase')`.
- Título descreve o comportamento, sem prefixo de nível ("unit:", "[E2E]"). A categoria vem
  da pasta e do comando da suíte.
- Nada de espera por duração (`sleep`, polling sem sinal) como sincronização. Timeout só como
  fail-safe.
- Nada de mock de módulo ou colaborador do próprio sistema. Unidade exercita regra pura;
  integração e e2e exercitam dependência e protocolo reais (banco do `docker compose`,
  servidor HTTP local, processo do hook com JSON no stdin).
- Todo bloqueio tem o caso vizinho que precisa passar: detector testado só no "tem de pegar"
  deriva para bloquear tudo.

## Cenário

```
DADO [contexto inicial]
QUANDO [ação executada]
ENTÃO [resultado observável]
```

```
DADO um item criado pela API
QUANDO peço a remoção dele e depois o leio
ENTÃO a remoção responde 204
E a leitura responde 404
```

## Categoria pela fronteira

| Categoria | Fronteira | Regra |
|---|---|---|
| Unidade | regra pura, sem I/O | valores reais; tempo entra como dado |
| Integração | uma ou mais fronteiras reais | o adapter verdadeiro, observado na fronteira |
| E2E | da entrada pública ao efeito final | dados únicos, limpeza em `finally`; sem ambiente, falha explícita no gate dedicado |

Teste que cruza fronteira não é unitário.

## Classificação de um teste existente

| Classe | O que é | Ação |
|---|---|---|
| `valido_real` | contrato vivo, observável | manter |
| `placebo` | confere prosa por substring | remover ou reescrever |
| `orfao` | testa código que não existe mais | remover |
| `duplicado` | mesmo contrato em outro teste | consolidar |
| `acoplado_impl` | testa detalhe de implementação | reescrever pelo contrato |
| `fragil_temporal` | relógio real ou espera como sincronização | tempo como dado, ou esperar um sinal |
| `passa_sem_motivo` | continua verde com a regra removida | provar com `prove.mjs` e consertar |

A última classe é a que a sabotagem acha (skill `cobrir-lacunas-de-teste`): leia o teste e ele
parece certo; quebre a regra e ele continua verde.
