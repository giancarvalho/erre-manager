# Segurança: revisão do Sprint 19

Revisão de autorização, validação, limites, CORS, cookies, headers e logs da API (`apps/api`, `packages/core`, `modules/*`). Cada item aponta o teste que o garante.

## Autorização e validação por rota

Toda rota de módulo passa pelo runtime: sessão (401 sem), comunidade do `X-Community-Id` validada contra uma membership aprovada (403), transação com RLS da comunidade e, dentro da rota, `ctx.can('<permissão>')`. Rotas anônimas não têm sessão nem membership: a comunidade e o direito de votar vêm da assinatura cega (ARQUITETURA §4.5).

| Rota | Quem | Permissão / regra | Entrada validada (Zod) |
|---|---|---|---|
| **Core** `GET /v1/health` | público | — | — |
| `GET /v1/me`, `PATCH /v1/me/profile`, `GET /v1/me/communities`, `GET /v1/me/requests` | sessão | a própria pessoa | `ProfilePatchSchema` |
| `GET /v1/invites/:code` | público | código de convite (72 bits aleatórios) | `CodeParams` |
| `POST /v1/invites/:code/join` | sessão | convite válido e não revogado | `CodeParams` |
| `POST /v1/communities` | sessão | qualquer pessoa cria | `CreateCommunitySchema` |
| `GET /v1/communities/:id`, `.../members`, `.../leave` | membro aprovado | a própria comunidade (`sameCommunity`) | params |
| `PATCH /v1/communities/:id/members/:userId` (papel) | membro aprovado | `core.membros.gerenciar` | `MemberParams`, `RolePatchSchema` |
| `.../requests`, `.../approve`, `.../reject`, `.../remove` | membro aprovado | `core.membros.gerenciar` | `MemberParams` |
| `.../invites`, `.../invites/:inviteId/revoke` | membro aprovado | `core.convites.gerenciar` | params + corpo |
| `GET /v1/push/config` | público | só a chave pública VAPID | — |
| `/v1/push/subscriptions`, `/v1/notification-preferences` | sessão | a própria pessoa | schemas próprios |
| `GET /v1/profile/:userId/sections` | membro aprovado | o alvo precisa ser membro aprovado | `userId` uuid |
| `POST /v1/internal/jobs/:id/run` | `Authorization: Bearer $CRON_SECRET` | comparação em tempo constante; sem o segredo a rota não existe | `id` |
| **Errômetro** `GET /rodada`, `/participacao`, `/resultados`, `/comentarios` | membro | `errometro.ver` | query |
| `POST /participacao`, `GET /chave`, `POST /token` | membro | `errometro.votar` (+ participação aprovada em chave/token) | `TokenRequestSchema` |
| moderação (`/participantes*`, `/config/*`, `/rodada/liberar`, `/rodadas*`, `/votos/anular`) | membro | `errometro.moderar` | params + corpo |
| comentários (criar, editar, apagar) | membro | `errometro.ver`; editar só o autor; apagar autor ou moderador | `CommentText`, uuid |
| `POST anon/c/:c/votos`, `/meus-votos` | anônimo | assinatura cega da chave da rodada dessa comunidade / tag de 256 bits | `BallotSchema`, `MyVotesSchema` |
| **Eventos** `GET /`, `GET /:id`, `GET /:id/resultados` | membro | `eventos.ver`; rascunho só para quem cria ou modera | uuid |
| `POST /`, `PATCH /:id`, `PUT /:id/emojis` | membro | `eventos.criar` | `NewEventSchema`, `DraftPatchSchema`, `EventEmojiEntriesSchema` |
| `POST /:id/publicar`, `/abrir`, `/encerrar`, `DELETE /:id` | membro | `eventos.moderar` | uuid |
| `POST /:id/inscricao`, `GET /:id/chave`, `POST /:id/token` | membro | `eventos.votar` (+ inscrito e evento aberto em chave/token) | uuid, `TokenRequestSchema` |
| `POST anon/c/:c/:eventId/votos`, `/meus-votos` | anônimo | assinatura cega da chave desse evento | `EventBallotSchema`, `MyVotesSchema` |

Testes: matrizes de permissão (`permissionMatrix`) em `apps/api/test/integration/modules.test.ts`, `modules/errometro/tests/integration/*` e `modules/eventos/tests/integration/lifecycle.test.ts`; isolamento entre comunidades nos mesmos arquivos; anonimato em `voting.test.ts` dos dois módulos.

## Limites de requisição

| Onde | Chave | Limite (padrão) | Teste |
|---|---|---|---|
| `/v1/auth/*` (Better Auth) | IP | 100/min; entrar e callback 30/min | `packages/core/test/rate-limit.test.ts` |
| rotas de módulo | pessoa | 300/min | `modules/errometro/tests/integration/rate-limit.test.ts` |
| emissão de token (`POST .../token`) | pessoa | 10/min | idem |
| rotas anônimas | **comunidade** (nunca IP) | 600/min | idem |

Os contadores ficam em memória: valem para uma instância da API. Com mais de uma, o limite vira por instância (aceitável na escala atual; um store compartilhado entra se escalar). Inundação por IP nas demais rotas fica com o proxy reverso da hospedagem (P-010).

## Navegador e transporte

- **CORS:** só as origens web de `TRUSTED_ORIGINS`, com credenciais; headers aceitos: `content-type`, `x-community-id` (`apps/api/test/integration/auth.test.ts`).
- **Origem e callback:** Better Auth recusa origem não confiável com cookie; callbacks só para origens confiáveis e o esquema do app (`packages/core/test/auth.test.ts`).
- **Cookie de sessão em HTTPS:** `__Secure-erre.session_token`, `HttpOnly`, `Secure`, `SameSite=Lax` (`apps/api/test/integration/auth.test.ts`). A sessão não guarda IP nem user agent.
- **Headers da API:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS e `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (`apps/api/test/app.test.ts`). Os headers do app web estático dependem da hospedagem (P-010) e entram no Sprint 19 com o deploy.

## Logs

- Log de requisição: método, caminho, status e duração. Sem headers, query string, corpo ou IP.
- Rotas anônimas: o runtime repassa só `content-type`, `accept` e `accept-language`; um teste manda cookie e `X-Forwarded-For` e confere que nada identificável chega ao log (`modules/*/tests/integration/voting.test.ts`).
- Erros inesperados: só o nome do erro vai para o log (sem mensagem, que pode conter dados).

## Pendente

- Headers e HTTPS do app web: na configuração da hospedagem (P-010).
- Revisão de dependências (`pnpm audit`) no CI: proposta para o Sprint 19, junto com o deploy.
