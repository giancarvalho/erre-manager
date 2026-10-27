# Mapeamento de dados: legado → novo

Insumo para o plano de dados (D-016). Cada sprint que cria tabelas atualiza a coluna **Tabela nova** e as transformações. Decisões de base: cada grupo do legado vira uma comunidade (D-028); a membership do grupo vira membership da comunidade; a aprovação de votação vira participação no Errômetro (D-026).

Legado: `queridometro@7c5c5bf`, `src/db/schema.ts` e `drizzle/0000–0024`. Revisado no Sprint 19 contra o schema migrado inteiro: as 25 tabelas do legado têm destino, e toda tabela nova está na lista abaixo.

**Ids de usuário preservados.** `auth_user.id` é `uuid`, como `app_users.id`: o ETL grava cada pessoa com o **mesmo id** do legado. Com isso, as colunas e os `payload` que guardam ids de usuário migram sem reescrita. Testado em `packages/core/test/auth.test.ts` ("users created by the data migration"): quem tem `google_id` entra com o Google e cai no mesmo id e perfil; quem é criado só com e-mail é vinculado no primeiro login Google com esse e-mail.

| Tabela legada | Destino | Tabela nova (proposta) | Transformação e observações |
|---|---|---|---|
| `app_users` | core | `auth_user` + `auth_account` + `core_profiles` | `id` igual. `auth_user`: `name` = `display_username`, `email` (obrigatório e único no novo), `email_verified = true`, `created_at` igual. `auth_account`: `provider_id = 'google'`, `account_id = google_id` (o `sub` do Google, o mesmo que o Better Auth usa). `core_profiles`: `display_name` = `display_username`, `avatar_variant` igual, `name_confirmed_at` = `created_at` (no legado todo mundo escolheu o nome: no cadastro ou no onboarding do Google), sem a tela de confirmar nome na virada. `username_key` e `secret_hash` não migram (D-017). **Contas só com usuário + chave** não têm e-mail: P-020. Pessoa com duas contas no legado: P-021. |
| `groups` | core | `communities` + `core_role_permissions` + `core_community_invites` | Um registro por grupo (D-028). `id` (slug texto) → `communities.slug`; novo `id uuid` (tabela de correspondência slug → id para as tabelas filhas). `name`, `created_at` iguais. `created_by` → membership `owner`. Permissões padrão por papel: o ETL chama `seedRolePermissions` (como `createCommunity`), sem copiar nada. `invite_code` (= slug) não migra: um convite novo (`secret` aleatório, `intent` nulo, `created_by` = dono) por comunidade, porque o link antigo é adivinhável (P-015). |
| `group_members` | core + errometro | `core_community_memberships` + `errometro_participants` | `status`, `requested_at`, `reviewed_at`, `reviewed_by` iguais; papel `owner` para o criador, `membro` para os demais; `join_intent` nulo. `voting_status` (não nulo) → `errometro_participants.status`; o legado não guarda quando a votação foi pedida nem quem aprovou, então `requested_at` = `group_members.requested_at` e `reviewed_*` nulos. |
| `votes` | errometro | `errometro_votes` | `group_id` → `community_id` (via slug); `voting_day` → `period`; `voter_tag`, `emoji_id`, `voted_at` iguais; `target_id` texto → `uuid` (mesmo id). Linhas do grupo `demo` são descartadas. |
| `group_comments` | errometro | `errometro_comments` | `group_id` → `community_id`; `target_member_id` → `target_id` e `author_id` texto → `uuid` (mesmo id); `voting_day` → `period`; `text`, `created_at`, `updated_at` iguais. `author_name` deixa de ser guardado (lido do perfil). |
| `voting_signing_keys` | errometro | `errometro_signing_keys` | `voting_day` → `period`. Só a chave do período em andamento importa na virada (votos de períodos fechados já estão no snapshot). Plano de virada decide se migra. |
| `voting_token_issuances` | errometro | `errometro_token_issuances` | `voting_day` → `period`; continua sem horário (R-ANON-02). Mesma observação: só o período em andamento. |
| `daily_vote_snapshots` | errometro | `errometro_snapshots` | `voting_day` → `period`. `payload` vira só `{ targets }` (`groupId` e `votingDay` saem; já estão nas colunas); os ids de alvo ficam como estão. `hidden`, `notified_at`, `created_at` (âncora, R-RES-03) preservados. |
| `group_release_config` | errometro | `errometro_release_config` | Colunas iguais (`frequency`, `release_hour`, `release_weekday`, `release_weekdays`). Valores de `frequency` legados (`daily`, `weekly`) continuam válidos (R-CAL-02). |
| `group_emoji_config` | errometro | `errometro_emoji_config` | Personalizados inativos também migram (R-EMO-04). |
| `release_reminders` | errometro | `errometro_release_reminders` | `voting_day` → `period`. Só o período em andamento importa. |
| `push_subscriptions` | core | `core_push_subscriptions` (`kind = webpush`) | `id`, `user_id`, `endpoint`, `created_at` iguais; `p256dh`/`auth` → `keys` (`{ p256dh, auth }`); `last_seen_at` = `created_at`. Inscrições do domínio antigo podem não valer no domínio novo do app web; o plano de virada decide. |
| `push_notifications_config` | — | — | Vira variável `PUSH_ENABLED` (P-007). |
| `user_notification_preferences` | core | `core_notification_preferences` | Uma linha por (pessoa, tipo): `result_ready` → `errometro.resultado_pronto`; `closing_reminder` → `errometro.lembrete_fechamento`; `updated_at` igual. Sem linha continua significando ligado. |
| `voting_events` | eventos | `eventos_events` | `group_id` → `community_id`; `id`, `created_by` e demais colunas iguais, `deleted_at` incluído. Índice único parcial `eventos_events_one_live_idx` (um evento ao vivo por comunidade, R-EVT-03): o ETL confere que nenhum grupo tem dois eventos em `accepting_applications`/`open` não excluídos. |
| `voting_event_emoji_config` | eventos | `eventos_emoji_config` | Ganha `community_id` (D-015, FK composta para o evento); colunas iguais. |
| `voting_event_votes` | eventos | `eventos_votes` | Ganha `community_id`; `target_id` texto → `uuid` (mesmo id); `voter_tag`, `emoji_id`, `value`, `voted_at` iguais. Chave primária igual (com `community_id`). |
| `voting_event_signing_keys` | eventos | `eventos_signing_keys` | Ganha `community_id`. Só eventos em andamento (`open`) precisam da chave na virada. |
| `voting_event_token_issuances` | eventos | `eventos_token_issuances` | Ganha `community_id`; `user_id` igual; continua sem horário (R-ANON-02). Só eventos em andamento. |
| `voting_event_snapshots` | eventos | `eventos_snapshots` | Ganha `community_id`. `payload` (`votingType`, `targets`, `trophies`) igual, ids incluídos. `notified_at` do legado nunca foi preenchido (não havia push de evento): migrar preenchido com `created_at` para nenhum evento antigo notificar na virada. |
| `event_trophy_wins` | eventos | `eventos_trophy_wins` | `group_id` → `community_id`; `winner_user_id` igual; `magnitude` (`numeric(8,2)`), `voting_type`, `won_at` iguais. |
| `event_participants` | eventos | `eventos_participants` | Ganha `community_id`; `user_id`, `applied_at` iguais. Com P-014 B, participantes de eventos ainda abertos que não são membros aprovados do grupo ficam de fora (eventos fechados migram inteiros: o resultado já está no snapshot). |
| — | core | `auth_session`, `auth_verification` | Não migram: todo mundo entra de novo com o Google na virada (as sessões do legado são JWE próprias). |
| — | db | `erre_migrations` | Do runner de migrations; não é dado. |
| `presentations` | backlog | — | Fora do escopo (D-004); preservar no backup do legado. |
| `presentation_reactions` | backlog | — | Idem. |
| `group_presentation_config` | backlog | — | Idem. |

