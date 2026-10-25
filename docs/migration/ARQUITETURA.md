# Arquitetura-alvo

Este documento descreve **como** o sistema é organizado. As escolhas e seus motivos estão em [`DECISOES.md`](DECISOES.md) (citadas como `D-NNN`).

## 1. Stack

| Camada | Escolha |
|---|---|
| App | Expo + React Native + Expo Router; React Native Web para a PWA (D-001) |
| API | Hono (Node) |
| Banco | Postgres 16 + Drizzle ORM, RLS por comunidade |
| Contrato front/back | Hono RPC (`hc<T>`), tipos importados com `import type`, um cliente por módulo (D-009) |
| Monorepo | pnpm workspaces + Turborepo, TypeScript estrito |
| Auth | Better Auth, só Google, sessões no banco (D-017) |
| Testes | Vitest (unidade e integração com Postgres real), React Native Testing Library, Playwright (web e2e) |

## 2. Estrutura de pastas

```
apps/
  mobile/            Expo (Android, iOS, web/PWA). Rotas finas que reexportam telas dos módulos
  api/               Hono: monta core + módulos em /v1; executa jobs
packages/
  config/            tsconfig base, ESLint (inclui regras de fronteira), Prettier
  db/                conexão, papéis de banco, communities (âncora do tenant), createTenantTable(),
                     withTenantTx(), runner de migrations, testes de RLS
  core/              auth, perfis, comunidades, memberships, convites, papéis, can(), notify(),
                     contexto da requisição, runtime de módulos, jobs
  ui/                design system em React Native (tokens + componentes)
  anon-vote/         assinatura cega RFC 9474 (servidor + cliente), agregação de votos
  emoji/             catálogo global de emojis e troféus, grafemas, limites
modules/
  errometro/
    manifest.ts      metadados puros (sem código de servidor nem de UI)
    api/             sub-app Hono, serviços, jobs; api/anon/ para rotas anônimas
    db/              schema Drizzle + migrations do módulo
    ui/              telas e componentes
    tests/
  eventos/           mesma estrutura
docs/
  migration/         PLANO, ARQUITETURA, DECISOES, PERGUNTAS, INVENTARIO, PARIDADE, MAPEAMENTO-DADOS, relatorios/
  libs-aprovadas.md
```

Nomes de pacote: `@erre/config`, `@erre/db`, `@erre/core`, `@erre/ui`, `@erre/anon-vote`, `@erre/emoji`, `@erre/errometro`, `@erre/eventos`.

## 3. Fronteiras de dependência

Garantidas por ESLint (`eslint-plugin-boundaries` ou equivalente, definido no Sprint 3) e verificadas no CI.

| Pode importar → | config | db | core | ui | anon-vote | emoji | módulos |
|---|---|---|---|---|---|---|---|
| `packages/db` | ✅ | | ❌ | ❌ | ❌ | ❌ | ❌ |
| `packages/core` | ✅ | ✅ | | ❌ | ❌ | ❌ | ❌ |
| `packages/ui` | ✅ | ❌ | ❌ | | ❌ | ✅ | ❌ |
| `packages/anon-vote`, `emoji` | ✅ | ❌ | ❌ | ❌ | | | ❌ |
| `modules/*/api` | ✅ | ✅ (público) | ✅ (público) | ❌ | ✅ | ✅ | ❌ outros módulos |
| `modules/*/ui` | ✅ | ❌ | ✅ (só tipos e client) | ✅ | ✅ (cliente) | ✅ | ❌ outros módulos |
| `apps/api` | ✅ | ✅ | ✅ | ❌ | | | ✅ (`manifest` + `api`) |
| `apps/mobile` | ✅ | ❌ | ✅ (client) | ✅ | | | ✅ (`manifest` + `ui`; `api` só `import type`) |

`@erre/core` expõe dois entries: `@erre/core/server` (Hono, banco) e `@erre/core/client` (tipos, hooks de auth e de comunidade para o app). O app nunca importa `@erre/core/server`.

## 4. Multi-tenancy

### 4.1 Modelo

- **Comunidade** (`communities`): o tenant. Toda tabela de dados de comunidade tem `community_id` e RLS.
- **Membership de comunidade** (`core_community_memberships`): papel por comunidade (`owner`, `admin`, `moderador`, `membro`).
- **Sem subgrupos na v1** (D-026). Tudo o que está no escopo (Errômetro, eventos, perfil) é da comunidade inteira, porque um membro participa de vários subgrupos. Subgrupos (como os do WhatsApp) entram no core só quando houver algo exclusivo de um subgrupo, provavelmente junto com o bot. Nada no modelo atual impede isso: entra como tabela nova e um escopo opcional.
- **Tabelas globais** (sem `community_id`, sem RLS de tenant): usuários e sessões (Better Auth), perfis, inscrições de push, preferências de notificação. Ficam numa allowlist explícita no teste de cobertura de RLS.

### 4.2 RLS

Toda tabela com `community_id` é criada por `createTenantTable()`, que gera:

