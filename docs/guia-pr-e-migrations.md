# Guia de PR e migrations

Como levar uma mudança até a `main` sem quebrar ninguém. Vale para módulos novos e para mudanças no core.

## PR

1. **Branch** a partir da `main`: `modulo-<id>` para um módulo novo, `sprint-NN-<slug>` no plano de migração.
2. **Commits pequenos**, no formato `tipo(escopo): resumo` (ex.: `feat(avisos): publicar aviso`).
3. **Antes de abrir:** `pnpm check` verde na sua máquina (Prettier, lint, typecheck, testes, build). Com tela nova, rode também `pnpm test:e2e` se mexeu em fluxo coberto por ele.
4. **Descrição do PR:**
   - o que muda e por quê, em poucas linhas;
   - permissões novas e quem as recebe por padrão;
   - migrations novas (nome do arquivo e se têm `-- migrate:down`);
   - com interface: o checklist da §14 do [`DESIGN.md`](design/DESIGN.md) e prints (web, Android e iOS no tema escuro; uma plataforma no claro);
   - dores com o contrato, marcadas `[contrato]`.
5. **CI verde** é condição para revisão. Se falhar, corrija a causa: nunca desligue um teste nem uma regra de lint para passar.
6. **Dependência nova** (biblioteca no app ou na API): confirme que funciona em Android, iOS e web e registre em [`libs-aprovadas.md`](libs-aprovadas.md) no mesmo PR.

O que a revisão confere: permissão e Zod em toda rota; nada de `community_id` vindo do cliente sem validação; rota anônima sem identidade; telas só com `@erre/ui`; testes da matriz e de isolamento atualizados.

## Migrations

Cada dono tem a sua pasta: `packages/db/migrations`, `packages/core/migrations`, `modules/<id>/db/migrations`. O runner aplica `db`, depois `core`, depois os módulos em ordem alfabética, e dentro de cada um pelo número.

### Escrever

- **Uma migration por mudança**, nome `<id>_<NNNN>_<descricao>.sql`, número seguinte ao último do dono (`avisos_0002_add_pinned.sql`).
- Tabela de comunidade: `community_id uuid NOT NULL REFERENCES communities(id)` e `SELECT erre_tenant_table('<tabela>');` logo depois do `CREATE TABLE`.
- Índices começam por `community_id`.
- FK só para tabelas do core (`communities`, `auth_user`) ou do próprio módulo.
- Reversível quando der: uma seção `-- migrate:down` no fim do arquivo com o inverso (usada só em desenvolvimento).
- Atualize `db/schema.ts` no mesmo commit: o teste de contrato compara schema e migrations.

### Nunca

- **Editar migration já aplicada** fora da sua máquina. O runner guarda o checksum de cada arquivo e recusa se ele mudar. Corrija com uma migration nova.
- `DROP`/`TRUNCATE` de dados em migration sem combinar antes. Coluna que sai: primeiro o código para de usar (um PR), depois a migration remove (outro PR).
- Rodar migration contra produção. Quem aplica em produção é quem opera, com a imagem `migrate` ([`deploy.md`](deploy.md)).

### Testar

```sh
pnpm --filter @erre/<id> test                         # banco descartável com todas as migrations
pnpm --filter @erre/db db:migrate                     # seu banco local
pnpm --filter @erre/db db:rollback <id>               # desfaz a última do dono (só local)
```

Mudança em tabela com dados: escreva a migration pensando na tabela cheia (coluna nova com `DEFAULT` ou nula; índice grande pode travar escrita).
