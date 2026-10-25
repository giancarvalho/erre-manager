# Contrato de módulo

O que um módulo pode usar do core, e o que o core espera dele. A forma completa (manifesto, `defineModuleApi`, `defineModuleUi`) está na [ARQUITETURA §5](migration/ARQUITETURA.md#5-contrato-de-módulo-v0). Este arquivo registra cada ponto de extensão conforme ele fica pronto, com o comportamento garantido e o teste que o prova. Itens marcados `[contrato]` são insumo para o template do hackathon.

## Membros da comunidade (`ctx.members`) — Sprint 7

`createMembersApi(tx, communityId)` em `@erre/core/server`; no Sprint 8 chega ao módulo como `ctx.members`.

| Método | Devolve |
|---|---|
| `list()` | membros **aprovados**, com `userId`, `displayName`, `avatarVariant` e `role`, em ordem de nome |
| `get(userId)` | o membro aprovado, ou `null` |
| `isApprovedMember(userId)` | `true` só para membership `approved` |

Módulos **não** leem `core_community_memberships` nem `core_profiles` (AGENTS.md, regra 8).

## Entrada com intenção (`joinIntents` + `onJoinApproved`) — Sprint 7 `[contrato]`

- O módulo declara intenções (ex.: `errometro.participar`, "Entrar e participar do Errômetro"). Um convite pode carregar uma; a pessoa faz **um pedido só** (D-023).
- Quando `owner`/`admin` aprova o pedido, o core chama `onApproved({ tx, communityId, userId, actorId })` **na mesma transação**, dentro de um savepoint.
- Se o hook lançar erro, só a parte do módulo é desfeita: a pessoa entra na comunidade e o erro vai para o log. Regra de negócio que não cabe (ex.: limite de votantes cheio) **não** deve lançar erro: o módulo deixa a participação na fila dele e avisa a pessoa.
- Testes: `packages/core/test/invites.test.ts` ("module hooks").

## Saída de membro (`onMemberLeft`) — Sprint 7 `[contrato]`

- Chamado na mesma transação quando um pedido é rejeitado, um membro é removido ou sai. É a forma de a participação no módulo acompanhar a comunidade (no legado, rejeitar ou remover levava a votação junto, R-MEM-05).
- **Se o hook falhar, a mudança inteira é desfeita** (500): quem saiu não pode continuar com direitos no módulo.

## Testes de módulo — Sprints 5 e 6

`@erre/core/testing` traz login sem Google real (`installFakeGoogle`, `signInWithGoogle`, `createTestUser`), uma comunidade com uma pessoa por papel (`createRoleFixture`) e a matriz de permissões de uma rota (`permissionMatrix`). `@erre/db/testing` traz banco descartável (`createTestDatabase`) e o teste de drift (`schemaDifferences`).
