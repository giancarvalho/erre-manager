# Sprint 8 — Runtime de módulos (contrato v0) e shell do app

**Gate humano:** revisar o contrato v0 (`docs/CONTRATO.md`, D-039) antes dos módulos reais. Pela D-029, sigo para os sprints que não dependem dele (9, 10, 11) e para os módulos; mudanças no contrato depois da revisão viram ajuste nesses sprints.

## O que foi feito

- `@erre/core/manifest` (`defineManifest`, validação), `@erre/core/server` (`defineModuleApi`, `createModuleApp`, `createAnonApp`, `createModuleRuntime`, `moduleProblems`, `parseEnabledModules`) e `@erre/core/client` (`defineModuleUi`, `ModuleHostProvider`, `useModuleHost`, `useModuleClient`).
- Runtime: montagem por módulo com flag (`MODULE_DISABLED`), contexto do módulo, rotas anônimas com requisição sem identificação, `GET /v1/modules`, `GET /v1/profile/:userId/sections`, jobs (`node-cron`, lock, uma transação por comunidade, rota interna com `CRON_SECRET`), semeadura de permissões no boot.
- `apps/api`: registro estático (vazio até o Errômetro), `MODULES_ENABLED`, `DATABASE_JOBS_URL`, `CRON_SECRET`, `VOTING_TIMEZONE`.
- App: registro de UIs, seções do hub, menu, `withModule` para rotas finas, "Funcionalidade indisponível".
- Módulo de teste `modules/_contrato-teste`: três tabelas, rotas com permissão, rota anônima, job, seção de perfil, intenção de entrada e saída, UI com seção do hub usando o cliente tipado.
- `docs/CONTRATO.md` v0. Lint: manifesto, API de módulo e `apps/api` não importam `@erre/core/client`.

## Testes

- API com o módulo de teste (16 novos): manifesto só dos ligados; módulo ligado responde, desligado dá 404 inclusive na rota anônima; job de módulo desligado não é agendado nem executável; contexto exige sessão e membership; matriz das permissões do manifesto; dados do módulo ficam na comunidade; **rota anônima não recebe usuário, cookie, Authorization, IP nem user agent mesmo com sessão válida**; comunidade inválida na rota anônima → 404; **job roda uma vez por comunidade e cada execução só vê a sua comunidade**; job pula com lock ocupado; rota interna exige o segredo; permissões semeadas na criação e no boot (idempotente); seções de perfil; intenção do módulo na aprovação e limpeza na saída; módulo desligado não tem intenção.
- Core (65): validação de manifesto (10 casos) e de módulos no boot.
- Config (49): regras novas de importação.
- App (14): módulo ligado mostra a seção e o menu e usa o cliente tipado com a comunidade certa; desligado some do hub; rota de módulo desligado mostra "indisponível".
- Módulo de teste: manifesto válido e prefixo das tabelas.

## Pendente

- Revisão humana do contrato (gate).
- `notify()` real (Sprint 9).

## Riscos

- O app ainda não tem módulos reais no registro; a primeira integração real (Errômetro, Sprints 12–15) vai exercitar o contrato com regras de verdade.

## Contrato `[contrato]`

- Tudo neste sprint. Duas dores encontradas: (1) o manifesto importando o entry com React levaria React para a API (resolvido com `@erre/core/manifest` + lint); (2) tipos de `Hono` com `Env` diferentes não se compõem sem `cast` no runtime: o módulo não sente isso, mas quem mexer no runtime vai.
