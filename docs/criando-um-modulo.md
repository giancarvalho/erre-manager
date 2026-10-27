# Criando um módulo

Passo a passo para criar um módulo novo (uma funcionalidade da comunidade, como o Errômetro ou Eventos). Você não precisa conhecer o resto do código: o gerador cria um módulo que já funciona, com testes, e você o transforma no seu. A referência de cada peça está em [`CONTRATO.md`](CONTRATO.md); as regras gerais em [`AGENTS.md`](../AGENTS.md).

## 0. Antes de começar

Preparar o ambiente uma vez (detalhes em [`CONTRIBUTING.md`](../CONTRIBUTING.md)):

```sh
corepack enable && pnpm install
docker compose up -d                                   # Postgres local
export DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/erre
export DATABASE_MIGRATOR_URL=postgres://erre_migrator:erre_migrator@localhost:5432/erre
pnpm --filter @erre/db db:bootstrap
pnpm check                                             # tudo verde antes de mexer
```

Para rodar os testes, basta o Postgres e `DATABASE_ADMIN_URL`: cada execução cria e apaga um banco descartável. O `DATABASE_MIGRATOR_URL` e o `db:bootstrap` só são necessários para ver o módulo funcionando no seu banco local (passo 2).

Escolha o **id** do módulo: letras minúsculas e números, começando por letra (`avisos`, `enquete`, `caronas`). Ele vira o nome da pasta, o prefixo das tabelas (`avisos_...`), das permissões (`avisos.ver`) e o caminho da API (`/v1/avisos`). Nomes reservados: `core`, `auth`, `me`, `communities`, `invites`, `modules`, `internal`, `profile`, `health`, `test`, `db`.

## 1. Gerar

```sh
pnpm create-module avisos --nome "Mural de avisos"
pnpm install
```

Use `--anon` se o módulo tiver votação ou envio anônimo (veja o passo 6).

O gerador cria `modules/avisos` e registra o módulo em todo lugar que precisa:

| Arquivo | O que é |
|---|---|
| `modules/avisos/manifest.ts` | nome, permissões, entrada no menu |
| `modules/avisos/db/schema.ts` e `db/migrations/avisos_0001_base.sql` | a tabela de exemplo `avisos_items` |
| `modules/avisos/domain/schemas.ts` | regras de entrada (Zod), usadas pela API e pela tela |
| `modules/avisos/api/index.ts` | rotas: listar, criar, apagar |
| `modules/avisos/api/server/privacy.ts` | exportar e apagar os dados de uma pessoa (LGPD) |
| `modules/avisos/ui/` | seção no hub da comunidade e a tela do módulo |
| `modules/avisos/tests/integration/` | contrato, matriz de permissões, isolamento entre comunidades |
| `apps/mobile/src/app/(app)/avisos/index.tsx` | a rota `/avisos` no app |
| `apps/mobile/test/avisos.test.tsx` | testes da tela com uma API falsa |
| `apps/api/src/modules.ts`, `apps/mobile/src/modules.ts`, os dois `package.json`, `apps/api/.env.example` | registro |

Confira que o módulo gerado passa antes de mudar qualquer coisa:

```sh
pnpm --filter @erre/avisos test         # API (cria um banco descartável)
pnpm --filter @erre/mobile test -- avisos
```

## 2. Ver funcionando

1. No `apps/api/.env`, acrescente o id: `MODULES_ENABLED=errometro,eventos,avisos`.
2. Aplique a migration: `pnpm --filter @erre/db db:migrate`.
3. Suba a API e o app: `pnpm --filter @erre/api dev` e `pnpm --filter @erre/mobile web`.
4. Entre, abra uma comunidade: a seção "Mural de avisos" aparece no hub, com a entrada no menu.

Para ter comunidades com uma pessoa por papel: `DATABASE_URL=postgres://erre_app:erre_app@localhost:5432/erre pnpm --filter @erre/core seed:dev`.

