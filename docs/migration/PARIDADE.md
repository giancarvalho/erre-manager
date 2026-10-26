# Checklist de paridade

Cada funcionalidade do legado (`queridometro@7c5c5bf`) com destino, classificação proposta e sprint. Toda página, route handler e server action do legado aparece em pelo menos uma linha. Atualize a coluna **Status** quando o item for entregue (`pendente` → `feito`, ou `backlog`/`descartado` com aprovação humana).

Classificação: **igual** = migrar como está · **mudança** = migrar com mudança (descrita) · **descartar** · **backlog** = fora do escopo agora.

"Grupo" no legado = comunidade aqui (D-026).

## Core: conta, comunidade e membros

| ID | Funcionalidade | Legado (telas · rotas · actions) | Regras | Classif. | Destino | Sprint | Status |
|---|---|---|---|---|---|---|---|
| CORE-01 | Landing com chamada para criar/entrar | `/` · `src/components/landing/*` | — | mudança: criar comunidade e entrar por convite | core | 18 | pendente |
| CORE-02 | Login com Google | `/login`, `/register` · `api/auth/google`, `api/auth/google/callback` | R-MEM-09 | mudança: Better Auth, sessão no banco (D-017) | core | 5 | concluído na web (aparelho e Google real pendentes) |
| CORE-03 | Login por usuário + chave secreta | `/login`, `/register` · `issueRegisterSecretAction`, `registerAction`, `loginAction`, `checkUsernameAvailabilityAction` | — | descartar (D-017); vínculo de contas no plano de dados | — | — | descartado |
| CORE-04 | Onboarding do nome de exibição | `/onboarding/name` · `updateProfileAction` | R-MEM-08 | igual | core | 5 | concluído |
| CORE-05 | Sessão deslizante e última comunidade visitada | `src/middleware.ts` · `clearLastGroupFromSessionAction`, `refreshSessionLastGroupAction` | R-MEM-09 | mudança: comunidade escolhida no app, nunca na sessão (D-014) | core | 5–6 | sessão deslizante concluída (Sprint 5); comunidade no Sprint 6 |
| CORE-06 | Criar comunidade (assistente: como funciona, identidade, nome, tipo) | modal da landing · `wizardIdentityStepAction`, `createGroupWizardAction` | R-MEM-07 | mudança: qualquer usuário cria comunidade (D-022); o "tipo" (clássico/personalizado) vira configuração inicial do Errômetro | core + errometro | 6, 12 | criar comunidade concluído (Sprint 6); tipo do Errômetro no Sprint 12 |
| CORE-07 | Entrar digitando o nome/código | "Entrar com o nome do grupo" · `lookupGroupByNameAction` | R-MEM-07 | mudança: código de convite revogável em vez do slug público (P-015) | core | 7 | pendente |
| CORE-08 | Pedido de entrada pelo link (com votação junto) | `/group/[id]` (convite universal) · `requestJoinAction` | R-MEM-02, R-MEM-05 | mudança: um pedido só com intenção `errometro.participar` (D-023) | core | 7 | core concluído (intenção pronta no contrato; `errometro.participar` no Sprint 12) |
| CORE-09 | Pedido de entrada só na comunidade | hub · `requestGroupOnlyJoinAction` | R-MEM-02 | igual | core | 7 | concluído |
| CORE-10 | Aprovar, rejeitar, remover membro | `/group/[id]/settings` · `approveMemberAction`, `rejectMemberAction`, `removeMemberAction` | R-MEM-01, R-MEM-03, R-MEM-05 | igual (com cascata para a votação via `onJoinApproved`) | core | 7 | concluído (cascata para módulos via `onMemberLeft`) |
| CORE-11 | Sair da comunidade (criador não sai) | hub · `leaveGroupAction` | R-MEM-06 | mudança: `owner` não sai sem transferir (confirmar no Sprint 7) | core | 7 | concluído (`owner` não sai nem é removido; transferência de posse fica fora da v1) |
| CORE-12 | Hub da comunidade com seções dos módulos | `/group/[id]` | R-RES-06 | mudança: seções vêm dos módulos habilitados | core | 7–8 | concluído (casca no Sprint 7; seções dos módulos no Sprint 8) |
| CORE-13 | Home com minhas comunidades | `/` logado · `src/lib/groups/home-groups.ts` | — | igual | core | 7 | concluído no Sprint 6 (lista, seleção automática e troca) |
| CORE-14 | Página de membro | `/group/[id]/member/[userId]` · `MemberProfileLink` | — | igual | core + módulos | 18 | pendente |
| CORE-15 | Perfil (nome, avatar, troféus, notificações) | `/profile` · `updateProfileAction` | R-MEM-08 | mudança: seções de perfil vêm dos módulos (D-018) | core | 18 | pendente |
| CORE-16 | Push: inscrever, desinscrever | `api/push/subscribe`, `api/push/unsubscribe` · `sw.js`, `RegisterSW.tsx` | R-NOT-04 | mudança: Web Push + Expo Push (D-012) | core | 9 | concluído (web testada sem serviço de push real; nativo depende de aparelho e projeto EAS) |
| CORE-17 | Preferências de notificação | `api/notification-preferences` · `PushNotificationsToggle.tsx` | R-NOT-02 | mudança: genéricas por tipo declarado no manifesto | core | 9 | concluído |
| CORE-18 | Kill switch global de push | `api/admin/push-notifications/toggle` | R-NOT-03 | mudança: variável `PUSH_ENABLED` (P-007) | core | 9 | concluído (`PUSH_ENABLED`, P-007 decidida provisoriamente) |
| CORE-19 | Prompt de notificação na primeira visita | `FirstVisitNotificationPrompt.tsx` | — | mudança: pedir no momento de valor (DESIGN §10.1) | core | 9 | alternância em Notificações concluída; pedido no momento de valor entra no Errômetro (Sprint 14) |
| CORE-20 | Ícones PWA, manifest, apple-icon | `api/pwa-icons/[size]`, `manifest.ts`, `icon.tsx`, `apple-icon.tsx` | — | mudança: ícones estáticos (P-008) | app | 18 | pendente |
| CORE-21 | Imagem OG | `api/og` | — | decidir em P-008 | app/api | 18 | pendente |
| CORE-22 | Links universais iOS | `.well-known/apple-app-site-association` | — | igual (mais `assetlinks.json` Android) | app | 18 | pendente |
| CORE-23 | Páginas de erro | `error.tsx`, `global-error.tsx`, `GlobalErrorCatcher` | — | mudança: `ErrorState` (DESIGN §9.15) | app | 10, 18 | pendente |

