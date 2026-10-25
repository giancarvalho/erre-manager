# Sprint 3 — Monorepo, ferramentas e CI

## O que foi feito

- Monorepo pnpm + Turborepo (`apps/*`, `packages/*`, `modules/*`), Node 22, Prettier, `pnpm check` igual ao CI.
- `packages/config`: `tsconfig.base.json` estrito e ESLint com as regras de fronteira (ARQUITETURA §3) e de rota anônima. 45 testes de regra, incluindo as fixtures de violação (o lint falha nelas).
- `apps/api`: Hono com `GET /v1/health`, formato único de erro (`{ code, message }`; 404, `AppError`, Zod → 400, 500 sem vazar detalhe), log pino só com método, caminho, status e duração, mais `redact` de headers de auth, cookies, tokens e e-mails. Build com esbuild. 5 testes.
- `packages/ui` mínimo: tokens do DESIGN §13 e `ThemeProvider` (escuro padrão, claro, sistema). Teste de paridade de chaves entre os temas.
- `apps/mobile`: Expo SDK 58 + Expo Router, providers (safe area, TanStack Query, tema), tela inicial vazia. Teste com `jest-expo` e e2e Playwright no export web (tema escuro padrão e preferência clara salva).
- `docker-compose.yml` (Postgres 16), `.env.example` por app, CI no GitHub Actions, `CONTRIBUTING.md`.

## Verificado

| Critério | Resultado |
|---|---|
| `pnpm install` + `turbo run lint typecheck test build` | verde (14 tarefas) |
| Lint falha na fixture de violação | sim (testes de `packages/config`) |
| App na web | e2e verde (2 testes) |
| App no Android e iOS | export gera bytecode Hermes para os dois; `expo-doctor` 20/20. Falta abrir num aparelho |
| CI | ver o resultado da execução no GitHub (link no fim da sessão) |

## Decidido

- D-034: ESLint 9 (não 10), Vitest + `jest-expo`, Playwright no export web, `exactOptionalPropertyTypes` ligado (custou duas linhas), regra de escopo do CI, `packages/ui` mínimo antecipado, `agentGuidance: false` no Turborepo.

## Pendente

- Abrir o app num Android e num iPhone (mesma pendência do Sprint 2).
- P-011: não existe `main` no repositório. Pela D-029 tudo vai para o branch da sessão; o CI roda em todo push. Quando a `main` existir, o filtro de afetados passa a valer nos PRs. Proteger a `main` com o CI obrigatório é configuração do GitHub (humano).

## Riscos

- `@babel/runtime` precisou virar dependência direta do app por causa do layout isolado do pnpm. Outras dependências transitivas do Metro podem exigir o mesmo; o erro é explícito ("Cannot find module").

## Contrato `[contrato]`

Nada novo neste sprint.
