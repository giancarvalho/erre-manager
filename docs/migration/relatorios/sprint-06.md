# Sprint 6 — Comunidades, papéis, `can()` e contexto da requisição

**Gate humano:** revisar isolamento e modelo de permissões (D-037). Pela D-029 a execução seguiu; a revisão é assíncrona.

## O que foi feito

- Migration `core_0003_memberships`: `core_community_memberships` (RLS de comunidade + policy de leitura das próprias linhas) e `core_role_permissions`.
- `withUserTx()` em `@erre/db`; middleware `requireCommunity` (header `X-Community-Id`, membership `approved`, transação de tenant com rollback em erro), `can()` com cache por requisição, `requirePermission`, `validate()` (Zod para body, query e params).
- Rotas: `POST /v1/communities`, `GET /v1/me/communities`, `GET /v1/communities/:id` (papel e permissões), `PATCH /v1/communities/:id/members/:userId`.
- `@erre/core/testing`: `createTestUser`, `addMember`, `createRoleFixture` (um membro por papel, um pendente, um de fora) e `permissionMatrix`, para os módulos reaproveitarem.
- Seed local (`seed:dev`, recusa banco que não seja local).
- App: contexto da comunidade, cliente injeta `X-Community-Id`, tela vazia ("criar ou abrir convite"), criar comunidade, trocar de comunidade (só com mais de uma), escolha lembrada no aparelho. Componente `Card` (DESIGN §9.3) em `packages/ui`.

## Testes

- Core (37 no total, 16 novos): criação (dono, validação portada, nome repetido 409, limite diário 429, transação de criação não escreve em outra comunidade); minhas comunidades (só `approved`, várias comunidades, lista vazia); contexto (sem header, lixo, pessoa de fora, pendente, rejeitado, removido, header forjado e caminho de outra comunidade → 403); rollback quando a rota lança erro e quando responde 422; matriz papel × permissão do `PATCH` de papel; regras do dono; drift do schema do core.
- Banco (26): a cobertura de RLS agora inclui as tabelas novas do core.
- App (8): criar comunidade com erro de validação e nome repetido; várias comunidades e troca; uma comunidade sem seletor; header enviado nos detalhes.
- E2E web (6): criar duas comunidades, recarregar mantém a escolha, trocar; nome repetido recusado entre duas pessoas.

## Paridade

- CORE-06: criar comunidade concluído (tipo do Errômetro no Sprint 12). CORE-13 adiantado (lista, seleção automática, troca).

## Pendente

- Prints nas três plataformas e teste em aparelho (como nos sprints anteriores).
- Sincronizar permissões de módulos nas comunidades existentes no boot (Sprint 8).

## Riscos

- O limite de 5 comunidades por dia é escolha minha (D-022 pede um limite, o legado não tinha). Fácil de mudar (`CREATE_LIMIT_PER_DAY`).

## Contrato `[contrato]`

- Módulos recebem `tx`, `community` e `can` por `c.var` (Hono). O Sprint 8 empacota isso no `ModuleContext` da ARQUITETURA §5.1. Testes de módulo usam `createRoleFixture` + `permissionMatrix` para provar a matriz de cada rota.
