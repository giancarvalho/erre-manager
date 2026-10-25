# Inventário do legado

Levantamento do Errômetro em `giancarvalho/queridometro@7c5c5bf` (somente leitura). Regras de negócio detalhadas em [`REGRAS.md`](REGRAS.md); checklist em [`PARIDADE.md`](PARIDADE.md); tabelas em [`MAPEAMENTO-DADOS.md`](MAPEAMENTO-DADOS.md).

## 1. Estrutura e stack

| Item | Valor |
|---|---|
| Nome do pacote | `karmometro` (o produto já se chamou Queridômetro e Karmômetro; hoje é Errômetro) |
| Gerenciador | npm (`package-lock.json`) |
| Node | `>=20` (`.nvmrc`: 20) |
| Next.js | 15 (App Router) |
| React | 19 |
| Drizzle ORM / drizzle-kit | 0.36 / 0.28 |
| Banco | PostgreSQL (`pg`) |
| Outras | `jose` (sessão JWE), `@cloudflare/blindrsa-ts` (assinatura cega), `web-push`, `node-cron`, `zod`, `zustand`, `date-fns(-tz)`, `framer-motion`, `lucide-react`, `sonner`, `emoji-picker-react`, Capacitor 8 |
| Tamanho | 429 arquivos em `src/`, ~42 mil linhas TS/TSX |

```
src/
  app/            App Router: 16 páginas, 19 route handlers (2 em .tsx), 45 server actions (11 arquivos em app/actions + 5 em lib/)
  components/     por área: auth, avatar, group (+events), landing, member, notifications, profile, providers, pwa, results, trophies, voting (+events), wall
  domain/         lógica pura: voting, events, notifications
  infrastructure/ repositórios Postgres + em memória por área (auth, comments, emojis, events, groups, notifications, release-config, voting, wall)
  lib/            regras de aplicação e fachada de persistência (lib/persistence)
  db/             schema.ts (Drizzle) e cliente
  instrumentation.ts  cron interno (node-cron)
  middleware.ts   proteção de rotas e sessão deslizante
drizzle/          25 migrations SQL (0000–0024)
db/               schema.sql e migrations/001 (legado, referência; a fonte é drizzle/)
e2e/              1 teste Playwright
scripts/          migrate, apply-schema, drop-all-records (perigoso), SQLs de diagnóstico de grupos reais
android/ ios/ mobile/www  shell Capacitor
```

Scripts do `package.json`: `dev`, `build`, `start`, `lint`, `test` (Vitest), `test:e2e` (Playwright), `db:schema(:local)`, `db:generate`, `db:push`, `db:studio`, `db:migrate(:local)`, `db:migrate:votes(:local)`, `cap:sync`, `cap:open:ios`, `cap:open:android`.

## 2. Como o app é servido

- **App Router** com Server Components na maior parte das páginas; client components onde há estado (64 arquivos `"use client"`).
- **Server Actions** (16 arquivos `"use server"`) para quase toda escrita: votos, membership, emojis, cadência, eventos, comentários, mural, perfil, sessão.
- **Route Handlers** para: rota anônima de voto (`/api/groups/[id]/vote`, `/api/events/[id]/vote`), "meus votos", recalcular e ocultar rodada, crons, push, preferências, OAuth Google, OG image, ícones PWA, `apple-app-site-association`.
- **Middleware** (`src/middleware.ts`): protege `/group/*`, `/results`, `/profile`; reemite o cookie a cada acesso (sessão deslizante de 400 dias).
- **Jobs**: `src/instrumentation.ts` registra um `node-cron` a cada 15 minutos que roda, em sequência, fechamento de rodadas, lembretes de fechamento, abertura e fechamento de eventos agendados. As rotas `/api/cron/*` existem (Bearer `CRON_SECRET`), mas nada externo as chama.
- **Deploy real**: imagem Docker publicada e servidor atualizado por SSH em todo push na `main` (`.github/workflows/prod.yml`), com `drizzle-migrate` antes do `up`. O README fala em Vercel e o `vercel.json` está vazio: está desatualizado.

