# Regras de negócio do legado

Regras implícitas do Errômetro copiadas do código em `queridometro@7c5c5bf`, com `arquivo:linha`. Os testes portados nos sprints 11 a 16 devem reproduzir cada regra marcada aqui. IDs: `R-<área>-NN`.

Onde a regra depende de "grupo", lembre que o grupo do legado equivale à comunidade da nova arquitetura (D-026).

---

## Calendário, rodadas e cadência

### R-CAL-01 — O dia de votação vira ao meio-dia no fuso da votação
`src/domain/voting/calendar.ts:4` · `:51-61` · `:70-77`
```ts
const DEFAULT_VOTING_TIMEZONE = "America/Sao_Paulo";
const todayNoon = fromZonedTime(`${todayYmd}T12:00:00`, zone);
const to = now >= todayNoon ? todayNoon : subDays(todayNoon, 1);
const from = subDays(to, 1);
```
`getVotingDay` devolve a data de `to`. Fuso vem de `VOTING_TIMEZONE`; valor inválido lança erro (`:16-20`). Só usado hoje pelo caminho legado/demo; grupos reais usam R-CAL-03.

### R-CAL-02 — Cadências: `daily` e `weekly` (legadas), `custom` e `manual`
`src/domain/voting/release-window.ts:29` · `:42-50` · `:71-109`
```ts
export type ReleaseFrequency = "daily" | "weekly" | "custom" | "manual";
```
- `releaseHour` inteiro 0–23 (`:72-80`).
- `weekly` exige `releaseWeekday` 1–7, ISO, segunda = 1 (`:81-88`). A UI não cria mais `daily`/`weekly`, mas configs salvas com eles continuam valendo (`:18-28`).
- `custom` exige `releaseWeekdays` com 1 a 7 dias distintos, cada um 1–7 (`:89-108`).
- `manual` não tem horário: o fechamento empurra `to` para 36.500 dias à frente, então o job nunca fecha sozinho (`:40`, `:205-207`).

### R-CAL-03 — A rodada de um grupo é ancorada no último fechamento real
`src/domain/voting/release-window.ts:243-249` · `src/lib/voting/group-release-schedule.ts:30-38`
```ts
const lastReleaseAt =
  (await getLastReleaseAt(groupId)) ?? (await getGroupById(groupId))?.created_at ?? now;
return getGroupReleaseWindow(config, lastReleaseAt);
```
`from` é o último fechamento (ou a criação do grupo); `to` é o próximo horário configurado estritamente depois de `from` (`getNextReleaseInstant`, `:199-229`). Um atraso manual se propaga para os ciclos seguintes.

### R-CAL-04 — Cadência padrão de um grupo sem configuração: semanal, segunda ao meio-dia
`src/domain/voting/release-window.ts:64-68` · `src/lib/voting/group-release-schedule.ts:17-20`
```ts
export const ACTIVE_RELEASE_CONFIG: ReleaseConfig = {
  frequency: "weekly",
  releaseHour: 12,
  releaseWeekday: 1,
};
```
O comentário em `:59-62` diz "there is only one real group", mas a configuração por grupo já existe (`group_release_config`); o comentário está desatualizado.

### R-CAL-05 — O rótulo da rodada (dia âncora) é sempre o `to` da janela
`src/lib/voting/group-release-schedule.ts:41-44` · `src/lib/jobs/close-daily-snapshots.ts:67-69`
```ts
const { to } = await groupReleaseWindow(groupId, now);
const label = formatInTimeZone(to, getVotingTimeZone(), "yyyy-MM-dd");
const result = await getVoteRepository().getDailyResults(groupId, label);
```
Chave de assinatura, emissão de token e votos usam esse rótulo. Mesmo num fechamento antecipado, o rótulo continua sendo o `to` agendado; usar `now` já causou perda de votos (incidente r-uberlandia, 2026-07-27, `:46-55`).

## Voto anônimo

### R-ANON-01 — Uma emissão de token por usuário, grupo e período, reservada antes de assinar
`src/lib/voting/anonymous-voting.ts:106-117`
```ts
const claimed = await getTokenIssuanceRepository().tryClaimIssuance(userId, groupId, votingDay);
if (!claimed) return { ok: false, reason: "already_issued" };
```
Se algo falhar depois da reserva, a pessoa perde o período (troca aceita, `:79-86`). Mensagem cegada com tamanho errado é rejeitada **antes** da reserva (`:94-104`).

### R-ANON-02 — A emissão não guarda horário
`src/db/schema.ts:170-190` (comentário de `voting_token_issuances`, "Deliberately stores NO timestamp" na linha 176): um `issued_at` permitiria relacionar a ordem de emissão com `voted_at` e reidentificar o voto. A chave primária (usuário, grupo, dia) basta.

