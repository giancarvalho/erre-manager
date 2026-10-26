# Sprint 13 — Errômetro API II: fechamento, resultados, comentários, troféus

## O que foi feito

- Jobs `errometro.fechar_rodadas` (fecha rodadas vencidas com recuperação de até 14, ancoradas no `to`, e avisa "resultado saiu" uma vez) e `errometro.lembrete_fechamento` (faltam 3h, uma vez por rodada).
- Moderação: liberar agora, lista de rodadas (fechadas e com voto, só contagens), recalcular, ocultar/mostrar, anular voto por código.
- Resultados para qualquer membro: rodadas visíveis, ranking com os membros atuais, troféus e status por membro, contagem de comentários, próximo fechamento.
- Comentários: listar, criar, editar (autor), apagar (autor ou moderador); nome lido do perfil.
- Seção de perfil `errometro.trofeus`.
- Domínio portado: textos dos pushes, mensagem de compartilhamento, banner de rodada oculta, ranking, contagem de troféus, transições de cadência.
- Core: correção da política `propria_membership` (`ctx.members` falhava em jobs e rotas anônimas); `JobContext` com nome e slug da comunidade; harness grava pushes.

## Testes

- `errometro` (193): domínio portado do legado (cópia dos pushes, compartilhamento, banner, ranking, acervo de troféus, matriz de transições de cadência e o caso r-uberlandia) e integração com o executor de jobs real: fecha só na hora, ancorado no `to`, idempotente, sem segundo push; recuperação e teto; manual nunca fecha; lembrete uma vez dentro das 3h; liberar agora; recalcular sem mover a âncora nem renotificar; ocultar sem mexer na âncora; anular sem reemitir token; troca de cadência sem push; resultados, ocultas, perfil, permissões; comentários (limites, autoria, ex-membro, isolamento).
- Core: teste de regressão do `ctx.members` sem pessoa (falha sem a migration nova).
- Os arquivos de integração do módulo rodam em sequência: os jobs passam por todas as comunidades do banco de teste.

## Decidido

- D-044 (`[contrato]`). Perguntas novas: **P-017** (liberar no mesmo dia do fechamento repete o rótulo da rodada; mantido como no legado, recomendação B) e **P-018** (sem votantes, sem push; provisório A).

## Itens de `PARIDADE.md`

ERR-13 e ERR-14 concluídos; API de ERR-15 a ERR-21 concluída (telas nos Sprints 15 e 18).

## Pendente

- O app trocar para a comunidade da notificação ao tocar (`?comunidade=`), nos Sprints 14 e 15.
- `resolve-results-day.ts` do legado não foi portado: a API recebe a rodada e cai na mais recente se ela não existir ou estiver oculta.

## Riscos

- P-017: até a resposta, um "liberar agora" na manhã do dia do fechamento publica um resultado que ainda muda.
- O teste de P-017 depende de criar e liberar no mesmo dia; pode falhar se rodar exatamente na virada da meia-noite em São Paulo.

## Contrato `[contrato]`

- O job precisava do nome da comunidade para o título do push: `JobContext.community` ganhou `slug` e `name`.
- `ctx.members` só lista membros aprovados: o nome de quem saiu não está disponível (comentários antigos mostram "Ex-membro"). Se outros módulos precisarem, o core pode expor nomes de ex-membros.
- O bug da política só apareceu porque um módulo real chamou `ctx.members` num job: vale um teste de contrato para cada campo de `JobContext` e `AnonContext` no template.