```sql
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento_comunidade ON <tabela>
  USING (community_id = current_setting('app.community_id')::uuid)
  WITH CHECK (community_id = current_setting('app.community_id')::uuid);
CREATE INDEX ON <tabela> (community_id);
```

- `current_setting('app.community_id')` **sem** `missing_ok`: se a variável não foi definida, a consulta falha (fail closed), em vez de vazar.
- Tabelas filhas (ex.: votos de um evento) têm `community_id` próprio e **FK composta** `(community_id, parent_id) → parent(community_id, id)`, para que uma linha nunca aponte para um pai de outra comunidade (D-015). O pai precisa de `UNIQUE (community_id, id)`.
- `core_community_memberships` tem uma policy adicional que permite ao usuário ler as próprias linhas em qualquer comunidade (`user_id = current_setting('app.user_id')::uuid`), para listar "minhas comunidades".
- Módulos podem ter FK para tabelas do core (`communities`, usuários), nunca para tabelas de outro módulo.

### 4.3 Papéis de banco

| Papel | Uso | Características |
|---|---|---|
| `erre_migrator` | roda migrations | dono das tabelas |
| `erre_app` | API (requisições e jobs por comunidade) | `NOSUPERUSER NOBYPASSRLS`, não é dono, só `SELECT/INSERT/UPDATE/DELETE` |
| `erre_jobs` | só listar comunidades para o runner de jobs | `SELECT` em `communities`; nada mais |

Os jobs não usam `BYPASSRLS`: o runner lista as comunidades com `erre_jobs` e executa o job **uma vez por comunidade**, em transação de tenant normal com `erre_app` (D-013).

### 4.4 Contexto da requisição

Middleware do core, nesta ordem:

1. Autentica a sessão (Better Auth) → `user`. Sem sessão: 401.
2. Lê `X-Community-Id`; valida que o usuário tem membership aprovada nessa comunidade → `community`, `role`. Sem header ou sem membership: 403.
3. Abre transação com `erre_app`; executa `SELECT set_config('app.community_id', $1, true), set_config('app.user_id', $2, true)` (local à transação).
4. Monta o contexto e executa a rota; commit ou rollback ao fim.

Para quem tem uma comunidade só, o app seleciona a comunidade automaticamente; o seletor só aparece com duas ou mais (D-014).

### 4.5 Rotas anônimas

Montadas em `/v1/<modulo>/anon/*`, **sem** o middleware de sessão (D-010):

- O handler recebe `{ community, tx }` e nada mais. Não há `user`.
- A comunidade vem no caminho (`/v1/<modulo>/anon/c/:communityId/...`) e é **validada pela própria credencial anônima**: o handler abre a transação dessa comunidade e verifica a assinatura cega contra a chave do período **dessa** comunidade. Comunidade trocada = assinatura inválida = 401. É a única forma permitida de aceitar `community_id` sem sessão.
- Cookies e `Authorization` são ignorados (e o cliente não os envia: `credentials: 'omit'` na web, sem header no nativo).
- O logger dessas rotas não registra IP, user-agent nem identificadores.
- Uma regra de ESLint proíbe importar helpers de sessão ou de usuário em `modules/*/api/anon/**`.

## 5. Contrato de módulo (v0)

O contrato é dividido em três arquivos para que o app nunca empacote código de servidor (D-019).

```ts
// modules/errometro/manifest.ts — metadados puros, importado pela API e pelo app
export default defineManifest({
  id: 'errometro',
  name: 'Errômetro',
  icon: 'heart',
  permissions: [
    { id: 'errometro.ver',     defaultRoles: ['owner', 'admin', 'moderador', 'membro'] },
    { id: 'errometro.votar',   defaultRoles: ['owner', 'admin', 'moderador', 'membro'] },
    { id: 'errometro.moderar', defaultRoles: ['owner', 'admin'] },
  ],
  menu: [{ label: 'Errômetro', route: '/errometro' }],
  notifications: [
    { id: 'errometro.resultado_pronto', label: 'Resultado liberado', defaultEnabled: true },
    { id: 'errometro.lembrete_fechamento', label: 'Lembrete antes de fechar', defaultEnabled: true },
  ],
  joinIntents: [
    { id: 'errometro.participar', label: 'Entrar e participar do Errômetro' },
  ],
  commands: [], // bot de WhatsApp (fase futura)
})
```

```ts
// modules/errometro/api/index.ts — só servidor
export default defineModuleApi(manifest, {
  api: errometroApp,          // sub-app Hono, montada em /v1/errometro
  anon: errometroAnonApp,     // sub-app Hono sem sessão, montada em /v1/errometro/anon
  jobs: [{ id: 'errometro.fechar_rodadas', schedule: '*/15 * * * *', run: closeRounds }],
  profileSections: [{ id: 'errometro.trofeus', load: loadTrophiesForProfile }],
  onJoinApproved: { 'errometro.participar': approveParticipationOnJoin }, // roda na transação da aprovação
  data: { export: exportUserData, delete: deleteUserData }, // LGPD (Sprint 19)
})
export type ErrometroApi = typeof errometroApp
```