### R-ANON-03 — O envio de votos não tem sessão; a elegibilidade vem só da assinatura
`src/lib/voting/anonymous-voting.ts:131-137` · `src/app/api/groups/[id]/vote/route.ts:9-12`
O `voter_tag` é derivado da mensagem preparada verificada, nunca recebido do cliente (`:165-172`).

### R-ANON-04 — Limite de 500 alvos por envio
`src/lib/voting/anonymous-voting.ts:18` · `:150`
```ts
const MAX_TARGETS = 500;
```

### R-ANON-05 — Alvos que saíram e emojis desativados são descartados, não falham o envio
`src/lib/voting/anonymous-voting.ts:174-184`. Se nada sobrar: "Nenhum voto válido."

### R-ANON-06 — Desmarcar um emoji apaga o voto anterior daquele alvo
`src/lib/voting/anonymous-voting.ts:191-203`
```ts
const removedTargetIds = Object.keys(existing).filter((id) => !(id in voteMap));
```
A comparação é com o mapa **original** enviado, não com as linhas válidas.

### R-ANON-07 — O token fica só no dispositivo; "meus votos" é consultado pelo `voter_tag`, sem sessão
`src/lib/voting/client-token.ts:15-29` (chave `karmometro:vtoken:<grupo>:<dia>` no `localStorage`) · `src/lib/voting/anonymous-voting.ts:208-222`. Modelo de um dispositivo: perder o token significa não votar de novo no período.

### R-ANON-08 — Caminho HMAC (`VOTER_TAG_SECRET`) só existe para o grupo demo
`src/domain/voting/voter-tag.ts:7-23` · `src/app/actions/votes.ts:93` · `src/app/group/[id]/vote/page.tsx:235-242`. Grupos reais usam `AnonymousSubmitVotesBar` (assinatura cega). Se o demo for descartado (P-003), `VOTER_TAG_SECRET` deixa de ser necessário.

### R-ANON-09 — Não votar em si mesmo (caminho demo)
`src/app/actions/votes.ts:72`: "Não podes votar em ti mesmo." Conferir no Sprint 12 se a grade anônima também esconde a própria pessoa (a UI de eventos esconde o próprio card, commit `f9b4344`).

## Fechamento e resultados

### R-RES-01 — Job a cada 15 minutos fecha os grupos cujo `to` passou
`src/instrumentation.ts` (cron `*/15 * * * *`) · `src/lib/jobs/close-daily-snapshots.ts:186-199`
```ts
while (periodsClosed < MAX_CATCHUP_PERIODS_PER_GROUP) {
  const { to } = await groupReleaseWindow(groupId, now);
  if (now < to) break;
  await recomputeGroupSnapshot(groupId, now, to);
```
No fechamento agendado, o `createdAt` do snapshot é o `to` (não `now`), para não abrir buraco entre rodadas (`:25-31`).

### R-RES-02 — No máximo 14 rodadas recuperadas por grupo numa execução
`src/lib/jobs/close-daily-snapshots.ts:165` · `:203-211` (loga `cron_close_daily_snapshots_catchup_cap_hit`).

### R-RES-03 — Recalcular uma rodada antiga não move a âncora da rodada atual
`src/lib/jobs/close-daily-snapshots.ts:131-150`: rodada atual → `releasedAt = now`; rodada antiga com snapshot → mantém o `createdAt`; rodada sem snapshot → fim daquele dia no fuso.

### R-RES-04 — Notificação "resultado saiu" é enviada uma vez só por rodada
`src/db/schema.ts` (`daily_vote_snapshots.notified_at`, comentário "Claim-once marker") · `src/lib/notifications/notify-result-ready.ts`. Recalcular não reenvia.

### R-RES-05 — Fechamento dentro de transação de mudança de cadência não notifica
`src/lib/jobs/close-daily-snapshots.ts:73-80`: limitação deliberada, registrada no código.

### R-RES-06 — Membros aprovados veem os resultados sem precisar votar
`src/app/results/page.tsx:222`
```ts
// Real groups: approved members always see snapshots, regardless of hasVoted.
```
A tela "Resultados reservados" (`src/components/results/ResultsPaywall.tsx`) só aparece no demo.

### R-RES-07 — Rodada oculta é indistinguível de "não houve rodada" para membros
`src/app/results/page.tsx` (comentário junto de `hiddenDaysCount`) · `src/lib/persistence/daily-snapshots.ts:90-132`. Só o criador vê quantas estão ocultas. Ocultar não apaga a linha, para não mexer na âncora (`schema.ts`, comentário de `hidden`).