## Pontos de atenção para o ETL

1. **Ids de usuário em colunas texto sem FK** (`votes.target_id`, `group_comments.*`, `voting_event_votes.target_id`) e dentro dos `payload`: com os ids preservados, não há reescrita, e o novo também não tem FK nelas. Um id que não for de usuário migrado fica como está, igual ao de uma pessoa excluída (`docs/lgpd.md`); o relatório do ETL lista quantos são. Só os **ids de grupo** mudam (slug → uuid).
2. **Grupo demo** não tem linhas em `groups`, mas pode ter votos com `group_id = 'demo'`: descartar.
3. **Pessoas em vários grupos** viram memberships em várias comunidades (D-028).
4. **Fuso**: `voting_day` e `voted_at` dependem de `VOTING_TIMEZONE` (D-020); manter o mesmo valor na virada.
5. `db/schema.sql` e `db/migrations/001_votes_voter_tag.sql` são resquícios; a fonte do schema é `src/db/schema.ts` + `drizzle/`.
6. **Ordem de carga:** usuários (`auth_user`, `auth_account`, `core_profiles`) → comunidades, permissões e convites → memberships → tabelas dos módulos, cada comunidade numa transação com `app.community_id` definido (RLS), como `erre_migrator`.
7. **Exclusões pedidas antes da virada** (LGPD, `docs/lgpd.md`): quem pediu para sair não é migrado; os votos anônimos e resultados fechados ficam com o id sem dono, como na exclusão do app novo.

## Vínculo de contas (insumo para o humano)

| Tipo de conta no legado | Como entra no app novo | Situação |
|---|---|---|
| Google (`google_id` preenchido) | login Google, mesmo id, perfil e histórico | pronto (testado) |
| Usuário + chave (sem e-mail) | precisa de um e-mail Google informado pela pessoa | P-020 |
| Mesma pessoa com as duas contas | duas identidades com históricos separados | P-021 |

Para dimensionar: `SELECT count(*) FILTER (WHERE google_id IS NULL), count(*) FILTER (WHERE google_id IS NOT NULL) FROM app_users;` numa **cópia** do banco do legado (quem roda é o humano).
