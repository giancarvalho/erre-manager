# Plano de migração em sprints

Plano para migrar o Errômetro (legado `giancarvalho/queridometro@7c5c5bf`) para a plataforma modular deste repositório. Feito para ser executado por agentes, um sprint por vez, com revisão humana entre sprints.

Leia antes: [`AGENTS.md`](../../AGENTS.md), [`ARQUITETURA.md`](ARQUITETURA.md), [`DECISOES.md`](DECISOES.md), [`PERGUNTAS.md`](PERGUNTAS.md).

## Como usar

- **Sprint** aqui é uma unidade de entrega revisável, não um prazo fixo. O tamanho (P/M/G) é relativo: P ≈ 1–2 dias de agente, M ≈ 3–5, G ≈ 5–8, sem contar revisão humana.
- Cada sprint tem: objetivo, dependências, referências no legado, tarefas, entregáveis, critérios de aceite, testes obrigatórios, riscos/critérios de parada e gate.
- Branch `sprint-NN-<slug>`, PR com o relatório (formato em `AGENTS.md`). O merge do PR pelo humano é a aprovação.
- **Gate humano** = revisão explícita obrigatória antes de qualquer sprint dependente começar.
- Caminhos `legado:...` referem-se ao repositório legado no commit de referência.
- Ao terminar, marque o sprint como concluído na tabela abaixo (no mesmo PR).

## Visão geral

| # | Sprint | Tam. | Depende de | Gate humano | Status |
|---|---|---|---|---|---|
| 1 | Inventário e checklist de paridade (somente leitura) | M | — | **sim** | concluído |
| 2 | Protótipo Expo: decisão de go/no-go | G | 1 (parcial) | **sim** | concluído (validação em aparelho pendente) |
| 3 | Monorepo, ferramentas e CI | M | 2 | não | concluído (aparelho pendente) |
| 4 | `packages/db`: papéis, RLS e migrations | M | 3 | **sim** | concluído (revisão humana assíncrona, D-029) |
| 5 | Auth e perfil | M | 4 | não | concluído na web (aparelho e Google real pendentes) |
| 6 | Comunidades, papéis, `can()` e contexto da requisição | M | 5 | **sim** | concluído (revisão humana assíncrona, D-029) |
| 7 | Convites, entrada e membros da comunidade | M | 6 | não | concluído |
| 8 | Runtime de módulos (contrato v0) e shell do app | G | 7 | **sim** | concluído (revisão do contrato pendente, D-029) |
| 9 | `notify()` e push (Web Push + Expo Push) | M | 8 | não | concluído (aparelho e chaves reais pendentes) |
| 10 | `packages/ui`: design system | M | 3 | não | concluído (aparelho pendente) |
| 11 | Pacotes compartilhados: `anon-vote` e `emoji` | M | 3 | não | concluído (aparelho pendente) |
| 12 | Errômetro API I: participação, voto anônimo, configuração | G | 8, 11 | não | concluído |
| 13 | Errômetro API II: fechamento, resultados, comentários, troféus | G | 9, 12 | não | concluído |
| 14 | Errômetro UI I: hub e votação | G | 10, 12 | não | pendente |
| 15 | Errômetro UI II: resultados e administração | G | 13, 14 | **sim** | pendente |
| 16 | Eventos API | G | 9, 11, 8 | não | pendente |
| 17 | Eventos UI | G | 10, 16 | **sim** | pendente |
| 18 | Perfil, troféus, página de membro, preferências e PWA | M | 15, 17 | não | pendente |
| 19 | Segurança, LGPD, deploy e paridade final | G | 18 | **sim** | pendente |
| 20 | Template de módulo e preparação do hackathon | M | 19 | **sim** | pendente |

### Trilhas paralelas

Depois do Sprint 3, três trilhas podem andar em paralelo, com agentes diferentes:

```
Trilha core:      4 → 5 → 6 → 7 → 8 → 9
Trilha UI:        10
Trilha pacotes:   11

Errômetro API:    12 (precisa de 8, 11) → 13 (+ 9)
Errômetro UI:     14 (precisa de 10, 12) → 15 (+ 13)
Eventos:          16 (precisa de 8, 9, 11) → 17 (+ 10)
Fechamento:       18 (precisa de 15, 17) → 19 → 20
```

Os sprints 12 e 16 podem rodar em paralelo depois do 8, 9 e 11. Dois agentes nunca editam o mesmo pacote ao mesmo tempo sem combinar no PR.

## Definição de pronto global (vale para todo sprint)

- [ ] `pnpm turbo run lint typecheck test build` verde localmente e no CI (a partir do Sprint 3).
- [ ] Testes de isolamento de RLS e de cobertura de RLS verdes (a partir do Sprint 4).
- [ ] Toda rota nova tem validação Zod, checagem de permissão e teste da matriz papel × permissão.
- [ ] Nenhum `any` sem justificativa, nenhum segredo, nenhum dado pessoal em log.
- [ ] Bibliotecas novas registradas em `docs/libs-aprovadas.md` com as plataformas testadas.
- [ ] Tabelas novas registradas em `MAPEAMENTO-DADOS.md` (D-016).
- [ ] Itens de `PARIDADE.md` atualizados.
- [ ] Telas novas verificadas em web, Android e iOS (print ou nota no relatório).
- [ ] Interface segue [`docs/design/DESIGN.md`](../design/DESIGN.md) nos dois temas (escuro, padrão, e claro), com o checklist da §14 preenchido no PR.
- [ ] Relatório em `docs/migration/relatorios/sprint-NN.md` e no PR.

---

## Sprint 1 — Inventário e checklist de paridade (somente leitura)

**Objetivo:** conhecer o legado a fundo e transformar cada funcionalidade em item verificável de paridade. Nenhum código é escrito neste repositório além de documentação.

**Depende de:** nada. **Gate humano:** sim (revisar inventário, responder perguntas, confirmar classificação).

**Referências no legado:** todo o repositório. Pontos de partida:
- Schema: `legado:src/db/schema.ts`, `legado:drizzle/*.sql` (25 migrations), `legado:db/schema.sql` e `legado:db/migrations/` (verificar se ainda valem ou são resquício).
- Jobs: `legado:src/instrumentation.ts`, `legado:src/lib/jobs/*`, `legado:src/app/api/cron/*`.
- Domínio: `legado:src/domain/{voting,events,notifications}/*`, `legado:src/lib/*`.
- Páginas (16): `/`, `/login`, `/register`, `/onboarding/name`, `/profile`, `/results`, `/group/[id]`, `/group/[id]/vote`, `/group/[id]/settings`, `/group/[id]/member/[userId]`, `/group/[id]/wall`, `/group/[id]/events`, `/group/[id]/events/new`, `/group/[id]/events/[eventId]`, `.../results`, `.../vote`.
- Route handlers (19) em `legado:src/app/api/**` e `legado:src/app/.well-known/**`.
- Server actions (~45) em `legado:src/app/actions/*` e `legado:src/lib/**/\*actions*.ts`.

