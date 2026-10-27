# Sprint 20 — Template de módulo e preparação do hackathon

## O que foi feito

- **`pnpm create-module <id> [--nome] [--anon]`** (`tools/create-module`). Gera um módulo completo e o registra na API, no app, nos links do app e no `.env.example`:
  - manifesto, tabela com migration, rotas com permissão e Zod, LGPD;
  - seção no hub e tela com os estados do DESIGN;
  - testes de contrato, matriz de permissões, isolamento e UI.
- **CI:** um job gera um módulo a cada push e roda Prettier, lint, typecheck e testes, para o template não ficar para trás do contrato.
- **Documentação:**
  - `docs/CONTRATO.md` v1, com o histórico das decisões `[contrato]`;
  - `docs/criando-um-modulo.md`, com a seção "Design do seu módulo";
  - `docs/guia-pr-e-migrations.md`;
  - `docs/libs-aprovadas.md` revisado contra os `package.json`.
- **Módulo `avisos`** (listar, publicar, apagar, push ao publicar, `avisos.publicar`). Construído por um agente sem contexto, só com o gerador e a documentação. O `pnpm check` passou na primeira rodada completa: 21 testes de API e 6 de tela. Acrescentei um e2e e os prints.

## O que doeu (19 dificuldades em `sprint-20-avisos-dificuldades.md`)

O gerador e os testes gerados funcionaram de primeira, assim como o teste de schema × migration, a matriz de permissões, o host falso e o lint de design. As dores ficaram nas bordas do contrato.

**Resolvidas neste sprint (D-053):**
- `[contrato]` A rota do push precisava de `?comunidade=<id>`, uma convenção que só existia no código do app. Agora o `notify()` acrescenta a comunidade sozinho.
- `[contrato]` Esperar o push nos testes exigia copiar um helper. Agora o harness tem `pushesAfter`.
- Documentação nova:
  - `[contrato]` a forma de `ctx.members` e o nome da comunidade;
  - os ajudantes de teste: fixture, LGPD com `adminSecret`, saída de membro;
  - a raiz `''` da API;
  - o `icon` do manifesto, que ainda não é usado no app.
- `ErrorState` ganhou "← Início": a tela de erro do módulo não fica mais sem saída.
- `TextField` `multiline` ganhou altura e padding de texto longo (DESIGN §9.2, proposta).
- No gerador:
  - acrescenta `/<id>/*` aos links do app;
  - `domain/index.ts` passa a ser a entrada de `@erre/<id>/domain`;
  - o guia explica que os testes só precisam de `DATABASE_ADMIN_URL`.

**Pendentes:**
- **Estado "sem conexão" (DESIGN §9.15):** o app não tem o aviso global no topo. Deve ser do core, não de cada módulo.
- **Paginação:** não há padrão no contrato. O guia manda usar `limit` + cursor por data e marcar `[contrato]`.
- **Renomear a entidade do template** (`items`) toca cerca de 10 arquivos. Sugestão do agente: uma opção `--entidade aviso` no gerador.
- **LGPD de texto escrito para a comunidade:** P-022 (o `avisos` apaga, provisório).

## Testes

- Gerador: 6 testes de unidade, mais um módulo gerado no repositório real com o `pnpm check` completo verde.
- Core: `routeInCommunity`.
- `avisos`: domínio, integração (push, listagem, apagar, LGPD, autor que saiu), matriz, isolamento, UI (jest) e e2e.

## Prints (DESIGN §14)

`sprint-20/avisos-dark.png` e `avisos-light.png` (web). Android e iOS: pendente de aparelho.

## Decidido

- D-052: gerador e contrato v1.
- D-053: o que o `avisos` mudou no contrato.
- P-022: provisória.