### R-RES-08 — Liberar agora, recalcular e ocultar são só do criador
`src/app/actions/release-now.ts:27-32` · `src/app/api/groups/[id]/recompute-snapshot/route.ts:36-38` · `src/app/api/groups/[id]/hide-snapshot/route.ts:32-34` (403 para quem não é criador).

### R-RES-09 — Anular voto apaga todas as linhas daquele `voter_tag`, sem reemitir token
`src/lib/voting/annul-vote.ts:14-20` · `src/app/actions/annul-vote.ts:15-35` (só criador). Reemitir deixaria a mesma pessoa contar duas vezes (comentário em `annul-vote.ts`).

### R-RES-10 — Agregação: contagem por alvo e emoji, alvos em ordem de id
`src/domain/voting/aggregate-votes.ts:6-26`.

## Troféus

### R-TRO-01 — Troféu exige pelo menos 3 votos no emoji e líder único
`src/domain/voting/trophies.ts:27` · `:43-74`
```ts
export const MIN_COUNT_FOR_TROPHY = 3;
if (max < MIN_COUNT_FOR_TROPHY) continue;
```
Empate no topo não dá troféu; vira "quase" (`nearMisses`) para os empatados (`:86-106`).

### R-TRO-02 — Troféus de rodadas passadas usam os emojis daquele snapshot, não a configuração atual
`src/domain/voting/trophies.ts:3-10` · `:37-41`.

### R-TRO-03 — Nomes dos troféus
`src/lib/trophies/trophy-catalog.ts:2-17` (ex.: `asno: "Troféu Rei dos Asnos"`, fallback `"Troféu Misterioso"`).

## Emojis

### R-EMO-01 — Catálogo global de 11 emojis
`src/lib/emojis.ts:10-20`: asno 🦄, biscoito 🍪, bocao 🫦, bolo 🎂, cobra 🐍, coracao ❤️, coracao-partido 💔, mala 💼, mentiroso 🤥, planta 🪴, vomito 🤢. Legenda em `src/lib/emoji-legend.ts`.

### R-EMO-02 — Grupo sem configuração usa o catálogo inteiro
`src/db/schema.ts` (comentário de `group_emoji_config`): "No rows for a group = falls back to the full global EMOJI_OPTIONS catalog".

### R-EMO-03 — De 1 a 15 emojis ativos; descrição até 140 caracteres
`src/lib/emojis/emoji-limits.ts:8-10`.

### R-EMO-04 — Emoji personalizado nunca é apagado, só desativado
`src/db/schema.ts` (comentário de `group_emoji_config`): snapshots antigos podem referenciar o emoji.

### R-EMO-05 — Cor do brilho do emoji personalizado é inferida no navegador
`src/lib/emojis/infer-glow-color.ts:11-23` (usa `document`/canvas; sem DOM devolve o padrão).

## Membros e entrada

### R-MEM-01 — Estados e transições de membership
`src/infrastructure/groups/postgres-group.repository.ts:302-306`
```ts
approve: { from: "pending", to: "approved" },
reject: { from: "pending", to: "rejected" },
remove: { from: "approved", to: "removed" },
```

### R-MEM-02 — Pedido de entrada sempre começa como `pending`; quem foi rejeitado ou removido pode pedir de novo
`src/infrastructure/groups/postgres-group.repository.ts:134` (novo pedido `pending` com `votingStatus: "pending"`) · `:146-169` (rejeitado/removido volta para `pending` num pedido explícito). A entrada automática ao visitar o hub **não** repede (`src/lib/groups/hub-access.ts`, comentário).

### R-MEM-03 — Até 300 membros aprovados; pedidos pendentes não têm limite
`src/lib/groups/group-limits.ts:1-2` · `postgres-group.repository.ts:313-318` (`group_full` ao aprovar).

### R-MEM-04 — Até 50 votantes; acima disso a votação fica `pending`
`src/lib/groups/group-limits.ts:4-16` · `postgres-group.repository.ts:396-400`.

### R-MEM-05 — Aprovar a entrada aprova também a votação pedida junto, se houver vaga; rejeitar ou remover leva a votação junto
`src/infrastructure/groups/postgres-group.repository.ts:268-283` · `:321-329`. É o comportamento que D-023 ("um pedido só") preserva.

### R-MEM-06 — Quem criou não pode sair
`src/app/actions/group-membership.ts:78-83`: "Quem criou o grupo não pode sair dele." Sair = `remove` feito pela própria pessoa (`:85`).