**Tarefas:**
1. Clonar o legado no commit `7c5c5bf` em diretório de leitura. Instalar dependências e rodar `npm test` (Vitest) **sem `.env` real**. Se for viável, subir Postgres local e rodar `npm run test:e2e` conforme `legado:e2e/README.md`. Registrar resultado e falhas.
2. Escrever `docs/migration/INVENTARIO.md` com:
   - Stack e versões (Node, Next, React, Drizzle, libs), scripts do `package.json`, estrutura de pastas (2–3 níveis).
   - Renderização: App Router, Server Components, Server Actions, Route Handlers, middleware (`legado:src/middleware.ts`), `instrumentation.ts`.
   - PWA: `legado:public/sw.js` (estratégia), registro (`RegisterSW.tsx`), manifest, ícones dinâmicos, Web Push.
   - Shell Capacitor (`capacitor.config.ts`, `android/`, `ios/`, `docs/mobile-publishing.md`).
   - Deploy real (Docker + SSH, `.github/workflows/prod.yml`, `Dockerfile`, `entrypoint.sh`), e o fato de o README citar Vercel.
   - Dados: as ~27 tabelas com colunas, chaves, índices e comentários de intenção; onde estão as consultas (`infrastructure/*` com repositórios Postgres e em memória, fachada `lib/persistence`).
   - Auth: sessão JWE em cookie (`jose`), login por usuário + segredo, Google OAuth próprio, papel de admin (criador do grupo), onde é verificado.
   - Variáveis de ambiente (só nomes).
   - UI: bibliotecas (Tailwind, framer-motion, lucide-react, sonner, emoji-picker-react), uso de APIs só-web por arquivo, dependências sem equivalente em RN.
   - Qualidade: testes (106 arquivos), cobertura aproximada, CI sem testes.
3. Escrever `docs/migration/REGRAS.md`: toda regra de negócio implícita **copiada literalmente** com `arquivo:linha`. Cobrir no mínimo: calendário e virada de rodada (`calendar.ts`, `release-window.ts`, `group-release-schedule.ts`, `anonymous-voting.ts` → `resolveVotingDay`); cadências (`daily`, `weekly` legado, `custom`, `manual`, `releaseHour`, `releaseWeekdays`) e a `ACTIVE_RELEASE_CONFIG` citada nos comentários; assinatura cega e `voter_tag` (`blind-signature.ts`, `voter-tag.ts`, se o caminho HMAC com `VOTER_TAG_SECRET` ainda é usado); emissão sem timestamp; agregação (`aggregate-votes.ts`); troféus (`trophies.ts`, `trophy-catalog.ts`, mínimo de 3 votos em eventos); limites (`MAX_GROUP_MEMBERS=300`, `MAX_VOTING_MEMBERS=50`, emojis 1–15, limites de eventos); fluxos de membership e de votação (`join-group.ts`, `hub-access.ts`, `membership-access.ts`, a diferença entre `requestJoinAction` e `requestGroupOnlyJoinAction`); anulação por código (`annul-vote.ts`); liberar agora, recalcular, ocultar rodada; claim-once de notificações (`notified_at`, `release_reminders`); máquina de estados de eventos (`draft → accepting_applications → open → closed`, soft delete, modo manual/agendado); calculadoras categórica e de escala.
4. Escrever `docs/migration/PARIDADE.md`: uma linha por funcionalidade com ID (`CORE-NN`, `ERR-NN`, `EVT-NN`, `PERF-NN`), descrição, telas, ações/rotas do legado, regras (IDs de `REGRAS.md`), classificação (*migrar como está*, *migrar com mudança*, *descartar*; proposta), destino (core/errometro/eventos/backlog), sprint destino e status. Todo route handler, server action e página do legado aparece em pelo menos uma linha.
5. Escrever `docs/migration/MAPEAMENTO-DADOS.md` inicial: cada tabela do legado → destino proposto (core, errometro, eventos, descartada), com observações (ex.: `groups.id` é slug em texto; `votes` não tem FK para `groups` por causa do grupo demo; o "grupo" do legado equivale à comunidade daqui, então `group_members.status` vira membership de comunidade e `group_members.voting_status` vira `errometro_participants`). Cada grupo do legado vira uma comunidade (D-028): listar os grupos existentes, seus membros e quem participa de mais de um.
6. LGPD: listar campos pessoais coletados e qualquer campo sensível (religião, saúde, orientação sexual, política, inclusive em texto livre como comentários e apresentações).
7. Registrar o que existe e está fora do escopo (D-004): mural/apresentações e o que mais aparecer.
8. Atualizar `PERGUNTAS.md` com tudo que ficou ambíguo e propor respostas.

**Entregáveis:** `INVENTARIO.md`, `REGRAS.md`, `PARIDADE.md`, `MAPEAMENTO-DADOS.md`, `PERGUNTAS.md` atualizado, relatório.

**Critérios de aceite:**
- Todo item das listas de páginas, rotas e actions acima aparece em `PARIDADE.md`.
- Toda regra em `REGRAS.md` tem `arquivo:linha` e trecho literal.
- Divergências entre comentários/notas e código estão registradas (ex.: `memory/project_overview.md` fala de cron diário às 12:04; o código roda a cada 15 minutos).

**Riscos e parada:** se o legado tiver comportamento que parece bug, registre como pergunta; não proponha correção como se fosse paridade.

---

## Sprint 2 — Protótipo Expo: decisão de go/no-go

**Objetivo:** provar, com as partes mais difíceis, que Expo + RN Web + Better Auth + voto anônimo + push funcionam nas três plataformas. O código é descartável; o que fica são as decisões.

**Depende de:** Sprint 1 (pelo menos as seções de votação de `REGRAS.md`). **Gate humano:** sim (go/no-go).

**Onde:** branch `sprint-02-prototipo`, pasta `prototypes/expo/`. O PR mescla só a documentação; o código fica no branch como referência e não é mesclado.

**Referências no legado:** `legado:src/app/group/[id]/vote/page.tsx`, `legado:src/components/voting/*` (em especial `AnonymousSubmitVotesBar.tsx`, `EmojiLegend`), `legado:src/lib/voting/client-token.ts`, `legado:src/domain/voting/blind-signature.ts`, `legado:src/app/results/page.tsx`, `legado:src/components/results/*`, `legado:public/sw.js`, `legado:src/lib/notifications/send-push.ts`.