## 3. PWA e mobile

- `src/app/manifest.ts`, ícones gerados dinamicamente (`/api/pwa-icons/[size]`, `icon.tsx`, `apple-icon.tsx`) a partir do 🦄 (`src/lib/brand/brand-icon.tsx`, com `BRAND_ICON_VERSION` para quebrar cache).
- Service worker `public/sw.js`: network-first ("o app requer conexão"), registro em `src/components/pwa/RegisterSW.tsx`; recebe Web Push.
- Web Push com VAPID (`web-push`), inscrições em `push_subscriptions`, kill switch global, preferências por tipo.
- **Capacitor 8** em modo "servidor ao vivo": os apps nativos carregam `https://karmometro.kodehouse.com` (`capacitor.config.ts`); `docs/mobile-publishing.md` descreve o caminho para as lojas.

## 4. Dados

- **25 tabelas** (lista e destino em `MAPEAMENTO-DADOS.md`). Sem armazenamento de arquivos: avatares são cores, emojis personalizados são caracteres.
- Consultas ficam em `src/infrastructure/*/postgres-*.ts`, com uma implementação em memória para cada repositório (usada sem `DATABASE_URL` e nos testes). `src/lib/persistence/*` escolhe a implementação. Páginas e actions chamam `lib/`, não a infraestrutura diretamente.
- O modo em memória não funciona entre rotas no `next dev` (cada rota tem seu bundle; ver `e2e/README.md`): criar um grupo e depois abri-lo dá 404.
- Volume de dados: não acessível (não há banco de desenvolvimento com dados reais). Os scripts `scripts/debug-r-*.sql` e `query-r-uberlandia-*.sql` indicam grupos reais como `r-uberlandia` e `r-esportes`.

## 5. Autenticação

- Sessão própria: JWE (`jose`, `dir+A256GCM`) em cookie HTTP, com `userId`, `username` e `lastGroupId` opcional (`src/lib/auth/session-token.ts`).
- Dois modos de login: **usuário + chave secreta** de quatro palavras (ex.: `selo-mago-eco-mago`, guardada como hash) e **Google OAuth** próprio (`/api/auth/google`, troca o código e lê `userinfo`; grava `email` e `google_id`).
- Papéis: só "criador do grupo" (`groups.created_by`), verificado por `isGroupCreator` nas actions e rotas administrativas. Não há admin de plataforma.

## 6. Domínio (resumo)

Funcionalidades, telas e ações completas em `PARIDADE.md`. Em linhas gerais:
- **Errômetro recorrente:** grupos com convite e aprovação; votação anônima com assinatura cega por período; cadências configuráveis; fechamento automático; ranking, troféus, comentários, histórico; administração (aprovação de votantes, emojis, cadência, liberar agora, recalcular, ocultar, anular voto).
- **Eventos:** votações únicas categóricas ou por escala, com sala de espera, modo manual ou agendado, troféus próprios.
- **Mural/apresentações:** fora do escopo da migração (D-004).
- **Perfil:** nome, avatar, troféus por grupo, notificações.

## 7. Variáveis de ambiente (só nomes)

`DATABASE_URL`, `SESSION_SECRET`, `VOTER_TAG_SECRET` (só o caminho demo, R-ANON-08), `VOTING_TIMEZONE`, `CRON_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_CANONICAL_HOST`, `NEXT_PUBLIC_VIEWER_MEMBER_ID`. Nenhum `.env` com valor real está commitado; só `.env.example`.

## 8. Interface