### R-MEM-07 — Nome do grupo / código de convite
`src/lib/groups/group-slug-schema.ts:3-21`: `^[a-z0-9-]+$`, 1 a 32 caracteres, `demo` reservado. No legado o slug **é** o código de convite (`src/types/group.ts:1`), então qualquer pessoa que saiba o nome pode pedir entrada.

### R-MEM-08 — Nome de exibição: 2 a 32 caracteres
`src/lib/auth/display-name.ts` (`DisplayNameSchema`).

### R-MEM-09 — Sessão deslizante de 400 dias
`src/lib/auth/constants.ts:13` · `src/middleware.ts` (reemite o cookie a cada acesso protegido).

## Comentários

### R-COM-01 — Até 280 caracteres, não vazio, só membros aprovados
`src/types/comment.ts:13` · `src/app/actions/comments.ts:36-47`.

### R-COM-02 — Editar: só o autor; apagar: o autor ou o criador do grupo
`src/infrastructure/comments/postgres-comment.repository.ts:89` (editar) · `:95-112` (apagar). Comentários são identificados (`authorId`, `authorName`), não anônimos.

## Eventos

### R-EVT-01 — Estados: `draft → accepting_applications → open → closed`; exclusão suave em qualquer estado
`src/db/schema.ts` (`voting_events.status`) · `src/lib/events/close-voting-event.ts:51`, `:108`, `:192-233`, `:254`.

### R-EVT-02 — Publicar exige rascunho, ao menos um emoji e, se agendado, datas no futuro e fechamento depois da abertura
`src/lib/events/close-voting-event.ts:51-84`.

### R-EVT-03 — No máximo um evento "ao vivo" por grupo
`src/lib/events/close-voting-event.ts:37-43` · `:55-63`: "Este grupo já tem um evento em andamento. Feche-o antes de publicar outro." Rascunhos e fechados não contam.

### R-EVT-04 — Só dá para editar em rascunho
`src/lib/events/voting-events.ts:153-154`.

### R-EVT-05 — Limites: título 1–64, descrição até 280, 1–15 emojis (categórico), até 5 eixos (escala), teto de escala 1–10
`src/lib/events/event-limits.ts:12-42`.

### R-EVT-06 — Abrir e fechar antecipados são sempre permitidos ao admin, mesmo em modo agendado
`src/app/actions/voting-events.ts` (comentários de `openVotingAction` e `closeVotingEventAction`). Jobs `open-scheduled-events` e `close-scheduled-events` cuidam do agendado.

### R-EVT-07 — Abrir o link do evento torna a pessoa participante na hora
`src/lib/events/event-participation.ts:58-76`: cria membership `pending` no grupo se não houver e concede participação no evento **sem aprovação**. Só quem foi rejeitado ou removido do grupo fica bloqueado (`:35-38`). Ver P-014.

### R-EVT-08 — Categórico usa exatamente as regras do Errômetro
`src/domain/events/categorical-calculator.ts:12-40` (mesma agregação e mesmos troféus de R-RES-10 e R-TRO-01).

### R-EVT-09 — Escala: média por alvo e eixo, troféu para a maior média com pelo menos 3 votos
`src/domain/events/scale-calculator.ts:124-183`. Comparação exata por multiplicação cruzada (`:151-153`), arredondamento meio-para-cima com `BigInt` (`:50-60`). Eixo com teto 1 compara contagem bruta (`:109-123`, `:129`, `:151-152`).

### R-EVT-10 — O ganhador do troféu de evento é o id do usuário alvo
`src/domain/events/trophy-winner.ts:59-85`. Empate não entra no registro de troféus.

## Notificações

### R-NOT-01 — Lembrete de fechamento: 3 horas antes, uma vez por rodada, para todos os membros aprovados
`src/lib/notifications/notify-closing-reminder.ts:15` · `:38-48`
```ts
export const CLOSING_REMINDER_LEAD_MS = 3 * 60 * 60 * 1000;
const memberIds = await getMemberUserIdsForGroup(groupId);
```
Vai para membros do grupo, não só votantes; respeita a preferência `closingReminder`.

### R-NOT-02 — Preferências por tipo: `result_ready` e `closing_reminder`, ligadas por padrão
`src/db/schema.ts` (`user_notification_preferences`).

### R-NOT-03 — Kill switch global de push
`push_notifications_config` · `src/app/api/admin/push-notifications/toggle/route.ts` (Bearer `CRON_SECRET`).

### R-NOT-04 — Inscrição Web Push inválida é removida no envio
`src/lib/notifications/send-push.ts:52-58` (404/410).