**Tarefas:**
1. Projeto Expo (SDK estável mais recente) com Expo Router e TypeScript estrito. Testar `npx expo export -p web` e servir o resultado estático.
2. API mínima em Hono (dentro do protótipo) com dados falsos para as telas.
3. **Login:** Better Auth com Google e o plugin Expo, nas três plataformas. Registrar se funciona no Expo Go ou se exige dev build (dev build é aceitável), e a configuração de redirect/scheme no Google Cloud.
4. **Estilo:** implementar a tela de votação com NativeWind e avaliar contra `StyleSheet` puro (paridade visual com o legado, desempenho, ergonomia). Registrar a escolha.
5. **Tela de votação real:** grade de membros × emojis, legenda, barra de envio, estados de carregamento e erro, uma animação (pulso de troféu) com Reanimated.
6. **Tela de resultados real:** ranking com dados falsos.
7. **Voto anônimo (D-011):** implementar no protótipo as etapas do cliente da RFC 9474 (preparar, cegar, finalizar) em JS puro com `@noble/hashes`, `BigInt` e `expo-crypto`. Validar com os vetores de teste da RFC 9474 e com assinatura feita por `@cloudflare/blindrsa-ts` no servidor. Rodar em Android, iOS e web; medir o tempo num Android intermediário.
8. **Push:** token Expo Push em Android e iOS (registrar exigências: dev build, conta Apple paga, chave APNs); Web Push na web com o `sw.js` do legado registrado só quando `Platform.OS === 'web'`.
9. **Seletor de emoji personalizado:** avaliar bibliotecas RN com suporte a web; registrar.
10. **PWA:** manifest e instalação no Chrome Android e no Safari iOS.
11. **Design (`docs/design/DESIGN.md`):** construir as duas telas com os tokens da §13 e validar o que é arriscado em RN: fonte Geist via `expo-font`, brilho ciano/dourado pulsando (inclusive a degradação no Android, §7), blur da barra fixa e do conteúdo reservado, curvas de movimento com Reanimated, háptico, e a **troca de tema** escuro/claro (§3.1: tema resolvido antes da primeira pintura na web e no nativo, barra de status, troca sem reiniciar). Propor a estrutura de navegação do app (início, comunidade, módulos, perfil) e registrar na §9.16 do DESIGN.md.
12. Registrar tudo em `DECISOES.md` (o que funcionou, o que quebrou, o que foi contornado) e criar `docs/libs-aprovadas.md` com as libs testadas.

**Entregáveis:** entradas em `DECISOES.md`, `docs/libs-aprovadas.md`, relatório com prints das três plataformas e recomendação de go/no-go.

**Critérios de parada (pare e reporte com alternativas, sem seguir para o Sprint 3):**
- web inaceitável: fluxo de votação com bugs que impedem o uso, ou carga inicial acima de ~3 s em 4G simulado num celular intermediário;
- login com Google impossível em alguma plataforma sem contorno razoável;
- assinatura cega sem solução no Hermes (nem a opção JS pura nem alternativa aprovável).

---

## Sprint 3 — Monorepo, ferramentas e CI

**Objetivo:** esqueleto do monorepo com qualidade garantida pelo CI desde o primeiro dia.

**Depende de:** Sprint 2 aprovado. **Gate humano:** não. Antes de começar: `main` existe e está protegida (P-011).

**Tarefas:**
1. pnpm workspaces (`pnpm-workspace.yaml` com `apps/*`, `packages/*`, `modules/*`), `.nvmrc` (Node LTS atual), `turbo.json` com `lint`, `typecheck`, `test`, `build` e caches.
2. `packages/config`: `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` se não atrapalhar o RN), ESLint flat config com typescript-eslint, regras de fronteira da ARQUITETURA §3, regra que proíbe helpers de sessão em `modules/*/api/anon/**`; Prettier.
3. Fixture de teste que **viola** uma fronteira e prova que o lint falha (fica em teste, não no código real).
4. `docker-compose.yml` com Postgres 16 para desenvolvimento e testes; `.env.example` por app.
5. `apps/api`: Hono com `GET /v1/health`, handler de erro no formato `{ code, message }`, logger estruturado sem dados pessoais (ex.: pino com `redact`).
6. `apps/mobile`: Expo Router com a escolha de estilo do Sprint 2, providers (TanStack Query, safe area), tela inicial vazia. Rodando em web, Android e iOS.
7. CI (GitHub Actions) em PRs: checkout com `fetch-depth: 0`; `pnpm turbo run lint typecheck test build --filter="...[origin/main]"`; **rodar tudo** quando mudar `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json`, `.github/workflows/**`, `packages/config/**`, `packages/db/**`, `packages/core/**` ou qualquer migration; Postgres como service container.
8. `docs/libs-aprovadas.md` atualizado; `CONTRIBUTING.md` curto (branches, commits, PR, como rodar).

**Critérios de aceite:** clone limpo + `pnpm i` + `pnpm turbo run lint typecheck test build` verde; CI verde no PR; o app abre nas três plataformas; o lint falha na fixture de violação.

---

## Sprint 4 — `packages/db`: papéis, RLS e migrations

**Objetivo:** a camada única de dados com isolamento entre comunidades garantido e testado.

**Depende de:** Sprint 3. **Gate humano:** sim (revisar a abordagem de RLS antes de tudo ser construído em cima dela).

**Tarefas:**
1. Drizzle + driver `pg`. Dois pools: `erre_app` (requisições) e `erre_jobs` (só listar comunidades). Migrations rodam com `erre_migrator`.
2. Script de bootstrap dos papéis para banco **local e de desenvolvimento** (`scripts/db-bootstrap-roles.sql`), com `erre_app` `NOSUPERUSER NOBYPASSRLS` e só DML. Em produção, quem roda é o humano.
3. Tabela `communities` (âncora do tenant: `id uuid`, `slug` único, `name`, `created_at`).
4. `createTenantTable()`: helper sobre `pgTable` que adiciona `community_id uuid not null references communities(id)`, índice em `community_id`, `UNIQUE (community_id, id)` quando houver `id`, e as policies da ARQUITETURA §4.2. Verificar o suporte do Drizzle a `pgPolicy`/`enableRLS()` na versão escolhida; o que não for suportado (ex.: `FORCE ROW LEVEL SECURITY`) é gerado como SQL de migration pelo helper. Documentar a abordagem.
5. `withTenantTx(communityId, userId, fn)`: abre transação, aplica `set_config(..., true)` para `app.community_id` e `app.user_id`, executa `fn(tx)`.
6. Runner de migrations: cada dono (`db`, `core`, cada módulo) tem a própria pasta; ordem determinística (`db` → `core` → módulos em ordem alfabética); tabela de controle com o dono; nomes `<dono>_<NNNN>_<desc>.sql`; `drizzle-kit` configurado por pacote.
7. Tabela de exemplo só de teste (`test_tenant_items`) para os testes de isolamento.

**Testes obrigatórios:**
- **Isolamento:** duas comunidades; com o contexto de A, ler, inserir, atualizar e apagar dados de B falha (zero linhas ou erro) em todos os casos.
- **Fail closed:** consulta sem `app.community_id` definido dá erro, não devolve linhas.
- **Sem vazamento no pool:** depois de uma transação com A, a próxima transação na mesma conexão não tem `app.community_id`.
- **Cobertura de RLS:** lista todas as tabelas com coluna `community_id` e verifica `relrowsecurity`, `relforcerowsecurity` e ao menos uma policy; tabelas globais ficam numa allowlist explícita.
- **Papel do banco:** a API conecta como `erre_app`, que não é dono de nenhuma tabela, não é superuser e não tem `BYPASSRLS`.

**Critérios de aceite:** todos os testes acima verdes no CI, rodando em **toda** PR.