```ts
// modules/errometro/ui/index.ts — só app
export default defineModuleUi(manifest, {
  profileSections: { 'errometro.trofeus': TrophiesProfileSection },
})
```

### 5.1 Contexto entregue ao módulo

```ts
type ModuleContext = {
  user: { id: string; displayName: string }
  community: { id: string; slug: string; name: string }
  can(permission: string): Promise<boolean>
  tx: TenantTransaction          // Drizzle, já com RLS configurado
  notify(input: NotifyInput): Promise<void>
  members: MembersPublicApi      // leitura dos membros aprovados da comunidade, com nome e avatar
}
type AnonContext = { community: { id: string }; tx: TenantTransaction }
type JobContext = { community: { id: string }; tx: TenantTransaction; notify; members; now: Date }
```

Nada além disso. Se um módulo precisar de mais, registre `[contrato]` em `DECISOES.md` e proponha ajuste. Não contorne.

### 5.2 Entrada na comunidade e intenções

- Quem entra numa comunidade usa um link de convite e fica `pending` até `owner`/`admin` aprovar (D-023).
- Um convite pode carregar uma **intenção** declarada por um módulo (`joinIntents`), como "Entrar e participar do Errômetro". A pessoa faz **um pedido só**; quando a entrada é aprovada, o core chama o `onJoinApproved` do módulo na mesma transação.
- Se o módulo não conseguir concluir (ex.: limite de votantes cheio), a entrada na comunidade vale e o módulo deixa a participação na fila dele, avisando a pessoa.

### 5.3 Permissões

- Strings `modulo.acao`, declaradas no manifesto com `defaultRoles`. O prefixo precisa ser o `id` do módulo (validado no boot).
- `core_role_permissions (community_id, role, permission)` guarda o mapeamento por comunidade, semeado pelos defaults dos manifestos. Edição pela comunidade fica para depois da migração.
- `can(p)`: verdadeiro se o papel do usuário na comunidade tem `p`. Não há escopo menor que a comunidade na v1.

### 5.4 Liga/desliga de módulos

Feature flag de ambiente, para o app inteiro (D-007):

- `MODULES_ENABLED=errometro,eventos` na API. Módulo fora da lista: rotas respondem 404 `MODULE_DISABLED`, jobs não são agendados, `notify()` vira no-op, seções de perfil somem.
- `GET /v1/modules` devolve os manifestos habilitados. O app usa isso para montar menu e proteger rotas (tela "Funcionalidade indisponível").
- As **migrations de módulos desligados continuam rodando**: o schema não depende da flag.
- Desligar = mudar a variável e reiniciar a API. Não exige novo build do app.

### 5.5 Rotas no app (Expo Router)

O Expo Router é baseado em arquivos, então telas de módulos não são registradas dinamicamente. Cada tela de módulo tem um arquivo fino em `apps/mobile/app/` que reexporta a tela do módulo:

```tsx
// apps/mobile/app/(app)/errometro/votar.tsx
export { default } from '@erre/errometro/ui/screens/VoteScreen'
```

O gerador `create-module` (Sprint 20) cria esses arquivos.

## 6. Notificações

`notify({ userIds, type, title, body, route })` (D-012):

1. Ignora se o módulo dono do `type` está desligado ou se `PUSH_ENABLED=false`.
2. Filtra usuários pelas preferências (`core_notification_preferences`, default do manifesto).
3. Envia por dois transportes: **Web Push** (VAPID, para a PWA) e **Expo Push** (Android/iOS), conforme as inscrições do usuário (`core_push_subscriptions.kind`).
4. Remove inscrições inválidas (404/410 no Web Push, `DeviceNotRegistered` no Expo).

## 7. Jobs

- Declarados no manifesto (`jobs`), executados dentro do processo da API com `node-cron`.
- Cada execução pega `pg_try_advisory_lock(<hash do job>)`: se outra instância já está rodando, pula.
- O runner lista comunidades (`erre_jobs`) e chama `run(ctx)` uma vez por comunidade, em transação de tenant (`erre_app`). Erro numa comunidade não interrompe as outras.
- Rota interna `POST /v1/internal/jobs/:id/run` (Bearer `CRON_SECRET`) para execução manual, como os endpoints de cron do legado.

## 8. Voto anônimo

O protocolo do legado é mantido (D-011):

1. Cliente autenticado pede a chave pública do período (`GET`), depois pede um token: envia a mensagem **cegada**; o servidor registra a emissão (uma por usuário/comunidade/período, **sem timestamp**) e assina às cegas.
2. Cliente finaliza a assinatura e envia os votos para a **rota anônima** com a mensagem preparada e a assinatura.
3. O servidor verifica a assinatura com a chave do período e grava os votos com um `voter_tag` derivado do token. Os votos não têm `user_id`.

Servidor: `@cloudflare/blindrsa-ts`. Cliente: implementação JS pura da parte do cliente da RFC 9474 em `@erre/anon-vote/client`, com `@noble/hashes`, `BigInt` e `expo-crypto`. Interoperabilidade é testada nos dois sentidos.
