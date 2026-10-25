# Sprint 4 — `packages/db`: papéis, RLS e migrations

**Gate humano:** revisar a abordagem de RLS (D-035). Pela D-029 a execução seguiu; a revisão é assíncrona.

## O que foi feito

- `@erre/db`: `createDb()` (pool por papel), `withTenantTx()` (`set_config(..., true)` de `app.community_id` e `app.user_id`; rejeita id que não é uuid), `createTenantTable()`, tabela `communities`, `GLOBAL_TABLES`, reexport dos helpers do Drizzle e de `pg-core` para os módulos.
- Papéis: `scripts/db-bootstrap-roles.sql` (idempotente, roda igual no `psql` e no `db:bootstrap`). `erre_app` sem superuser, sem `BYPASSRLS`, só DML; `erre_jobs` só lê `communities`; `erre_migrator` dono das tabelas. Fora de localhost o CLI exige as senhas por variável.
- Migration `db_0001_base`: `communities` e a função `erre_tenant_table()`.
- Runner de migrations por dono, com checksum, ordem determinística, lock e `-- migrate:down`; CLI `db:bootstrap`, `db:migrate`, `db:rollback <dono>`.
- `@erre/db/testing`: banco descartável por execução de testes e `schemaDifferences()` (drift), para core e módulos reaproveitarem.

## Testes (26, todos verdes, em toda PR pelo CI)

- Isolamento: com o contexto de A, ler, atualizar, apagar, inserir em B e mover linha para B falham (zero linhas ou erro `42501`).
- Fail closed: sem `app.community_id` dá erro `42704`; depois de uma transação, a mesma conexão fica sem comunidade (cast vazio dá `22P02`).
- Papéis: `erre_app` e `erre_jobs` não são donos de nada; `erre_app` não cria tabela, não desliga RLS, não lê `erre_migrations` nem executa a função; `erre_jobs` só lê `communities`.
- Cobertura de RLS e allowlist de tabelas globais; drift Drizzle × banco.
- Runner: ordem, idempotência, rollback, migration editada, numeração fora de ordem, falha sem deixar resto, tabela de comunidade sem `community_id`.

## Decidido

- D-035: SQL escrito à mão + função `erre_tenant_table()` no banco + teste de drift, sem `drizzle-kit`.

## Pendente

- Policy extra de `core_community_memberships` (ler as próprias linhas) entra no Sprint 6, com a tabela.
- O tipo do id de usuário (Better Auth usa texto por padrão) se resolve no Sprint 5; `app.user_id` não tem cast por enquanto.

## Riscos

- Bancos gerenciados podem não permitir `REVOKE CREATE ON SCHEMA public` ou papéis com `LOGIN` criados por script; o bootstrap de produção é do humano e pode precisar de ajuste ao provedor (Sprint 19).

## Contrato `[contrato]`

- Para um módulo, criar uma tabela de comunidade são duas coisas: o SQL (com `SELECT erre_tenant_table(...)`) e o `createTenantTable()` no TypeScript. O teste de drift avisa quando as duas metades divergem, mas o template do hackathon deve trazer um exemplo pronto das duas.