---

## Sprint 5 — Auth e perfil

**Objetivo:** login com Google nas três plataformas e perfil básico.

**Depende de:** Sprint 4. **Gate humano:** não.

**Referências no legado:** `legado:src/app/api/auth/google/*`, `legado:src/app/(auth)/*`, `legado:src/app/onboarding/name/page.tsx`, `legado:src/lib/auth/*` (em especial `display-name.ts`, `profile-actions.ts`, `callback-url.ts`), `legado:src/lib/avatar/*`, `legado:src/components/{auth,avatar}/*`, `legado:src/middleware.ts` (sessão deslizante de ~400 dias).

**Tarefas:**
1. Better Auth em `packages/core/server/auth` com adaptador Drizzle (tabelas globais com prefixo, ex.: `auth_user`, `auth_session`, `auth_account`, `auth_verification`), só Google, plugin Expo, `trustedOrigins` (origem web e scheme do app), montado em `/v1/auth/*`.
2. Confirmar validação de `aud` e emissor do ID token do Google (configuração ou teste).
3. Sessões no banco com duração equivalente à do legado (sessão deslizante); endpoint para revogar sessões.
4. `core_profiles` (global): `user_id`, `display_name`, `avatar_variant`. Portar regras de nome de exibição e variantes de avatar.
5. Middleware `requireSession` → `ctx.user`.
6. App: tela de entrada/login, cliente Better Auth (cookies na web, `expo-secure-store` no nativo), onboarding de nome, logout, proteção de rotas autenticadas, preservação do destino após login (equivalente ao `callbackUrl`).
7. Rate limit nas rotas de auth (embutido no Better Auth ou middleware).

**Testes:** sem sessão → 401; sessão revogada → 401; validação Zod do perfil; nenhum token em log (teste do logger com redact).

**Critérios de aceite:** login, logout e onboarding funcionando em web, Android e iOS; tabelas globais na allowlist do teste de RLS.

---

## Sprint 6 — Comunidades, papéis, `can()` e contexto da requisição

**Objetivo:** multi-tenancy de ponta a ponta: toda requisição autenticada roda numa transação de tenant validada.

**Depende de:** Sprint 5. **Gate humano:** sim (isolamento e modelo de permissões). Decisões aplicáveis: D-022, D-026.

**Tarefas:**
1. `core_community_memberships` (tenant, com a policy extra de leitura das próprias linhas): `community_id`, `user_id`, `role` (`owner|admin|moderador|membro`), `status` (`pending|approved|rejected|removed`), `requested_at`, `reviewed_at`, `reviewed_by`.
2. `core_role_permissions` (tenant): `role`, `permission`. Semeado pelos `defaultRoles` dos manifestos (por enquanto só permissões do core, ex.: `core.membros.gerenciar`, `core.convites.gerenciar`).
3. Middleware de contexto (ARQUITETURA §4.4) e `can(permission)` (ARQUITETURA §5.3). Só membership `approved` abre contexto.
4. Helper `validate()` (Zod) para body, query e params, devolvendo 400 no formato padrão.
5. Rotas: `GET /v1/me/communities`, `GET /v1/communities/:id`, `PATCH /v1/communities/:id/members/:userId` (mudar papel; só `owner`/`admin`; `owner` não pode ser rebaixado por `admin`).
6. **Criar comunidade (D-022):** `POST /v1/communities`, aberto a qualquer usuário logado; quem cria vira `owner`. Esta rota é exceção ao middleware de contexto (ainda não há comunidade): exige só sessão, e a criação da comunidade e da membership `owner` acontece numa transação com o papel `erre_app`, com a policy de insert ajustada para isso (documentar e testar). Limite de criação por usuário (rate limit) para evitar abuso.
7. Seed de desenvolvimento com duas comunidades e usuários em cada papel (script local; nunca em produção).
8. App: criar comunidade; carregar comunidades do usuário; selecionar automaticamente se for uma só; seletor se forem várias; cliente HTTP injeta `X-Community-Id`. Telas seguem `docs/design/DESIGN.md`.
9. Harness de testes da matriz papel × permissão por rota, reutilizável pelos módulos.

**Testes:** isolamento (usuário de A não acessa B, mesmo forjando `X-Community-Id`: 403); `X-Community-Id` ausente → 403; membership `pending` → 403; matriz de permissões das rotas do sprint; listar "minhas comunidades" funciona com RLS ativo; criar comunidade não permite escrever em outra comunidade.

---

## Sprint 7 — Convites, entrada e membros da comunidade

**Objetivo:** gente entra na comunidade por link de convite, com aprovação, e os módulos conseguem ler quem são os membros (D-023, D-026).

**Depende de:** Sprint 6. **Gate humano:** não. Decisões aplicáveis: D-023, D-026, D-027.

**Referências no legado** (o "grupo" do legado equivale à comunidade daqui): `legado:src/lib/groups/{join-group,hub-access,membership-access,home-groups,lookup-group-action,group-limits}.ts`, `legado:src/app/actions/group-membership.ts` (parte de entrada no grupo), `legado:src/lib/members/display-members.ts`, `legado:src/infrastructure/groups/*`, `legado:src/app/group/[id]/page.tsx` (convite universal e estados de acesso), `legado:src/app/group/[id]/settings/page.tsx` (parte de membros), `legado:src/components/group/*`.

**Tarefas:**
1. `core_community_invites` (tenant): `code`, `created_by`, `intent` (opcional, ver 3), `revoked_at`. Regenerar e revogar link (`core.convites.gerenciar`).
2. Fluxo de entrada: `GET /v1/invites/:code` (prévia pública mínima: nome da comunidade e, se houver, o que o convite inclui), `POST /v1/invites/:code/join` (cria membership `pending`; sempre `pending`, nunca aprovação automática), aprovar/rejeitar/remover/sair, com as mesmas transições do legado (`pending → approved | rejected`, `approved → removed`). Quem foi rejeitado ou removido pode pedir de novo explicitamente (volta a `pending`); a entrada automática ao abrir o hub não repede (R-MEM-02).
3. **Um pedido só (D-023):** módulos podem declarar no manifesto **intenções de entrada** (`joinIntents`, ex.: `errometro.participar` = "Entrar e participar do Errômetro"). Um convite com `intent` gera um único pedido; quando o admin aprova a entrada, o core chama, na mesma transação, o `onJoinApproved(ctx, intent, userId)` do módulo dono. Se o módulo não puder concluir (ex.: limite de votantes cheio), a pessoa entra na comunidade e o módulo deixa a participação na fila dele, com aviso. Registrar em `docs/CONTRATO.md` como `[contrato]`.
4. API pública para módulos (`ctx.members`): `list` (membros aprovados com nome de exibição e avatar), `get`, `isApprovedMember`. Módulos **não** leem as tabelas do core.
5. Lista de membros e pedidos pendentes para `owner`/`admin`; perfil curto de cada membro.
6. Limite de 300 membros por comunidade (D-027, paridade com o limite por grupo do legado); acima dele, o pedido fica `pending` até abrir vaga.
7. App: home (minhas comunidades), entrar por link de convite (deep link e web) com a prévia, estado "aguardando aprovação", hub da comunidade (casca que depois recebe as seções dos módulos), gestão de membros e pedidos.