## 3. Modelar os dados

Edite `db/schema.ts` **e** escreva a migration correspondente. O teste de contrato compara os dois e falha se divergirem.

- Toda tabela é da comunidade: `createTenantTable('<id>_<nome>', {...})` no TypeScript; na migration, `community_id uuid NOT NULL REFERENCES communities(id)` e `SELECT erre_tenant_table('<tabela>');` logo depois do `CREATE TABLE`. Isso liga o RLS: uma comunidade nunca lê a outra, mesmo com bug na rota.
- Índices começam por `community_id`.
- Tabela filha aponta para a mãe por `(community_id, <mae>_id)` (veja `modules/eventos/db`).
- Liste toda tabela em `tables`.
- Antes do primeiro merge, ainda dá para editar a `_0001_`. Depois que ela foi aplicada em algum lugar, mudança é migration nova: `avisos_0002_<descricao>.sql`. Detalhes em [`guia-pr-e-migrations.md`](guia-pr-e-migrations.md).

## 4. Escrever as rotas

Em `api/index.ts`, cada rota recebe `c.var.ctx` com quem chamou (`user`), a comunidade já validada (`community`), `can(permissão)`, `tx` (transação limitada à comunidade), `notify` e `members`. Toda rota faz duas coisas:

1. confere a permissão (`requirePermission(ctx, 'avisos.ver')`);
2. valida a entrada com Zod (`validate('json', Schema)`, `validate('param', ...)`).

Erros com `errors.forbidden()`, `errors.notFound('...')`, `errors.conflict(...)`, `errors.rule('CODIGO', '...')`: a mensagem vai para a tela, então escreva em pt-BR simples.

Permissão nova vai no `manifest.ts` (`{ id: 'avisos.publicar', defaultRoles: ['owner', 'admin'] }`) e ganha um caso na matriz de `tests/integration/permissions.test.ts`. Rota nova sempre ganha um caso na matriz.

Notificação: declare o tipo no manifesto (`notifications: [{ id: 'avisos.novo', label: 'Aviso novo', defaultEnabled: true }]`) e chame `ctx.notify({ userIds, type: 'avisos.novo', title, body, route: '/avisos' })`. Ela só sai depois do commit e respeita as preferências de cada pessoa; o core acrescenta a comunidade à rota, para o toque abrir a comunidade certa. Para escolher os destinatários, `ctx.members.list()` devolve os membros aprovados (`{ userId, displayName, avatarVariant, role }`); em geral, tire quem fez a ação. No teste, `h.pushesAfter(() => ...)` devolve o que foi enviado (veja `modules/avisos/tests/integration/avisos.test.ts`).

Dados pessoais: atualize `api/server/privacy.ts` para cada tabela nova que guarda algo de uma pessoa (o que exportar, o que apagar).

Listas que crescem sem parar (avisos, comentários) precisam de limite. A v1 ainda não tem um padrão de paginação no contrato: use `limit` e um cursor por data (`?antes=<createdAt>`) e conte no PR com `[contrato]`.

## 5. Fazer as telas

A tela gerada (`ui/ItemsScreen.tsx`) é o exemplo: cabeçalho com "← Início", formulário só para quem pode gerenciar, lista, estados de carregando, vazio e erro, e apagar com confirmação. Os dados vêm de `ui/data.ts`: o cliente tipado da sua API (`useModuleClient`) com React Query e `callModule`, que devolve o JSON ou lança um erro com a mensagem da API.

Tela nova: crie o componente em `ui/`, exporte em `ui/index.tsx` e crie a rota fina no app, por exemplo `apps/mobile/src/app/(app)/avisos/[id].tsx`:

```tsx
import { AvisoScreen } from '@erre/avisos/ui';

import { withModule } from '@/lib/modules';

export default withModule('avisos', AvisoScreen);
```

