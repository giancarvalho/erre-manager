# Desempenho: medições do Sprint 19

Medido no container de desenvolvimento (Node 22, Postgres 16 local). São ordens de grandeza para comparar antes e depois, não metas de produção.

## Typecheck (inclui os tipos do RPC do Hono)

`tsc --noEmit` por pacote, frio:

| Pacote | Tempo |
|---|---|
| `apps/mobile` (importa as UIs dos módulos e os tipos do RPC) | 9,0 s |
| `modules/errometro` | 7,3 s |
| `modules/eventos` | 7,0 s (234 mil tipos, 743 mil instanciações, 4,5 s de checagem) |
| `apps/api` | 6,1 s |
| `packages/core` | 5,2 s |

Sem sinal de explosão de tipos no `hc<T>` (cada módulo tem um sub-app próprio, e o cliente é tipado por módulo, não pela API inteira). Revisar se um módulo passar de ~15 s.

## Latência das rotas principais

Requisições sequenciais em processo (Hono + transação com RLS + Postgres; sem rede), comunidade com 30 votantes:

| Rota | p50 | p95 |
|---|---|---|
| `GET /v1/errometro/rodada` | 8,1 ms | 12,1 ms |
| `GET /v1/errometro/participantes` | 4,5 ms | 7,6 ms |
| `GET /v1/errometro/resultados` | 4,6 ms | 7,8 ms |
| `GET /v1/errometro/chave` | 4,7 ms | 7,4 ms |
| `POST anon/c/:c/meus-votos` | 2,0 ms | 3,4 ms |
| `POST /v1/errometro/token` (antes) | 349 ms | 391 ms |

**Correção:** a emissão de token gastava ~350 ms de CPU por pedido na assinatura cega (`@cloudflare/blindrsa-ts` faz a operação RSA com BigInt em JavaScript) e travava o event loop: com 50 votantes abrindo a rodada juntos, a API ficaria ~17 s sem responder a ninguém. A operação de chave privada passou para o OpenSSL do Node (`privateDecrypt` com `RSA_NO_PADDING`, que usa CRT e blinding), com a checagem de falha da RFC 9474 §4.3. Agora leva **1,2 ms**. A saída é idêntica byte a byte: `packages/anon-vote/test/server.test.ts` compara com a biblioteca e com o vetor A.1 da RFC (D-051).

Outras operações de cripto já eram nativas: verificação do voto 0,3 ms; geração da chave da rodada 32 ms (uma vez por rodada ou evento).

## Índices

Todo índice de tabela por comunidade começa por `community_id` (ARQUITETURA, D-015). `apps/api/test/integration/indexes.test.ts` audita o banco migrado inteiro com `indexProblems()` de `@erre/db/testing`; a única exceção é `core_community_memberships_user_id_idx` (lista as comunidades de uma pessoa, consulta que não tem comunidade). O Sprint 19 corrigiu os dois índices de `voter_tag` (`errometro_0002`, `eventos_0002`).