**Testes:** transições de status em tabela; convite revogado não aceita pedido; pedido `pending` não acessa nada da comunidade; `onJoinApproved` roda na mesma transação e falha de forma segura; matriz de permissões; isolamento.

---

## Sprint 8 — Runtime de módulos (contrato v0) e shell do app

**Objetivo:** o contrato de módulo funcionando de ponta a ponta com um módulo de teste.

**Depende de:** Sprint 7. **Gate humano:** sim (revisar o contrato v0 antes de os módulos reais serem escritos).

**Tarefas:**
1. `defineManifest`, `defineModuleApi`, `defineModuleUi` (ARQUITETURA §5) com validação Zod no boot: `id` único; prefixo das permissões, notificações e intenções de entrada (`joinIntents`) = `id`; toda intenção declarada tem `onJoinApproved` na API; rotas de menu começam com `/<id>`.
2. Registro estático em `apps/api/src/modules.ts`; montagem com middleware de flag (D-007, D-008); sub-app `anon` montada sem sessão (D-010).
3. `MODULES_ENABLED`; `GET /v1/modules`; módulo desligado → 404 `MODULE_DISABLED`.
4. Runner de jobs (D-013): `node-cron`, advisory lock, iteração por comunidade, isolamento de erro por comunidade, rota interna `POST /v1/internal/jobs/:id/run` (Bearer `CRON_SECRET`).
5. Semeadura de `core_role_permissions` a partir dos manifestos (idempotente, no boot ou em comando).
6. `profileSections`: rota `GET /v1/profile/:userId/sections` que agrega as seções dos módulos habilitados.
7. Teste de manifesto: as tabelas do módulo têm o prefixo dele (inspecionando o schema exportado).
8. App: menu a partir de `GET /v1/modules` ∩ registro de UI; proteção de rota de módulo desligado; convenção de rotas finas (ARQUITETURA §5.5).
9. Módulo de teste em `modules/_contrato-teste` (só em teste): uma tabela, uma rota, uma rota anônima, um job, uma seção de perfil.
10. `docs/CONTRATO.md` v0: referência para quem escreve módulo.

**Testes:** módulo de teste habilitado responde e desabilitado devolve 404; job não é agendado quando desabilitado; menu esconde o módulo; rota anônima não recebe `user` mesmo com sessão válida no request; job roda uma vez por comunidade e não enxerga outra.

---

## Sprint 9 — `notify()` e push (Web Push + Expo Push)

**Objetivo:** notificações nas três plataformas, com preferências por tipo (D-012).

**Depende de:** Sprint 8. **Gate humano:** não. **Bloqueado por:** P-007.

**Referências no legado:** `legado:src/lib/notifications/*` (`send-push.ts`, `notification-copy.ts`, `subscribe-push-client.ts`), `legado:src/infrastructure/notifications/*`, `legado:src/domain/notifications/*`, `legado:src/app/api/push/*`, `legado:src/app/api/notification-preferences/route.ts`, `legado:src/app/api/admin/push-notifications/toggle/route.ts`, `legado:public/sw.js`, `legado:src/components/pwa/RegisterSW.tsx`, `legado:src/components/notifications/FirstVisitNotificationPrompt.tsx`, `legado:src/components/profile/PushNotificationsToggle.tsx`.

**Tarefas:**
1. `core_push_subscriptions` (global): `id`, `user_id`, `kind` (`webpush|expo`), `endpoint` ou `token`, `keys` (jsonb), `created_at`, `last_seen_at`; único por endpoint/token.
2. `core_notification_preferences` (global): `user_id`, `type`, `enabled`; default vem do manifesto.
3. `notify()` (ARQUITETURA §6) com transportes `web-push` (variáveis VAPID com os mesmos nomes do legado) e `expo-server-sdk` (envio em lotes, leitura de receipts, remoção de tokens inválidos). Kill switch conforme P-007.
4. Rotas: `POST/DELETE /v1/push/subscriptions`, `GET/PUT /v1/notification-preferences` (lista os tipos dos módulos habilitados).
5. App nativo: pedido de permissão, registro do token, toque na notificação abre a rota indicada.
6. App web: `sw.js` portado (network-first, `push`, `notificationclick`) registrado só na web; prompt de primeira visita; alternância no perfil.

**Testes:** transportes simulados; preferências respeitadas; módulo desligado → no-op; inscrições inválidas removidas; nenhum dado pessoal em log.

---

## Sprint 10 — `packages/ui`: design system

**Objetivo:** componentes e tokens compartilhados que funcionam nas três plataformas.

**Depende de:** Sprint 3 (paralelo à trilha core). **Gate humano:** não.

**Fonte principal:** [`docs/design/DESIGN.md`](../design/DESIGN.md). Este sprint implementa o que ele define; qualquer desvio volta para o DESIGN.md com aprovação humana.

**Referências no legado:** `legado:src/app/globals.css` (variáveis de cor e animações), `legado:tailwind.config.ts`, `legado:src/app/fonts/*` (Geist), `legado:src/components/**` (padrões visuais), `legado:src/lib/{color,brand,avatar}/*`, capturas em `docs/design/legado/`.

**Tarefas:**
1. Tokens exatamente como na §13 do DESIGN.md (os dois temas de cor, espaço, raio, tipografia, movimento), mais o hash de variante de avatar portado de `legado:src/lib/avatar/variants.ts`.
2. **Temas (D-025):** `ThemeProvider` + `useTheme()` com preferência `dark` (padrão) | `light` | `system`, salva no dispositivo (AsyncStorage / `localStorage`, com try/catch e padrão escuro se falhar); `system` acompanha `Appearance` / `prefers-color-scheme` ao vivo; barra de status, fundo da janela, `theme-color`, `color-scheme` e `keyboardAppearance` seguem o tema; na web, script inline aplica o tema antes do primeiro paint. Se o estilo escolhido no Sprint 2 for NativeWind, os tokens viram variáveis CSS por tema; se for `StyleSheet`, estilos são criados a partir do tema (sem `if` de tema nas telas).
3. Componentes da §9 do DESIGN.md: `Text` (com as variantes de tipografia), `ScreenHeader` (overline + título + descrição), `Button` (primário, destaque, secundário, fantasma, destrutivo; carregando; desabilitado com motivo), `IconButton`, `TextField` (rótulo overline, ajuda, erro com shake), `Card` (simples, tocável, selecionável), `EmojiButton`, `Avatar`, `Badge`, `SegmentedControl`, `Accordion`, `StickyActionBar`, `Sheet`, `ConfirmDialog`, `Toast`, `Banner` (informação, aviso, erro, destaque, evento), `ReservedContent`, `TrophyMedallion`, `RankingRow`, `Skeleton`, `EmptyState`, `ErrorState`, `Screen` (safe area, largura máxima 512).
4. Movimento e háptico da §8 com Reanimated e `expo-haptics`, incluindo o modo "reduzir movimento".
5. Regra de lint que proíbe hex/rgba literais e `fontSize` numérico fora de `packages/ui`.
6. Acessibilidade da §10.7: roles e rótulos, estados, foco por teclado na web (o legado corrigiu isso no commit `e0dedf0`), fonte escalável.
7. Galeria de componentes numa rota de desenvolvimento do app (`/dev/ui`), fora do build de produção, mostrando todos os estados de cada componente, com alternância de tema.
8. Cada lib registrada em `libs-aprovadas.md` com as plataformas testadas.