## Errômetro

| ID | Funcionalidade | Legado | Regras | Classif. | Destino | Sprint | Status |
|---|---|---|---|---|---|---|---|
| ERR-01 | Pedir participação na votação | hub · `requestVotingAccessAction` | R-MEM-04 | igual | errometro | 12, 14 | API concluída (Sprint 12); tela no 14 |
| ERR-02 | Aprovar, rejeitar, remover votante (limite 50) | settings · `approveVotingAction`, `rejectVotingAction`, `removeVotingAction` | R-MEM-04, D-027 | igual | errometro | 12, 15 | API concluída (Sprint 12); tela no 15 |
| ERR-03 | Chave pública do período | `getVotingPublicKeyAction` | R-CAL-05 | igual | errometro | 12 | concluído (Sprint 12) |
| ERR-04 | Emitir token cego (um por período) | `issueVotingTokenAction` | R-ANON-01, R-ANON-02 | igual | errometro | 12 | concluído (Sprint 12) |
| ERR-05 | Enviar votos anônimos | `api/groups/[id]/vote` | R-ANON-03 a 06 | mudança: rota anônima com comunidade no caminho (ARQUITETURA §4.5) | errometro | 12 | concluído (Sprint 12) |
| ERR-06 | Meus votos pelo `voter_tag` | `api/groups/[id]/my-votes` | R-ANON-07 | igual (rota anônima) | errometro | 12 | concluído (Sprint 12) |
| ERR-07 | Tela de votação (grade, legenda, ordenação, barra de envio) | `/group/[id]/vote` · `src/components/voting/*` | R-ANON-05, R-ANON-06 | mudança: React Native + design system | errometro | 14 | pendente |
| ERR-08 | Votos lembrados no dispositivo | `src/lib/voting/remembered-votes.ts` | — | mudança: AsyncStorage | errometro | 14 | pendente |
| ERR-09 | Token guardado no dispositivo | `src/lib/voting/client-token.ts` | R-ANON-07 | mudança: SecureStore no nativo | errometro | 14 | pendente |
| ERR-10 | Caminho de voto HMAC do demo | `submitVotesAction`, `submitVotesFormAction`, `SubmitVotesBar.tsx` | R-ANON-08, R-ANON-09 | descartar se P-003 descartar o demo | — | — | pendente |
| ERR-11 | Cadência e horário de liberação | settings · `saveGroupReleaseConfigAction` | R-CAL-02, R-CAL-04 | igual (inclui fechamento forçado ao mudar cadência) | errometro | 12, 15 | API concluída (Sprint 12, com fechamento forçado); tela no 15 |
| ERR-12 | Emojis do grupo (catálogo + personalizados) | settings · `saveGroupEmojiConfigAction` | R-EMO-01 a 05 | igual | errometro | 12, 15 | API concluída (Sprint 12); tela no 15 |
| ERR-13 | Fechamento automático das rodadas | `instrumentation.ts`, `api/cron/close-daily-snapshots` | R-RES-01 a 05 | mudança: job do manifesto, por comunidade (D-013) | errometro | 13 | concluído (Sprint 13) |
| ERR-14 | Lembrete 3 h antes de fechar | `api/cron/send-closing-reminders` | R-NOT-01 | mudança: job do manifesto | errometro | 13 | concluído (Sprint 13) |
| ERR-15 | Liberar agora | settings · `releaseGroupResultsNowAction` | R-RES-08 | igual | errometro | 13, 15 | API concluída (Sprint 13); tela no 15 |
| ERR-16 | Recalcular rodada | `api/groups/[id]/recompute-snapshot` | R-RES-03, R-RES-08 | igual | errometro | 13, 15 | API concluída (Sprint 13); tela no 15 |
| ERR-17 | Ocultar/mostrar rodada | `api/groups/[id]/hide-snapshot` | R-RES-07, R-RES-08 | igual | errometro | 13, 15 | API concluída (Sprint 13); tela no 15 |
| ERR-18 | Anular voto por código | `annulVoteByTagAction` | R-RES-09 | igual | errometro | 13, 15 | API concluída (Sprint 13); tela no 15 |
| ERR-19 | Resultados: ranking, dias, troféus, compartilhar | `/results` · `src/components/results/*`, `share-message.ts` | R-RES-06, R-RES-10, R-TRO-01 a 03 | mudança: React Native | errometro | 13, 15 | API e mensagem de compartilhamento concluídas (Sprint 13); tela no 15 |
| ERR-20 | Comentários nos resultados | `postCommentAction`, `editCommentAction`, `deleteCommentAction`, `getCommentsAction` | R-COM-01, R-COM-02 | igual | errometro | 13, 15 | API concluída (Sprint 13); tela no 15 |
| ERR-21 | Troféus no perfil | `group-trophy-tally.ts`, `src/components/trophies/*` | R-TRO-01 | mudança: `profileSections` (D-018) | errometro | 13, 18 | API concluída (Sprint 13, seção de perfil `errometro.trofeus`); tela no 18 |
| ERR-22 | Tela "Resultados reservados" | `ResultsPaywall.tsx` | R-RES-06 | descartar com o demo (P-003) | — | — | pendente |

