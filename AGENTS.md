# Regras para agentes

Este arquivo vale para qualquer agente (Claude Code ou outro) e para pessoas. Leia inteiro antes de qualquer alteração. Em caso de conflito, a ordem de precedência é: instrução explícita do humano > este arquivo > `docs/migration/DECISOES.md` > `docs/design/DESIGN.md` (em assuntos de interface) > `docs/migration/ARQUITETURA.md` > `docs/migration/PLANO.md`.

## Contexto em três linhas

- O app legado (`giancarvalho/queridometro`, Next.js 15, ~200 usuários, majoritariamente uma comunidade) está em produção e **não deve ser alterado** por este trabalho.
- Este repositório é a reescrita: monorepo com Expo (Android, iOS, web/PWA), API Hono, Postgres com RLS e módulos (`errometro`, `eventos`).
- O **contrato de módulo é o produto**: outros membros vão criar módulos num hackathon. Se migrar algo for doloroso, o contrato provavelmente está errado. Registre isso em vez de contornar.

## Antes de começar um sprint

1. Leia `docs/migration/PLANO.md` (a seção do seu sprint e a "Definição de pronto global"), `DECISOES.md` e `ARQUITETURA.md`.
2. Confirme que os sprints de que o seu depende estão concluídos (merge feito na `main`).
3. Verifique `PERGUNTAS.md`. Se uma pergunta em aberto bloqueia o seu sprint, pare e pergunte (formato abaixo).
4. **Se o sprint tem qualquer interface (tela, componente, texto, notificação), leia [`docs/design/DESIGN.md`](docs/design/DESIGN.md) inteiro** e olhe as capturas em `docs/design/legado/`. Design é requisito, não acabamento.

## Referência ao legado

- Repositório: `giancarvalho/queridometro`. Commit de referência: **`7c5c5bf`** (a menos que `DECISOES.md` registre outro).
- Leia o legado somente para entender comportamento. Neste plano, referências como `legado:src/lib/voting/annul-vote.ts` significam esse caminho no commit de referência.
- Código portado (lógica de domínio pura e testes) leva um comentário no topo: `// Portado de queridometro@7c5c5bf:src/<caminho>`.
- O arquivo `legado:memory/project_overview.md` está **desatualizado**. A fonte de verdade é o código.

## Regras invariantes

1. **Nunca tocar em dados de produção.** Trabalhe só com Postgres local (docker compose) ou de desenvolvimento. Scripts de dados são escritos e testados em cópia; quem executa em produção é o humano.
2. **Nada destrutivo sem confirmação:** não apagar código do legado, não reescrever histórico Git (sem rebase/amend/force-push em branch alheio), não rodar `DROP`/`TRUNCATE` fora de banco de teste descartável.
3. **Proibido rodar no legado:** `scripts/drop-all-records.mjs`, `npm run db:push`, `db:migrate`, `db:schema` ou qualquer script com `.env` real.
4. **Não inventar.** Se uma regra de negócio, tabela ou fluxo não estiver claro, registre em `PERGUNTAS.md` em vez de supor. Comportamento aparentemente bugado também vira pergunta, não correção silenciosa.
5. **Não ler nem imprimir segredos.** Use apenas `.env.example`. Se encontrar credencial commitada, reporte o caminho sem copiar o valor.
6. **`community_id` nunca é aceito do cliente sem validação.** Ele chega pelo header `X-Community-Id` e o core o valida contra a membership do usuário antes de abrir a transação. Nunca é gravado como "comunidade ativa" na sessão. Única exceção: rotas anônimas recebem a comunidade no caminho e a validam pela assinatura cega (ARQUITETURA §4.5).
7. **Todo acesso a dados passa por `packages/db`.** Módulos não criam conexões próprias e só usam o `tx` que recebem do core.
8. **Módulos não importam internals uns dos outros nem tocam tabelas alheias.** Falam com o core só pela API pública (`@erre/core` entry público). Código compartilhado vai para um pacote em `packages/`.
9. **Rotas anônimas nunca conhecem o usuário.** Código em `modules/*/api/anon/**` não lê sessão, cookies, `Authorization`, IP nem `user`. Isso protege o anonimato do voto (assinatura cega). Violar isso é bug crítico.
10. **Dependências novas:** antes de adicionar uma biblioteca usada pelo app, confirme que funciona em Android, iOS e web. Registre em `docs/libs-aprovadas.md` (nome, versão, plataformas testadas, motivo). Dependências só de servidor ou de desenvolvimento também são registradas, sem o teste de plataforma.
11. **Cada sprint termina com relatório + testes verdes + aprovação humana** (merge do PR). Sprints marcados com "Gate humano" exigem revisão explícita antes do próximo.
12. **Interface segue `docs/design/DESIGN.md`.** Só componentes de `packages/ui` e tokens; nenhuma cor, fonte ou espaçamento fora deles. Toda tela funciona nos dois temas (escuro, padrão, e claro). Todo PR com interface inclui o checklist da §14 do DESIGN.md e prints nas três plataformas. Se o design não cobrir o caso, proponha a adição ao DESIGN.md no mesmo PR em vez de improvisar na tela.

## Convenções de código

- TypeScript estrito em tudo. `any` só com comentário justificando na mesma linha.
- Validação de entrada com Zod em toda rota. Nunca confiar em corpo, query ou header.
- Erros da API com formato único `{ "code": "SNAKE_CASE", "message": "texto pt-BR" }` e status HTTP correto (400 validação, 401 sem sessão, 403 sem permissão, 404 inexistente ou módulo desligado, 409 conflito, 422 regra de negócio).
- Migrations: uma por mudança, nomeadas `<dono>_<NNNN>_<descricao>.sql` (ex.: `errometro_0003_add_comments.sql`), reversíveis quando possível.
- Tabelas: prefixo do dono (`core_`, `errometro_`, `eventos_`). Tabelas por comunidade são criadas com `createTenantTable()`.
- Strings de interface em português (pt-BR). Código e comentários técnicos em inglês ou português, sem misturar no mesmo arquivo.
- Commits pequenos e descritivos. Branch por sprint: `sprint-NN-<slug>`. Um PR por sprint, ou mais de um se o sprint for grande, sempre com o número do sprint no título.

## Quando parar e perguntar

Pare e pergunte ao humano quando:
- o legado contradisser uma decisão de `DECISOES.md`;
- houver regra de negócio ambígua ou comportamento que parece bug;
- uma dependência necessária não funcionar em alguma das três plataformas;
- um critério de parada do sprint for atingido;
- você precisar mudar o contrato de módulo ou a arquitetura.

Formato da pergunta: contexto em uma linha; opções com prós e contras; sua recomendação. Registre também em `PERGUNTAS.md` com um ID (`P-NNN`).

## Relatório de fim de sprint

No máximo uma tela, na descrição do PR e em `docs/migration/relatorios/sprint-NN.md`:
- o que foi feito (sem recapitular passo a passo);
- o que foi decidido e por quê (e o ID adicionado em `DECISOES.md`);
- itens de `PARIDADE.md` concluídos;
- o que ficou pendente;
- riscos novos e perguntas (IDs em `PERGUNTAS.md`);
- dores com o contrato de módulo (marque `[contrato]`): insumo para o template do hackathon.