**Critérios de aceite:** galeria renderiza em web, Android e iOS, nos dois temas; teste garante que os dois temas têm as mesmas chaves; prints no relatório comparados lado a lado com as capturas do legado; teste de snapshot ou Playwright da galeria na web; contraste dos pares de token verificado por teste automatizado nos dois temas (função de contraste WCAG sobre os tokens); lint de cores literais ativo.

---

## Sprint 11 — Pacotes compartilhados: `anon-vote` e `emoji`

**Objetivo:** extrair o que Errômetro e Eventos compartilham, com os testes do legado portados (D-005, D-011).

**Depende de:** Sprint 3 e conclusões do Sprint 2. **Gate humano:** não.

**Referências no legado:** `legado:src/domain/voting/{blind-signature,voter-tag,aggregate-votes,trophies}.ts`, `legado:src/lib/voting/client-token.ts`, `legado:src/lib/events/client-token.ts`, `legado:src/lib/emojis/*` (`index`, `emoji-grapheme`, `emoji-limits`, `infer-glow-color`), `legado:src/lib/trophies/trophy-catalog.ts`, e os testes correspondentes.

**Tarefas:**
1. `@erre/anon-vote/server`: geração de par de chaves, assinatura cega, verificação (sobre `@cloudflare/blindrsa-ts`), derivação do `voter_tag` a partir da mensagem preparada.
2. `@erre/anon-vote/client`: preparar, cegar e finalizar em JS puro (D-011), a partir do protótipo do Sprint 2.
3. Testes: vetores da RFC 9474; interoperabilidade cliente-JS ↔ servidor nos dois sentidos; rodar o cliente também num ambiente Hermes (tela de dev no app ou teste em dispositivo, documentado).
4. Agregação genérica de votos portada.
5. **Interfaces** de repositório (chaves, emissões, votos). O pacote não tem tabelas: cada módulo implementa com as suas.
6. `@erre/emoji`: catálogo global, nomes de troféus, grafemas, limites. `infer-glow-color` usa `canvas` (só web): manter a versão web e definir o comportamento no nativo (valor padrão, ou cálculo no momento da criação do emoji na web) e registrar em `DECISOES.md`.

**Critérios de aceite:** todos os testes do legado para esses arquivos portados e verdes; cabeçalho `// Portado de ...` em cada arquivo.

---

## Sprint 12 — Errômetro API I: participação, voto anônimo, configuração

**Objetivo:** o módulo `errometro` com schema, participação, emissão de token, voto anônimo e configuração da rodada.

**Depende de:** Sprints 8 e 11. **Gate humano:** não.

**Referências no legado:** `legado:src/domain/voting/*`, `legado:src/lib/voting/*` (`anonymous-voting.ts`, `group-release-schedule.ts`, `filter-existing-votes.ts`, `release-cadence-copy.ts`), `legado:src/app/actions/{votes,voting-token,group-release-config,group-emoji-config,group-membership}.ts` (parte de votação: `requestVotingAccessAction`, `approveVotingAction`, `rejectVotingAction`, `removeVotingAction`), `legado:src/app/api/groups/[id]/{vote,my-votes}/route.ts`, `legado:src/lib/emojis/group-emoji-config.ts`, `legado:src/infrastructure/{voting,release-config,emojis}/*`.

**Tarefas:**
1. Manifesto (permissões `errometro.ver`, `errometro.votar`, `errometro.moderar`; notificações; intenção de entrada `errometro.participar`), API e UI vazias registradas. **Um Errômetro por comunidade** (D-026).
2. Schema (todas com `createTenantTable()`; a comunidade é o escopo de tudo):
   - `errometro_participants` (aprovação para votar: `status`, datas, `reviewed_by`);
   - `errometro_release_config` (`frequency`, `release_hour`, `release_weekdays`, mantendo a semântica dos valores legados);
   - `errometro_emoji_config` (catálogo + personalizados; nunca apagar personalizado, só desativar);
   - `errometro_signing_keys` (por comunidade + período);
   - `errometro_token_issuances` (usuário + comunidade + período, **sem timestamp**; manter o comentário que explica o porquê);
   - `errometro_votes` (sem `user_id`; `voter_tag`, `target_id`, `emoji_id`, `voted_at`; índices do legado);
   - `errometro_snapshots` (`payload`, `hidden`, `notified_at`);
   - `errometro_release_reminders`;
   - `errometro_comments`.
3. Domínio portado com testes: calendário, janela de liberação, resolução do período atual, filtro de votos existentes, schemas.
4. Rotas autenticadas: status de participação; pedir participação; aprovar/rejeitar/remover (limite de 50 votantes por comunidade, D-027; acima dele, fila em `pending`, como no legado); estado da rodada atual (alvos, emojis, período); chave pública do período; emitir token (uma vez por usuário/comunidade/período); meus votos (conforme o comportamento do legado em `my-votes`, conferir o impacto no anonimato); configuração de emojis e de cadência (`errometro.moderar`).
5. Rota anônima: `POST /v1/errometro/anon/c/:communityId/votes` (mensagem preparada + assinatura + votos). A comunidade do caminho só é aceita porque a assinatura é verificada contra a chave do período dela (ARQUITETURA §4.5).
6. Participação válida só enquanto a membership na comunidade estiver aprovada (verificada na leitura via `ctx.members`; ver `REGRAS.md` para a cascata do legado).
7. `onJoinApproved` para `errometro.participar`: aprova a participação junto com a entrada na comunidade (um pedido só, D-023); se o limite estiver cheio, deixa em `pending` e avisa.
8. Resultados visíveis para qualquer membro aprovado da comunidade, mesmo quem não vota (D-026; no legado, membros aprovados do grupo viam sem votar).
7. `MAPEAMENTO-DADOS.md` atualizado.

**Testes:** testes portados do legado (`votes.test.ts`, `voting-token.test.ts`, `group-release-config.test.ts`, `group-emoji-config.test.ts`, `group-membership.test.ts` na parte de votação, testes de domínio); matriz de permissões; isolamento; **teste de anonimato** (a rota anônima com sessão válida no request não tem acesso a usuário; nada de identificador no log; a emissão não grava horário).

---

## Sprint 13 — Errômetro API II: fechamento, resultados, comentários, troféus

**Objetivo:** completar o backend do Errômetro.

**Depende de:** Sprints 9 e 12. **Gate humano:** não.

