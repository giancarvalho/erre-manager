# Mapeamento de dados: legado → novo

Insumo para o plano de dados (D-016). Cada sprint que cria tabelas atualiza a coluna **Tabela nova** e as transformações. Decisões de base: cada grupo do legado vira uma comunidade (D-028); a membership do grupo vira membership da comunidade; a aprovação de votação vira participação no Errômetro (D-026).

Legado: `queridometro@7c5c5bf`, `src/db/schema.ts` e `drizzle/0000–0024`.

| Tabela legada | Destino | Tabela nova (proposta) | Transformação e observações |
|---|---|---|---|
| `app_users` | core | `auth_user` (Better Auth) + `core_profiles` | `display_username` → `core_profiles.display_name`; `avatar_variant` → `core_profiles.avatar_variant`; `email`/`google_id` → conta Google do Better Auth (`auth_account`). `username_key` e `secret_hash` não migram (D-017); usuários sem `google_id` precisam de vínculo (pergunta do plano de dados). |
| `groups` | core | `communities` | Um registro por grupo (D-028). `id` (slug texto) → `communities.slug`; novo `id uuid`. `name` → `name`. `created_by` → membership `owner`. `invite_code` (= slug) → `core_community_invites.code`, gerar código novo e revogável (P-015). |
| `group_members` | core + errometro | `core_community_memberships` + `errometro_participants` | `status` → `core_community_memberships.status`; papel `owner` para o criador, `membro` para os demais. `voting_status` (não nulo) → `errometro_participants.status`. `reviewed_at`/`reviewed_by` vão junto. |
| `votes` | errometro | `errometro_votes` | `group_id` → `community_id` (via slug); `voting_day` → `period`; `voter_tag`, `target_id` (agora `uuid`), `emoji_id`, `voted_at` iguais. `target_id` é o id de usuário do legado: mapear para o id novo do usuário. Linhas do grupo `demo` são descartadas. |
| `group_comments` | errometro | `errometro_comments` | `group_id` → `community_id`; `author_id` → id novo; `author_name` deixa de ser guardado (lido do perfil). |
| `voting_signing_keys` | errometro | `errometro_signing_keys` | `voting_day` → `period`. Só a chave do período em andamento importa na virada (votos de períodos fechados já estão no snapshot). Plano de virada decide se migra. |
| `voting_token_issuances` | errometro | `errometro_token_issuances` | `voting_day` → `period`; continua sem horário (R-ANON-02). Mesma observação: só o período em andamento. |
| `daily_vote_snapshots` | errometro | `errometro_snapshots` | `voting_day` → `period`. `payload` vira só `{ targets }` (`groupId` e `votingDay` saem; já estão nas colunas) e contém ids de usuário do legado (alvos): reescrever ids no ETL. `hidden`, `notified_at`, `created_at` (âncora, R-RES-03) preservados. |
| `group_release_config` | errometro | `errometro_release_config` | Colunas iguais (`frequency`, `release_hour`, `release_weekday`, `release_weekdays`). Valores de `frequency` legados (`daily`, `weekly`) continuam válidos (R-CAL-02). |
| `group_emoji_config` | errometro | `errometro_emoji_config` | Personalizados inativos também migram (R-EMO-04). |
| `release_reminders` | errometro | `errometro_release_reminders` | `voting_day` → `period`. Só o período em andamento importa. |
| `push_subscriptions` | core | `core_push_subscriptions` (`kind = webpush`) | `user_id` → id novo. Inscrições do domínio antigo podem não valer no domínio novo do app web; o plano de virada decide. |
| `push_notifications_config` | — | — | Vira variável `PUSH_ENABLED` (P-007). |
| `user_notification_preferences` | core | `core_notification_preferences` | `result_ready` → tipo `errometro.resultado_pronto`; `closing_reminder` → `errometro.lembrete_fechamento`. |
| `voting_events` | eventos | `eventos_events` | `group_id` → `community_id`; `created_by` → id novo; demais colunas iguais, `deleted_at` incluído. Índice único parcial `eventos_events_one_live_idx` (um evento ao vivo por comunidade, R-EVT-03): o ETL confere que nenhum grupo tem dois eventos em `accepting_applications`/`open` não excluídos. |
| `voting_event_emoji_config` | eventos | `eventos_emoji_config` | Ganha `community_id` (D-015, FK composta para o evento); colunas iguais. |
| `voting_event_votes` | eventos | `eventos_votes` | Ganha `community_id`; `target_id` (agora `uuid`) → id novo; `voter_tag`, `emoji_id`, `value`, `voted_at` iguais. Chave primária igual (com `community_id`). |
| `voting_event_signing_keys` | eventos | `eventos_signing_keys` | Ganha `community_id`. Só eventos em andamento (`open`) precisam da chave na virada. |
| `voting_event_token_issuances` | eventos | `eventos_token_issuances` | Ganha `community_id`; `user_id` → id novo; continua sem horário (R-ANON-02). Só eventos em andamento. |
| `voting_event_snapshots` | eventos | `eventos_snapshots` | Ganha `community_id`. `payload` (`votingType`, `targets`, `trophies`) igual no formato, com ids de usuário do legado em `targetId`, `winnerTargetId` e `tiedTargetIds`: reescrever. `notified_at` do legado nunca foi preenchido (não havia push de evento): migrar preenchido com `created_at` para nenhum evento antigo notificar na virada. |
| `event_trophy_wins` | eventos | `eventos_trophy_wins` | `group_id` → `community_id`; `winner_user_id` → id novo; `magnitude` (`numeric(8,2)`), `voting_type`, `won_at` iguais. |
| `event_participants` | eventos | `eventos_participants` | Ganha `community_id`; `user_id` → id novo; `applied_at` igual. Com P-014 B, participantes de eventos ainda abertos que não são membros aprovados do grupo ficam de fora (eventos fechados migram inteiros: o resultado já está no snapshot). |
| `presentations` | backlog | — | Fora do escopo (D-004); preservar no backup do legado. |
| `presentation_reactions` | backlog | — | Idem. |
| `group_presentation_config` | backlog | — | Idem. |

## Pontos de atenção para o ETL

1. **Ids de usuário dentro de JSON** (`payload` dos snapshots) e em colunas texto sem FK (`votes.target_id`, `group_comments.author_id`): o ETL precisa de uma tabela de correspondência id antigo → id novo.
2. **Grupo demo** não tem linhas em `groups`, mas pode ter votos com `group_id = 'demo'`: descartar.
3. **Pessoas em vários grupos** viram memberships em várias comunidades (D-028).
4. **Fuso**: `voting_day` e `voted_at` dependem de `VOTING_TIMEZONE` (D-020); manter o mesmo valor na virada.
5. `db/schema.sql` e `db/migrations/001_votes_voter_tag.sql` são resquícios; a fonte do schema é `src/db/schema.ts` + `drizzle/`.
