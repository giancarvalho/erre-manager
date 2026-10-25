# Contrato de módulo (v0)

Referência para quem escreve um módulo. O porquê está na [ARQUITETURA §5](migration/ARQUITETURA.md#5-contrato-de-módulo-v0) e nas decisões D-007 a D-019, D-023, D-026 e D-039. O módulo `modules/_contrato-teste` usa cada ponto deste arquivo e é testado de ponta a ponta (`apps/api/test/integration/modules.test.ts`, `apps/mobile/test/modules.test.tsx`).

> **Gate humano (Sprint 8):** este contrato precisa de revisão antes dos módulos reais (Sprints 12 a 17). Itens marcados `[contrato]` são insumo para o template do hackathon.

## 1. Estrutura

```
modules/<pasta>/
  package.json        @erre/<nome>; exports ".", "./api", "./db", "./ui"
  manifest.ts         defineManifest (de @erre/core/manifest): metadados puros
  db/schema.ts        tabelas com createTenantTable (de @erre/db)
  db/migrations/      <id>_<NNNN>_<descricao>.sql
  api/index.ts        defineModuleApi (de @erre/core/server)
  api/anon/           rotas anônimas (lint proíbe sessão, cookies, Authorization, IP, user)
  ui/index.tsx        defineModuleUi (de @erre/core/client)
  ui/screens/         telas; o app as liga por arquivos finos
  tests/
```

Pastas que começam com `_` são só de teste: as migrations delas não rodam fora dos testes.

## 2. Manifesto (`manifest.ts`)

```ts
import { defineManifest } from '@erre/core/manifest';

export default defineManifest({
  id: 'errometro',                 // letras minúsculas e números; nomes reservados: core, auth, me, communities, ...
  name: 'Errômetro',
  icon: 'heart',
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

export default defineModuleApi(manifest, { api, anon, jobs, profileSections, onJoinApproved, onMemberLeft });
```

### 4.1 `ModuleContext` (`c.var.ctx`)

| Campo | O que é |
|---|---|
| `user` | `{ id, displayName }` de quem chamou |
| `community` | `{ id, slug, name }` validada pelo core (header `X-Community-Id` + membership aprovada) |
| `can(permission)` | papel da pessoa na comunidade tem a permissão? |
| `tx` | transação Drizzle com RLS da comunidade; commit no sucesso, rollback se a rota lançar erro ou responder status ≥ 400 |
| `notify(input)` | notificação (Sprint 9; até lá só registra). Vira no-op se o módulo estiver desligado |
| `members` | `list()`, `get(userId)`, `isApprovedMember(userId)`: membros aprovados com nome e avatar |

Nada além disso. Precisou de mais? Registre `[contrato]` em `DECISOES.md` e proponha.

- Montagem: `/v1/<id>/*`. Sem sessão: 401. Sem comunidade válida: 403. Módulo desligado: 404 `MODULE_DISABLED`.
- Erros: lance `AppError` (`errors.validation`, `forbidden`, `notFound`, `conflict`, `rule`). Entrada sempre validada com `validate('json' | 'query' | 'param', schema)`.

### 4.2 Rotas anônimas (`anon`) `[contrato]`

- `createAnonApp()`, montada em `/v1/<id>/anon/c/:communityId/*`. Contexto: só `{ community: { id }, tx }`.
- O runtime repassa ao módulo **uma cópia da requisição só com `content-type`, `accept` e `accept-language`**: cookies, `Authorization`, IP e user agent não chegam, mesmo que o cliente mande. Comunidade inexistente: 404.
- A rota valida a comunidade pela credencial anônima (assinatura cega da chave do período dessa comunidade, ARQUITETURA §4.5). O lint `erre/no-identity-in-anon` vale para `api/anon/**`.

### 4.3 Jobs

```ts
jobs: [{ id: 'errometro.fechar_rodadas', schedule: '*/15 * * * *', run: async (ctx) => { /* JobContext */ } }]
```

- `JobContext`: `{ community: { id }, tx, notify, members, now }`. Roda **uma vez por comunidade**, cada uma na sua transação; erro numa comunidade não para as outras.
- Agendado com `node-cron` no fuso `VOTING_TIMEZONE` (D-020). Lock consultivo por job: se outra instância está rodando, pula.
- Execução manual: `POST /v1/internal/jobs/<id>/run` com `Authorization: Bearer $CRON_SECRET` (sem `CRON_SECRET`, a rota não existe). Módulo desligado: o job não é agendado nem executável.

### 4.4 Seções de perfil `[contrato]`

`profileSections: [{ id: '<id>.<nome>', load: async (ctx, userId) => dados | null }]`. O core expõe `GET /v1/profile/:userId/sections` (na comunidade do header, só para membro aprovado) e junta as seções dos módulos ligados. Cada seção roda num savepoint: se falhar, some só ela. `null` esconde a seção.

### 4.5 Entrada com intenção e saída de membro `[contrato]`

- `onJoinApproved: { '<id>.participar': async ({ tx, communityId, userId, actorId }) => {...} }`: um handler por intenção do manifesto (validado no boot). Roda na transação da aprovação, em savepoint: se falhar, só a parte do módulo é desfeita e a pessoa entra. Regra de negócio que não cabe (ex.: limite de votantes) **não lança erro**: deixe na fila do módulo.
- `onMemberLeft: async (ctx) => {...}`: rejeição, remoção ou saída. Mesma transação; **se falhar, nada muda** (500). Roda para todo módulo registrado, ligado ou não, para os dados ficarem consistentes se o módulo voltar.
- Intenções de módulo desligado não aparecem nem são aceitas em convites.

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

- `useModuleHost()`: `{ community, apiUrl, fetch, navigate }`.
- Registro estático em `apps/mobile/src/modules.ts`. O módulo aparece só se estiver no registro **e** em `GET /v1/modules`.
- Rotas finas em `apps/mobile/src/app/(app)/<id>/...`: `export default withModule('<id>', Tela);` (mostra "Funcionalidade indisponível" se o módulo estiver desligado).
- Telas só com componentes de `@erre/ui` e tokens (DESIGN.md).

## 6. Liga e desliga

`MODULES_ENABLED=errometro,eventos` na API (D-007). Nome desconhecido impede o boot. Desligar = mudar a variável e reiniciar. As migrations rodam com o módulo ligado ou não.

## 7. Testes do módulo

- `@erre/core/testing`: `installFakeGoogle`, `createTestUser`, `createRoleFixture` (uma pessoa por papel + pendente + de fora), `permissionMatrix`, `tablePrefixProblems`.
- `@erre/db/testing`: `createTestDatabase({ root, extraSources })`, `schemaDifferences`.
- `moduleProblems([moduleApi])` deve ser `[]`.