**Referências no legado:** `legado:src/lib/jobs/{close-daily-snapshots,send-closing-reminders}.ts` e testes (incluindo `cadence-transition.test.ts`), `legado:src/lib/notifications/{notify-result-ready,notify-closing-reminder,notification-copy}.ts`, `legado:src/app/actions/{release-now,annul-vote,comments}.ts`, `legado:src/app/api/groups/[id]/{recompute-snapshot,hide-snapshot}/route.ts`, `legado:src/lib/voting/{aggregated-daily-results,annul-vote}.ts`, `legado:src/lib/results/*`, `legado:src/lib/trophies/group-trophy-tally.ts`.

**Tarefas:**
1. Job `errometro.fechar_rodadas` (a cada 15 min, executado por comunidade): fecha as rodadas prontas, grava snapshots de forma idempotente, notifica "resultado liberado" uma vez só (`notified_at`).
2. Job `errometro.lembrete_fechamento`: lembrete antes de fechar, uma vez por rodada (`release_reminders`).
3. Liberar agora, recalcular rodada anterior (sem renotificar) e ocultar rodada (`errometro.moderar`).
4. Anular voto por código (`errometro.moderar`): apaga as linhas do `voter_tag`, sem reemitir token.
5. Resultados: dias disponíveis (respeitando `hidden`), resultado por dia, banner de rodada oculta, mensagem de compartilhamento.
6. Comentários: listar, criar, editar, apagar (o nome do autor vem do perfil na leitura, não denormalizado; conferir regras de autoria no legado).
7. Contagem de troféus na comunidade e `profileSections` (`errometro.trofeus`).

**Testes:** testes portados (`close-daily-snapshots.test.ts`, `cadence-transition.test.ts`, `send-closing-reminders.test.ts`, `notify-*.test.ts`, `release-now.test.ts`, `annul-vote.test.ts`, `comments.test.ts`); idempotência dos jobs; job de uma comunidade não toca outra; matriz de permissões.

---

## Sprint 14 — Errômetro UI I: hub e votação

**Objetivo:** votar no Errômetro pelo app, nas três plataformas.

**Depende de:** Sprints 10 e 12. **Gate humano:** não.

**Referências no legado:** `legado:src/app/group/[id]/page.tsx`, `legado:src/app/group/[id]/vote/page.tsx`, `legado:src/components/voting/*`, `legado:src/components/group/*` (partes do Errômetro), `legado:src/lib/voting/{client-token,remembered-votes}.ts`.

**Design:** DESIGN.md §9.3 (card de pessoa), §9.4 (botão de emoji), §9.7, §9.8, §9.9 (barra fixa), §8 (háptico de seleção e sucesso), §10.1 (anonimato) e §10.6 (lista virtualizada). Referência visual: `docs/design/legado/05` a `07`.

**Tarefas:**
1. Seção do Errômetro no hub da comunidade: estado da rodada, chamada para votar, estados de participação (sem pedido, pendente, rejeitado, removido, fila do limite de votantes).
2. Tela de votação: grade de alvos, seleção de emoji, legenda ("O que significa cada emoji?"), barra de envio.
3. Fluxo anônimo: chave pública → token (autenticado) → cegar/finalizar (`@erre/anon-vote/client`) → envio pela rota anônima com um cliente **sem credenciais** (`credentials: 'omit'` na web, sem header no nativo).
4. Votos lembrados por comunidade no dispositivo (AsyncStorage; no legado é `localStorage`), nunca enviados ao servidor.
5. Código do votante exibido para o caso de anulação.
6. Estados de erro, sem conexão e de sucesso.
7. Hooks TanStack Query sobre `hc<ErrometroApi>`.

**Testes:** testes de componente (React Native Testing Library); Playwright na web para o fluxo completo contra a API local; **teste que garante que a requisição anônima não leva cookie nem `Authorization`**; checklist manual Android/iOS no relatório.

---

## Sprint 15 — Errômetro UI II: resultados e administração

**Objetivo:** paridade completa do Errômetro.

**Depende de:** Sprints 13 e 14. **Gate humano:** sim (paridade do Errômetro nas três plataformas).

**Referências no legado:** `legado:src/app/results/page.tsx`, `legado:src/components/results/*`, `legado:src/app/group/[id]/settings/page.tsx`, `legado:src/components/group/*` (configurações), `legado:src/lib/results/*`.

**Design:** DESIGN.md §9.13 (conteúdo reservado), §9.14 (medalha e ranking), §7 (brilhos dourado e prata), §10.3 (confirmação de ações destrutivas: anular, ocultar, remover). Referência visual: `docs/design/legado/08`.

**Tarefas:**
1. Resultados: ranking, navegação entre dias, banner de rodada oculta, comentários, compartilhar (área de transferência e compartilhamento nativo).
2. Administração do Errômetro da comunidade (`errometro.moderar`): cadência e horário, emojis (catálogo e personalizados, com o seletor escolhido no Sprint 2), aprovação de votantes, liberar agora, recalcular, ocultar, anular voto por código.
3. Percorrer todos os itens `ERR-*` de `PARIDADE.md` e marcar.

**Critérios de aceite:** todos os `ERR-*` classificados como "migrar" estão concluídos ou com pendência aprovada pelo humano.

---

## Sprint 16 — Eventos API

**Objetivo:** backend do módulo `eventos`.

**Depende de:** Sprints 8, 9 e 11. Pode rodar em paralelo aos sprints 12–15. **Gate humano:** não.

**Referências no legado:** `legado:src/domain/events/*` (`calculator.ts`, `categorical-calculator.ts`, `scale-calculator.ts`, `trophy-winner.ts`, `schemas.ts`), `legado:src/lib/events/*`, `legado:src/lib/jobs/{open,close}-scheduled-events.ts`, `legado:src/app/actions/{voting-events,voting-event-token}.ts`, `legado:src/app/api/events/[id]/*`, `legado:src/lib/trophies/event-trophy-wins.ts`, `legado:src/infrastructure/events/*`, e os testes correspondentes.

**Tarefas:**
1. Manifesto (permissões `eventos.ver`, `eventos.votar`, `eventos.criar`, `eventos.moderar`; notificações).
2. Schema `eventos_*` (escopo da comunidade; FKs compostas entre as tabelas do módulo): `events` (tipo categórico/escala, status, modo manual/agendado, horários, cor do banner, `deleted_at`), `emoji_config` (com `scale_max`), `participants`, `signing_keys`, `token_issuances` (sem timestamp), `votes` (com `value` para escala), `snapshots` (`notified_at`), `trophy_wins`.
3. Domínio portado: máquina de estados, calculadoras, vencedor de troféu (mínimo de 3 votos), limites, mensagem de compartilhamento.
4. Rotas: criar/editar rascunho, configurar emojis, abrir inscrições, inscrever-se, abrir votação, encerrar, excluir (soft delete), chave pública, emitir token, meus votos, resultados, troféus. Rota anônima de envio de votos.
5. Jobs `eventos.abrir_agendados` e `eventos.fechar_agendados`; notificação de resultado.
6. `profileSections` (`eventos.trofeus`).
7. `MAPEAMENTO-DADOS.md` atualizado.

