# Contribuindo

Leia o [`AGENTS.md`](AGENTS.md) antes de tudo. Ele vale para pessoas e agentes.

## Requisitos

- Node 22 (`.nvmrc`) e pnpm 10 (`corepack enable` instala a versão de `packageManager`).
- Docker, para o Postgres local (`docker compose up -d`).

## Rodar

```sh
pnpm install
pnpm --filter @erre/api dev      # API em http://localhost:3000/v1/health
pnpm --filter @erre/mobile web   # app na web; use "android" ou "ios" com um aparelho ou emulador
```

Banco local (uma vez, depois de `docker compose up -d`; variáveis em `packages/db/.env.example`):

```sh
export DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/erre
export DATABASE_MIGRATOR_URL=postgres://erre_migrator:erre_migrator@localhost:5432/erre
pnpm --filter @erre/db db:bootstrap   # papéis erre_migrator, erre_app, erre_jobs
pnpm --filter @erre/db db:migrate     # aplica as migrations de db, core e módulos
```

Os testes de banco criam e apagam bancos descartáveis usando `DATABASE_ADMIN_URL` (padrão: o Postgres do `docker compose`). Nunca aponte essa variável para produção.

Migration nova: arquivo `<dono>_<NNNN>_<descricao>.sql` na pasta do dono (`packages/db/migrations`, `packages/core/migrations`, `modules/<nome>/db/migrations`), com uma seção `-- migrate:down` quando der para reverter. Tabela de comunidade: `community_id uuid NOT NULL REFERENCES communities(id)` e, logo depois do `CREATE TABLE`, `SELECT erre_tenant_table('<tabela>');`. Migration aplicada não se edita: escreva outra.

Cada app tem um `.env.example`. Copie para `.env` e ajuste. Nunca coloque valores reais em arquivos versionados.

## Checks

```sh
pnpm check       # Prettier + lint + typecheck + testes + build (o mesmo que o CI)
pnpm test:e2e    # Playwright contra o export web do app (precisa do build)
pnpm format      # corrige a formatação
```

- Testes unitários: Vitest em pacotes e na API; `jest-expo` + Testing Library no app.
- E2E: Playwright no export web (`apps/mobile/e2e`).
- O lint aplica as fronteiras da arquitetura (`erre/boundaries`) e a regra das rotas anônimas (`erre/no-identity-in-anon`). Se o lint bloquear um import, a correção é mudar o desenho, não desligar a regra.

## Branches, commits e PRs

- Branch por sprint: `sprint-NN-<slug>`. Um PR por sprint (ou mais, se o sprint for grande), com o número do sprint no título.
- Commits pequenos e descritivos, no formato `tipo(sprint-NN): resumo` (ex.: `feat(sprint-04): papéis do banco`).
- O PR só entra com o CI verde. Mudanças de interface trazem o checklist da §14 do `docs/design/DESIGN.md` e prints nas três plataformas.
- Dependência nova: registre em `docs/libs-aprovadas.md` no mesmo PR.
