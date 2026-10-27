# Contrato de módulo (v1)

Referência para quem escreve um módulo. Para começar, use o gerador (`pnpm create-module <id>`) e o passo a passo em [`criando-um-modulo.md`](criando-um-modulo.md); este arquivo é a referência de cada ponto. O porquê está na [ARQUITETURA §5](migration/ARQUITETURA.md#5-contrato-de-módulo-v0) e nas decisões marcadas `[contrato]` em `DECISOES.md`, consolidadas na §8. O módulo `modules/_contrato-teste` usa cada ponto deste arquivo e é testado de ponta a ponta (`apps/api/test/integration/modules.test.ts`, `apps/mobile/test/modules.test.tsx`).

**v1 (Sprint 20):** consolida o v0 (Sprint 8) com o que os dois módulos reais pediram (Sprints 12 a 19) e com o template. Mudança de contrato daqui em diante: registre `[contrato]` em `DECISOES.md`, atualize este arquivo e o template (`tools/create-module/template`), que o CI gera e testa a cada push.

## 1. Estrutura

```
modules/<id>/
  package.json        @erre/<id>; exports ".", "./api", "./db", "./domain", "./ui"
  manifest.ts         defineManifest (de @erre/core/manifest): metadados puros
  db/schema.ts        tabelas com createTenantTable (de @erre/db), listadas em `tables`
  db/migrations/      <id>_<NNNN>_<descricao>.sql
  domain/             lógica pura e schemas Zod (sem banco nem servidor); a API e o app importam
  api/index.ts        defineModuleApi (de @erre/core/server)
  api/server/         código só de servidor usado pelas rotas (repositórios, consultas, LGPD)
  api/anon/           rotas anônimas (lint proíbe sessão, cookies, Authorization, IP, user)
  ui/index.tsx        defineModuleUi (de @erre/core/client) e as telas exportadas
  ui/*.tsx            telas e seções; o app as liga por arquivos finos
  tests/integration/  contrato, matriz de permissões, isolamento (gerados)
apps/mobile/src/app/(app)/<id>/   rotas finas
apps/mobile/test/<id>.test.tsx    testes da UI com host falso (gerado)
```

Pastas que começam com `_` são só de teste: as migrations delas não rodam fora dos testes.

Código que usa `@erre/db` ou `@erre/core/server` fica dentro de `api/` (o lint trata a raiz do módulo como lado do manifesto, sem servidor). `modules/errometro` é o primeiro módulo real e serve de exemplo; `modules/eventos` mostra tabelas filhas com FK composta e itens com ciclo de vida (rascunho → ao vivo → fechado).

## 2. Manifesto (`manifest.ts`)

```ts
import { defineManifest } from '@erre/core/manifest';

export default defineManifest({
  id: 'errometro',                 // letras minúsculas e números; nomes reservados: core, auth, me, communities, ...
  name: 'Errômetro',
  icon: 'heart',                  // texto livre; ainda não aparece no app (reservado para o menu)
  permissions: [{ id: 'errometro.votar', defaultRoles: ['owner', 'admin', 'moderador', 'membro'] }],
  menu: [{ label: 'Errômetro', route: '/errometro' }],
  notifications: [{ id: 'errometro.resultado_pronto', label: 'Resultado liberado', defaultEnabled: true }],
  joinIntents: [{ id: 'errometro.participar', label: 'Entrar e participar do Errômetro' }],
});
```

- Permissões, notificações e intenções começam com `<id>.`; rotas de menu com `/<id>`. Manifesto inválido falha ao importar.
- **Importe de `@erre/core/manifest`**, nunca de `@erre/core/client`: a API também importa o manifesto, e o `client` traz React (o lint barra).
- Permissões são semeadas em `core_role_permissions` de toda comunidade nova e, no boot da API, nas comunidades que ainda não as têm (só insere, nunca remove).

## 3. Banco

- Tabela com prefixo `<id>_` (teste: `tablePrefixProblems`).
- Tabela de comunidade: `community_id uuid NOT NULL REFERENCES communities(id)` e, logo depois do `CREATE TABLE`, `SELECT erre_tenant_table('<tabela>');`. No TypeScript, `createTenantTable()`. Filhas usam FK composta `(community_id, parent_id)` (D-015).
- FK só para tabelas do core (`communities`, `auth_user`) ou do próprio módulo.
- Migration aplicada não se edita. Teste de drift: `schemaDifferences()` de `@erre/db/testing`.

## 4. API (`api/index.ts`)

```ts
import { createModuleApp, defineModuleApi, errors } from '@erre/core/server';

const api = createModuleApp().get('/rodada', async (c) => {
  const { ctx } = c.var;                       // ModuleContext
  if (!(await ctx.can('errometro.ver'))) throw errors.forbidden();
  return c.json(await ctx.tx.select().from(rounds));
});
export type ErrometroApi = typeof api;         // o app usa com import type (D-009)

export default defineModuleApi(manifest, { api, anon, jobs, profileSections, onJoinApproved, onMemberLeft, data });
```

### 4.1 `ModuleContext` (`c.var.ctx`)

| Campo | O que é |
|---|---|
| `user` | `{ id, displayName }` de quem chamou |
| `community` | `{ id, slug, name, createdAt }` validada pelo core (header `X-Community-Id` + membership aprovada). Na v1, `name` só tem letras minúsculas, números e hífens (como os grupos do legado) e é o que se mostra às pessoas. `createdAt` ancora o primeiro período de um módulo (D-043) |
| `can(permission)` | papel da pessoa na comunidade tem a permissão? |
| `tx` | transação Drizzle com RLS da comunidade; commit no sucesso, rollback se a rota lançar erro ou responder status ≥ 400 |
| `notify(input)` | `{ userIds, type, title, body, route? }`; `type` declarado no manifesto. Enviado **depois do commit**, só a quem não desligou o tipo; no-op com o módulo ou o push desligado. Passe a rota simples (`'/avisos'`): o core acrescenta `?comunidade=<id>` para o push abrir na comunidade certa (D-053) |
| `members` | `list()`, `get(userId)`, `isApprovedMember(userId)`: membros aprovados, cada um `{ userId, displayName, avatarVariant, role }`. Quem saiu ou foi removido não aparece: mostre "Ex-membro" para um id que não está na lista |

Nada além disso. Precisou de mais? Registre `[contrato]` em `DECISOES.md` e proponha.

- Montagem: `/v1/<id>/*`; a raiz do módulo se declara como `.get('', ...)` e responde em `/v1/<id>`, **sem barra no fim** (o roteamento é estrito; `.get('/', ...)` responderia só em `/v1/<id>/`). Sem sessão: 401. Sem comunidade válida: 403. Módulo desligado: 404 `MODULE_DISABLED`.
- Erros: lance `AppError` (`errors.validation`, `forbidden`, `notFound`, `conflict`, `rule`). Entrada sempre validada com `validate('json' | 'query' | 'param', schema)`.

### 4.2 Rotas anônimas (`anon`) `[contrato]`

- `createAnonApp()`, montada em `/v1/<id>/anon/c/:communityId/*`. Contexto: só `{ community: { id, createdAt }, tx }`. Não há `members`: o que a rota precisa saber de membros vem das tabelas do próprio módulo, mantidas em dia por `onMemberLeft` (D-043).
- O runtime repassa ao módulo **uma cópia da requisição só com `content-type`, `accept` e `accept-language`**: cookies, `Authorization`, IP e user agent não chegam, mesmo que o cliente mande. Comunidade inexistente: 404.
- A rota valida a comunidade pela credencial anônima (assinatura cega da chave do período dessa comunidade, ARQUITETURA §4.5). O lint `erre/no-identity-in-anon` vale para `api/anon/**`.

### 4.3 Jobs

```ts
jobs: [{ id: 'errometro.fechar_rodadas', schedule: '*/15 * * * *', run: async (ctx) => { /* JobContext */ } }]
```

- `JobContext`: `{ community: { id, slug, name, createdAt }, tx, notify, members, now }`. Roda **uma vez por comunidade**, cada uma na sua transação; erro numa comunidade não para as outras.
- Agendado com `node-cron` no fuso `VOTING_TIMEZONE` (D-020). Lock consultivo por job: se outra instância está rodando, pula.
- Execução manual: `POST /v1/internal/jobs/<id>/run` com `Authorization: Bearer $CRON_SECRET` (sem `CRON_SECRET`, a rota não existe). Módulo desligado: o job não é agendado nem executável.

### 4.4 Seções de perfil `[contrato]`

`profileSections: [{ id: '<id>.<nome>', load: async (ctx, userId) => dados | null }]`. O core expõe `GET /v1/profile/:userId/sections` (na comunidade do header, só para membro aprovado) e junta as seções dos módulos ligados. Cada seção roda num savepoint: se falhar, some só ela. `null` esconde a seção.

### 4.5 Entrada com intenção e saída de membro `[contrato]`

- `onJoinApproved: { '<id>.participar': async ({ tx, communityId, userId, actorId }) => {...} }`: um handler por intenção do manifesto (validado no boot). Roda na transação da aprovação, em savepoint: se falhar, só a parte do módulo é desfeita e a pessoa entra. Regra de negócio que não cabe (ex.: limite de votantes) **não lança erro**: deixe na fila do módulo.
- `onMemberLeft: async (ctx) => {...}`: rejeição, remoção ou saída. Mesma transação; **se falhar, nada muda** (500). Roda para todo módulo registrado, ligado ou não, para os dados ficarem consistentes se o módulo voltar.
- Intenções de módulo desligado não aparecem nem são aceitas em convites.

### 4.6 Dados pessoais (LGPD) `[contrato]`

`data: { export: async ({ tx, communityId }, userId) => json | null, delete: async ({ tx, communityId }, userId) => {} }` em `defineModuleApi`. O core chama os dois em cada comunidade da pessoa, na transação dessa comunidade e sem sessão: `export` em `GET /v1/me/export`, `delete` na exclusão feita por quem opera (`POST /v1/internal/users/:id/delete` com `ADMIN_SECRET`). Rode para todo módulo registrado, ligado ou não. Votos anônimos nunca entram. Detalhes em [`docs/lgpd.md`](lgpd.md).

## 5. App (`ui/index.tsx`)

```tsx
import { defineModuleUi, useModuleClient, type HubSectionProps } from '@erre/core/client';
import type { ErrometroApi } from '../api';

function HubSection({ community }: HubSectionProps) {
  const client = useModuleClient<ErrometroApi>('errometro');   // hc tipado, com sessão e X-Community-Id
  // useQuery(... client.rodada.$get() ...)
}

export default defineModuleUi(manifest, { hubSection: HubSection, profileSections: { 'errometro.trofeus': Trophies } });
```

- Chamadas: `callModule(() => client.rota.$get())` devolve o JSON ou lança `ModuleApiError` (`status`, `code` e mensagem em pt-BR pronta para a tela; sem rede: `NETWORK_ERROR`). Use como `queryFn`/`mutationFn` do React Query, com a comunidade na chave (`['<id>', community.id, ...]`).
- `useModuleHost()`: `{ community, apiUrl, webUrl, fetch, navigate, back, openMember, storage, secureStorage }`. `webUrl` é o endereço público do app (links compartilhados); `back()` volta ("← Início"); `openMember(userId)` abre a página do membro (nome, avatar e as seções de perfil de todos os módulos), em vez do módulo conhecer a rota do core (D-049). `storage` guarda preferências e cache (AsyncStorage / `localStorage`), `secureStorage` guarda segredos (secure store / `localStorage`, até 2 KB); chaves começam com o id do módulo e só têm letras, números, `.`, `-` e `_` (D-045).
- Rota anônima no app: `fetch` comum com `credentials: 'omit'` e só `content-type`, nunca o `fetch` do host (que leva a sessão). Exemplo: `modules/errometro/ui/anon.ts`.
- Registro estático em `apps/mobile/src/modules.ts`. O módulo aparece só se estiver no registro **e** em `GET /v1/modules`.
- Rotas finas em `apps/mobile/src/app/(app)/<id>/...`: `export default withModule('<id>', Tela);` (mostra "Funcionalidade indisponível" se o módulo estiver desligado).
- Telas só com componentes de `@erre/ui` e tokens (DESIGN.md).

## 6. Liga e desliga

`MODULES_ENABLED=errometro,eventos` na API (D-007). Nome desconhecido impede o boot. Desligar = mudar a variável e reiniciar. As migrations rodam com o módulo ligado ou não.

## 7. Testes do módulo

- `@erre/core/testing`: `createModuleHarness({ urls, modules })` monta o core e o runtime sobre o banco de teste, sem `apps/api`:
  - `h.req(user | null, método, caminho, { community, body, headers })` chama a API como a pessoa (`null`: sem sessão);
  - `h.fixture(nome?)` cria uma comunidade com uma pessoa por papel, uma pendente e uma de fora (`fx.users.owner`, ..., `fx.users.outsider`); o nome segue a regra de nome de comunidade (minúsculas, números e hífens);
  - `recordPush: true` grava os pushes; `h.subscribe(user)` registra um aparelho falso da pessoa e `h.pushesAfter(() => ...)` devolve os pushes que a ação mandou;
  - `adminSecret: '...'` liga a exclusão LGPD: teste `data.export`/`data.delete` com `GET /v1/me/export` e `POST /v1/internal/users/:id/delete` (`Authorization: Bearer <segredo>`);
  - saída de membro (para testar `onMemberLeft`): ``h.req(user, 'POST', `/v1/communities/${id}/leave`, { community: id })``;
  - jobs com `h.runtime.runJob(id, now)`; `log` opcional para conferir o que é logado.
- Também em `@erre/core/testing`: `installFakeGoogle`, `createTestUser`, `addMember`, `createRoleFixture` (uma pessoa por papel + pendente + de fora), `permissionMatrix`, `tablePrefixProblems`.
- Banco de teste: um `globalSetup` com `createTestDatabase({ root })` (as migrations do módulo entram sozinhas). Exemplo em `modules/errometro/tests/integration/`.
- `@erre/db/testing`: `createTestDatabase({ root, extraSources })`, `schemaDifferences`, `indexProblems` (índice de tabela de comunidade que não começa por `community_id`).
- `moduleProblems([moduleApi])` deve ser `[]`.
- O gerador já cria: `contract.test.ts` (manifesto, prefixo, schema = migrations, índices), `permissions.test.ts` (uma matriz por rota), `isolation.test.ts` (outra comunidade não vê nem apaga, nem pelo header) e, com `--anon`, `anon.test.ts`. Ao criar uma rota, acrescente o caso dela na matriz.
- UI: `apps/mobile/test/helpers/module-host.tsx` (`fakeModuleHost(moduleId, rotas)`) renderiza as telas com um host falso; a API vira um mapa `"MÉTODO /caminho" → resposta`.

## 8. Histórico do contrato (`[contrato]` em `DECISOES.md`)

| Decisão | O que entrou no contrato | Onde |
|---|---|---|
| D-005 | Código compartilhado entre módulos vai para pacotes (`@erre/anon-vote`, `@erre/emoji`) | §1 |
| D-010 | Sub-app `anon` sem sessão, contexto `{ community, tx }` | §4.2 |
| D-012 | `notify()` com Web Push e Expo Push; tipos no manifesto; preferências por tipo | §2, §4.1 |
| D-013 | `jobs` por comunidade, com lock consultivo e o papel `erre_jobs` | §4.3 |
| D-018 | `profileSections` (API carrega, UI renderiza) | §4.4, §5 |
| D-019 | Três arquivos: `manifest.ts`, `api/index.ts`, `ui/index.tsx` | §1 |
| D-026 | Sem subgrupos: tudo é da comunidade; `ctx.members` no lugar de `ctx.groups` | §4.1 |
| D-043 | `community.createdAt` nos contextos; rota anônima sem `members` (o módulo mantém os seus com `onMemberLeft`) | §4.1, §4.2 |
| D-044 | `JobContext.community` com `slug` e `name`; `recordPush` no harness | §4.3, §7 |
| D-045 | `ModuleHost.storage` e `secureStorage` | §5 |
| D-046 | `ModuleHost.webUrl` e `back()` | §5 |
| D-047, D-048 | Sem mudança de interface; padrões: lock por comunidade, FK composta das filhas, `period` = id do evento | §3, §4.2 |
| D-049 | `ModuleHost.openMember(userId)` | §5 |
| D-050 | `data: { export, delete }` (LGPD); limites de requisição no runtime | §4.6 |
| D-052 | `callModule`/`ModuleApiError` no `@erre/core/client`; gerador e template testado no CI | §5, §7 |
| D-053 | `notify()` acrescenta `?comunidade=<id>` à rota; `pushesAfter` no harness; `ErrorState` com `onBack`; contrato documentado onde o módulo `avisos` travou | §4.1, §7 |

D-006 (grupos no core) foi substituída por D-026 e não vale mais.
