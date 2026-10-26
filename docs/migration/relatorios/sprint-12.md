# Sprint 12 — Errômetro API I: participação, voto anônimo, configuração

## O que foi feito

- Módulo `modules/errometro` registrado na API e no app (tela provisória até o Sprint 14): manifesto (`errometro.ver`, `errometro.votar`, `errometro.moderar`; duas notificações; intenção `errometro.participar`), nove tabelas por comunidade com RLS e migration reversível.
- Domínio portado: calendário, janela de liberação, rodada atual, texto da cadência, filtros de votos, configuração de emojis.
- Rotas autenticadas: rodada atual (janela, cadência, emojis, alvos, minha participação), pedir participação, listar/aprovar/rejeitar/remover votantes (limite de 50), chave pública, emissão do token, configuração de emojis e de cadência (trocar a cadência fecha a rodada atual na mesma transação).
- Rotas anônimas: `POST /v1/errometro/anon/c/:communityId/votos` e `/meus-votos`.
- Entrada com intenção aprova a votação junto (ou deixa na fila se cheio); sair, ser removido ou rejeitado leva a votação junto.
- Core: `community.createdAt` nos contextos de módulo; `createModuleHarness` em `@erre/core/testing`; `notInArray` exportado por `@erre/db`. `@erre/anon-vote`: valor cegado fora do módulo RSA recusado antes de reservar a emissão.

## Testes

- `errometro` (129): 89 de domínio (testes do legado de calendário, janela, cadência, filtros, agenda e emojis) e 40 de integração com Postgres real: participação e transições, limite de 50, matriz de permissões, cascata da membership, isolamento, emissão única, mensagem cegada inválida não queima o token, voto/atualização/desmarcar, alvos e emojis inválidos descartados, assinatura forjada, token de outra comunidade, virada da rodada, cadência (mesma, mudada, inválida), emojis (catálogo, personalizado desativado, validação).
- Anonimato: tabela de emissão só com (comunidade, pessoa, rodada); votos sem pessoa; voto com cookie e `Authorization` não muda nada; nenhum id de pessoa, tag ou token nos logs.
- E2E web (12): o Errômetro aparece no hub e abre a tela.

## Decidido

- D-043 (`[contrato]`): rodada ancorada no histórico; `createdAt` da comunidade nos contextos; rota anônima sem `members`; trava da rodada (fecha uma corrida que o legado registrava); códigos de erro; estrutura `domain/` + `api/server/`.

## Itens de `PARIDADE.md`

ERR-03 a ERR-06 concluídos; API de ERR-01, ERR-02, ERR-11 e ERR-12 concluída (telas nos Sprints 14 e 15).

## Pendente

- Fechamento agendado, recalcular, ocultar, anular, comentários, troféus e notificações: Sprint 13.
- R-ANON-09 (esconder a própria pessoa na grade anônima): decidir na tela, Sprint 14. A rota anônima não tem como impedir voto em si mesmo.

## Riscos

- As chaves privadas de assinatura ficam em texto no banco, como no legado. Quem tem o banco pode emitir tokens, mas continua sem ligar voto a pessoa.
- Se algum caminho futuro mudar membership sem chamar `onMemberLeft` (ex.: exclusão de conta no Sprint 19), a rota anônima aceitaria voto em quem saiu até o hook rodar. As rotas autenticadas já filtram por `ctx.members`.

## Contrato `[contrato]`

- Faltava a data de criação da comunidade para ancorar o primeiro período: entrou nos três contextos.
- A raiz do módulo é tratada como lado do manifesto pelo lint: código de servidor teve de ir para `api/server/`. Documentado no CONTRATO.md; vale explicar no template.
- Testar um módulo exigia montar a API inteira: o `createModuleHarness` resolve e deve ir para o template.
- Hooks de membership não têm `notify`: o aviso de fila cheia ficou só na resposta de `GET /participacao`.