## Eventos

| ID | Funcionalidade | Legado | Regras | Classif. | Destino | Sprint | Status |
|---|---|---|---|---|---|---|---|
| EVT-01 | Lista de eventos (admin e membro) | `/group/[id]/events` | — | mudança: por comunidade (D-026) | eventos | 16, 17 | pendente |
| EVT-02 | Criar e editar rascunho | `/group/[id]/events/new` · `createVotingEventAction`, `updateVotingEventDraftAction` | R-EVT-04, R-EVT-05 | igual | eventos | 16, 17 | pendente |
| EVT-03 | Configurar emojis/eixos do evento | `saveVotingEventEmojiConfigAction` | R-EVT-05 | igual | eventos | 16, 17 | pendente |
| EVT-04 | Publicar (abrir inscrições) | `openApplicationsAction` | R-EVT-02, R-EVT-03 | igual | eventos | 16 | pendente |
| EVT-05 | Sala de espera e inscrição pelo link | `/group/[id]/events/[eventId]` · `event-participation.ts` | R-EVT-07 | mudança a decidir (P-014) | eventos | 16, 17 | pendente |
| EVT-06 | Abrir votação (manual ou agendada) | `openVotingAction`, `api/cron/open-scheduled-events` | R-EVT-06 | mudança: job do manifesto | eventos | 16 | pendente |
| EVT-07 | Votar (categórico e escala) | `/group/[id]/events/[eventId]/vote` · `getEventVotingPublicKeyAction`, `issueEventVotingTokenAction`, `api/events/[id]/vote` | R-ANON-01 a 06, R-EVT-09 | mudança: React Native, rota anônima | eventos | 16, 17 | pendente |
| EVT-08 | Meus votos no evento | `api/events/[id]/my-votes` | R-ANON-07 | igual | eventos | 16 | pendente |
| EVT-09 | Fechar (manual ou agendado) e calcular | `closeVotingEventAction`, `api/cron/close-scheduled-events` | R-EVT-01, R-EVT-08, R-EVT-09 | igual | eventos | 16 | pendente |
| EVT-10 | Resultados do evento e compartilhar | `/group/[id]/events/[eventId]/results` · `event-share-message.ts` | R-EVT-10 | mudança: React Native | eventos | 17 | pendente |
| EVT-11 | Excluir evento (suave) | `deleteVotingEventAction` | R-EVT-01 | igual | eventos | 16 | pendente |
| EVT-12 | Troféus de evento no perfil | `event-trophy-wins.ts`, `EventScaleTrophyList.tsx` | R-EVT-10 | mudança: `profileSections` | eventos | 16, 18 | pendente |
| EVT-13 | Banners de evento no hub | `EventOpenBanner`, `EventApplicationsBanner`, `EventResultsBanner` | — | mudança: seção do módulo no hub | eventos | 17 | pendente |

## Fora do escopo ou descartado

| ID | Funcionalidade | Legado | Classif. | Status |
|---|---|---|---|---|
| OUT-01 | Mural/apresentações e reações | `/group/[id]/wall` · `submitPresentationAction`, `deletePresentationAction`, `setPresentationTemplateAction`, `toggleReactionAction`, `src/components/wall/*` | backlog (D-004) | backlog |
| OUT-02 | Grupo demo | `demo` virtual, `SubmitVotesBar`, `ResultsPaywall` | descartar? (P-003) | pendente |
| OUT-03 | Shell Capacitor | `android/`, `ios/`, `capacitor.config.ts` | descartar (substituído por Expo, D-001) | descartado |
| OUT-04 | Scripts de diagnóstico e `drop-all-records` | `scripts/*` | descartar | descartado |