- Tailwind 3 com paleta zinc + ciano, tema só escuro, fonte Geist local, `framer-motion` em 1 arquivo, `lucide-react`, `sonner` (toasts), `emoji-picker-react` só no mural (fora do escopo).
- 45 arquivos usam APIs só-web (`window`, `document`, `localStorage`, `navigator`): token anônimo e votos lembrados no `localStorage`, canvas para inferir cor de emoji, `navigator.vibrate`, Web Push, clipboard.
- Sem equivalente direto em React Native: Tailwind (decidir NativeWind ou StyleSheet), `framer-motion` (→ Reanimated), `sonner`, canvas, `localStorage` (→ AsyncStorage/SecureStore), `crypto.subtle` (→ D-011), service worker (→ só na web).
- Referência visual e análise detalhada: `docs/design/DESIGN.md`.

## 9. Qualidade

- **Unitários:** 106 arquivos, 1.096 testes Vitest, **todos passando** sem `.env` real (rodado em 2026-10-25, 30 s). São de lógica, repositórios em memória, actions e rotas; **não há testes de componente**. Cobertura não medida (o pacote de coverage não está instalado).
- **E2E:** 1 teste Playwright (`e2e/vote-memory.spec.ts`), **falhando** no commit de referência: espera ver "Toque em um emoji" ao abrir `/group/<slug>`, mas o hub hoje mostra cards e exige pedir acesso à votação (separação `status`/`votingStatus`). O teste ficou para trás depois dessa mudança. Também aponta para um caminho de Chromium fixo que não existe mais neste ambiente.
- **CI:** só deploy; não roda lint nem testes. Usa `actions/checkout@v2` e senha SSH.

## 10. Dívida técnica e riscos para a migração

1. Comentários de código e `memory/project_overview.md` desatualizados (cron "12:04", janela por `voted_at`, "só um grupo real"); a fonte é o código.
2. Caminho de voto duplicado: HMAC (demo) e assinatura cega (real). Só o segundo migra.
3. Repositórios em memória e Postgres duplicados para tudo; no app novo, testes de integração usam Postgres real.
4. Rótulo de rodada e âncora já causaram perda de votos (incidente r-uberlandia, R-CAL-05); os testes portados precisam cobrir fechamento antecipado e mudança de cadência.
5. Slug do grupo é o código de convite público (R-MEM-07).
6. Participação em evento sem aprovação (R-EVT-07, P-014).
7. `scripts/drop-all-records.mjs` apaga todas as linhas (confirmação por "YES"); proibido para agentes.
8. Shell Capacitor que só carrega o site: risco de rejeição na App Store (motivo de D-001).

## 11. Dados pessoais (LGPD)

| Dado | Onde | Observação |
|---|---|---|
| E-mail, `google_id` | `app_users` | só de quem entrou com Google |
| Nome de exibição, username | `app_users` | |
| Hash da chave secreta | `app_users.secret_hash` | login por usuário + chave, não migra (D-017) |
| Comentários | `group_comments` | texto livre identificado (autor e nome); pode conter qualquer coisa |
| Apresentações | `presentations` | texto livre (fora do escopo, mas os dados existem) |
| Inscrições de push | `push_subscriptions` | endpoint e chaves do navegador |
| Votos | `votes`, `voting_event_votes` | sem `user_id`; ligados só ao `voter_tag` |
| Emissão de token | `voting_token_issuances`, `voting_event_token_issuances` | liga usuário a "votou neste período", sem horário |

Nenhum campo estruturado de religião, saúde, orientação sexual ou política. Texto livre (comentários, apresentações) pode conter dados sensíveis; o fluxo de exportação e exclusão (Sprint 19) precisa cobri-los.

## 12. O que existe e está fora do escopo (D-004)

- Mural/apresentações: `presentations`, `presentation_reactions`, `group_presentation_config`, `/group/[id]/wall`, `src/components/wall/*`, actions `submitPresentationAction`, `deletePresentationAction`, `setPresentationTemplateAction`, `toggleReactionAction`.
- Grupo demo (P-003).
- Login por usuário + chave secreta (D-017).