Para navegar, use o host (`useModuleHost()`): `navigate('/avisos/123')`, `back()`, `openMember(userId)`. Para guardar preferências no aparelho: `storage` (chaves começando com o id do módulo).

### Design do seu módulo

Leia o [`docs/design/DESIGN.md`](design/DESIGN.md) antes de desenhar qualquer tela: ele é requisito, não acabamento. O essencial:

- **Só componentes de `@erre/ui` e tokens** (`space`, `Text` com variantes). Nada de cor, fonte ou espaçamento escrito à mão; o lint barra `#hex`, `rgba(...)` e `fontSize` soltos.
- Cabeçalho com `Screen` + `Button` "← Início" (fantasma) + `ScreenHeader` (sobretítulo, título, descrição).
- **No máximo um botão primário por tela.** Ações destrutivas usam a variante `destructive` e `ConfirmDialog`.
- Toda tela que carrega dados tem os estados de §9.15: `Skeleton` carregando, `EmptyState` vazio (emoji, uma frase, uma ação), `ErrorState` erro ("Tentar de novo").
- Formulários com `TextField` (rótulo em cima, erro embaixo); o erro vem do mesmo schema Zod que a API usa.
- Funciona nos dois temas (escuro é o padrão) sem nenhum `if` de tema na tela: os tokens já resolvem.
- Textos em pt-BR, no tom da §11: verbo da ação nos botões ("Publicar aviso"), sem jargão.

A galeria de componentes roda no app em `/dev/ui` (com `EXPO_PUBLIC_DEV_GALLERY=1`). Se faltar um componente, proponha a adição ao `DESIGN.md` e ao `packages/ui` no mesmo PR em vez de improvisar na tela.

## 6. Rota anônima (só se precisar)

Rota anônima é para quando **o servidor não pode saber quem fez** (voto secreto). Ela fica em `api/anon/`, responde em `/v1/<id>/anon/c/<comunidade>/...` e não recebe sessão, cookie nem IP: o lint impede ler qualquer identidade ali. Tudo que ela grava precisa ser autorizado por um token de assinatura cega de `@erre/anon-vote`. É o desenho mais delicado do projeto: siga o Errômetro (`modules/errometro/api/anon` e `ui/anon.ts`) e peça revisão.

## 7. Testar

```sh
pnpm --filter @erre/avisos test          # contrato, permissões, isolamento, suas regras
pnpm --filter @erre/mobile test -- avisos
pnpm check                               # o mesmo que o CI
```

- **Regra de negócio pura** (cálculos, validações): função em `domain/` com teste unitário em `tests/domain/`.
- **Rota:** teste de integração com `createModuleHarness` (veja os gerados). `h.fixture()` cria uma comunidade com uma pessoa por papel, uma pendente e uma de fora.
- **Tela:** `fakeModuleHost('avisos', { 'GET ': () => json({...}) })` em `apps/mobile/test`.

## 8. Abrir o PR

Siga o [`guia-pr-e-migrations.md`](guia-pr-e-migrations.md): CI verde, checklist de interface da §14 do DESIGN.md e prints. Se algo no contrato atrapalhou (faltou um campo no contexto, uma permissão não cabia), escreva no PR com a marca `[contrato]`: é assim que o contrato melhora.

## Onde olhar quando travar

| Dúvida | Exemplo |
|---|---|
| Tabela filha, ciclo de vida (rascunho → ao vivo → fechado), job agendado | `modules/eventos` |
| Módulo simples feito só com o gerador e este guia: autor, push, LGPD | `modules/avisos` |
| Notificação, seção de perfil, intenção no convite (`joinIntents`) | `modules/errometro`, `modules/_contrato-teste` |
| Voto anônimo de ponta a ponta | `modules/errometro/api/anon`, `modules/errometro/ui/anon.ts` |
| Tudo o que o contrato oferece | [`CONTRATO.md`](CONTRATO.md) |