**Testes:** portados (`voting-events.test.ts`, `voting-event-token.test.ts`, `anonymous-event-voting.test.ts`, `voting-event-lifecycle.test.ts`, calculadoras, `open/close-scheduled-events.test.ts`); teste de anonimato igual ao do Errômetro; matriz de permissões; isolamento.

---

## Sprint 17 — Eventos UI

**Objetivo:** paridade completa de Eventos.

**Depende de:** Sprints 10 e 16. **Gate humano:** sim (paridade de Eventos).

**Referências no legado:** `legado:src/app/group/[id]/events/**`, `legado:src/components/group/events/*`, `legado:src/components/voting/events/*`, `legado:src/components/trophies/EventScaleTrophyList.tsx`.

**Design:** DESIGN.md §3.4 (cor de evento: só tinge fundo, borda, ícone e brilho; texto sempre com tokens), §9.12 (banner de evento), §9.10 (assistente em sheet, no máximo 4 passos), §9.14.

**Tarefas:**
1. Lista de eventos (visão de admin e de membro), seção no hub da comunidade. Todo membro da comunidade vê os eventos e se inscreve se quiser (D-026).
2. Criar/editar evento (assistente: tipo, emojis/eixos, modo de liberação, cor).
3. Sala de espera (inscrições abertas).
4. Votação categórica e por escala (grades, seletor de intensidade), ordenação alfabética/não votados, vibração (`expo-haptics` no nativo; na web, `navigator.vibrate` quando houver).
5. Resultados com banners e compartilhamento com troféus.
6. Percorrer todos os `EVT-*` de `PARIDADE.md`.

---

## Sprint 18 — Perfil, troféus, página de membro, preferências e PWA

**Objetivo:** fechar as telas transversais e a experiência de PWA.

**Depende de:** Sprints 15 e 17. **Gate humano:** não. **Bloqueado por:** P-003, P-008.

**Design:** DESIGN.md §9.5 (avatar), §9.14 (medalhas no perfil), §10.1 (pedido de permissão de notificação no momento certo), §10.8 (PWA), §12 (texto da landing alinhado aos limites reais). Referência visual: `docs/design/legado/01` e `02`.

**Referências no legado:** `legado:src/app/profile/page.tsx`, `legado:src/components/profile/*`, `legado:src/components/trophies/*`, `legado:src/app/group/[id]/member/[userId]/page.tsx`, `legado:src/components/member/*`, `legado:src/app/page.tsx`, `legado:src/components/landing/*`, `legado:src/app/api/{og,pwa-icons}/*`, `legado:src/app/.well-known/apple-app-site-association/route.ts`.

**Tarefas:**
1. Tela de perfil do core montada com `profileSections` dos módulos habilitados (troféus do Errômetro e de Eventos).
2. Página de membro da comunidade e links para o perfil em todos os lugares onde o legado tem `MemberProfileLink`.
3. Edição de perfil (nome, avatar), preferências de notificação por tipo e **Aparência** (Escuro, padrão / Claro / Igual ao sistema; DESIGN.md §3.1).
4. Landing (e o destino do grupo demo, conforme P-003).
5. PWA: manifest, ícones estáticos, instalação no Android e no iOS, arquivos `.well-known` para links universais (iOS e Android).
6. Imagens OG conforme P-008.
7. Suíte Playwright (web) com os fluxos principais: login, entrar na comunidade por convite, votar, ver resultado, criar e votar em evento.

---

## Sprint 19 — Segurança, LGPD, deploy e paridade final

**Objetivo:** pronto para o humano planejar a virada.

**Depende de:** Sprint 18. **Gate humano:** sim (paridade final). **Bloqueado por:** P-010.

**Tarefas:**
1. Revisão de segurança: autorização em toda rota, Zod em toda entrada, rate limit (auth, emissão de token, rota anônima), CORS, flags de cookie, headers de segurança, rota anônima sem IP no log.
2. LGPD: `data.export` e `data.delete` em `defineModuleApi` para core, Errômetro e Eventos; rota de exportação e fluxo de exclusão (acionado por admin na v1). Documentar que votos não são ligáveis a pessoas e, por isso, não entram na exportação.
3. Desempenho: tempo de typecheck do RPC, latência das rotas principais, índices (sempre começando por `community_id`).
4. Deploy: Dockerfile da API (multi-stage, `turbo prune`), migrations com `erre_migrator` num passo separado, export web do Expo hospedado conforme P-010, perfis de build EAS (dev/preview/prod) sem publicar nas lojas, ambiente de staging com dados falsos, deploy da API só quando ela ou suas dependências mudarem.
5. Conferir que o legado continua em `7c5c5bf` (D-021). Se tiver recebido commits, fazer o diff, adicionar os itens novos em `PARIDADE.md` e implementar ou levar ao humano para backlog.
6. Paridade final: todos os itens de `PARIDADE.md` revisados com o humano.
7. Lista de insumos para o plano de dados (D-016): `MAPEAMENTO-DADOS.md` completo, dúvidas de vínculo de contas.

---

## Sprint 20 — Template de módulo e preparação do hackathon

**Objetivo:** qualquer pessoa cria um módulo novo seguindo só o gerador e a documentação.

**Depende de:** Sprint 19. **Gate humano:** sim.

**Tarefas:**
1. `pnpm create-module <id>`: gera `modules/<id>` (manifesto, API com sub-app e rota anônima opcional, UI, pasta de migrations, testes de isolamento e de matriz de permissões já preenchidos), os arquivos de rota em `apps/mobile/app/`, a entrada no registro e a variável em `MODULES_ENABLED` no `.env.example`.
2. `docs/criando-um-modulo.md` (passo a passo, com uma seção "Design do seu módulo" que aponta para `docs/design/DESIGN.md` e mostra uma tela de exemplo montada só com `packages/ui`), `docs/libs-aprovadas.md` revisado, `docs/guia-pr-e-migrations.md`. As telas geradas pelo `create-module` já usam `Screen`, `ScreenHeader` e os estados de carregando/vazio/erro.
3. `docs/CONTRATO.md` v1, consolidando todas as entradas `[contrato]` de `DECISOES.md`.
4. Módulo de exemplo `avisos` (mural de avisos: listar, publicar, apagar, notificar ao publicar; permissão `avisos.publicar`) construído **por um agente sem contexto prévio**, usando só o gerador e a documentação. Registrar cada dificuldade.
5. Relatório "o que doeu", com as mudanças feitas no contrato a partir disso.

---

## Backlog pós-plano

- Migração de dados (ETL) e plano de virada (D-016), com execução em produção feita pelo humano.
- Mural/apresentações como módulo.
- Bot de WhatsApp (`commands` no manifesto).
- Liga/desliga de módulos por comunidade.
- Edição de papéis × permissões pela comunidade.
- Fuso horário por comunidade (D-020).
- Sign in with Apple e publicação nas lojas.
- Estatísticas, cobrança, lista de banidos, board de membros.
