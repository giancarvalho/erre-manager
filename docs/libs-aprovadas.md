# Bibliotecas aprovadas

Toda biblioteca nova entra aqui antes de ser usada (AGENTS.md, regra 10). Bibliotecas do app precisam funcionar em Android, iOS e web; as só de servidor ou de desenvolvimento são registradas sem o teste de plataforma.

Legenda: ✅ verificado · ⏳ verificado só por build/export (falta aparelho) · — não se aplica.

## App (Expo)

| Biblioteca | Versão | Android | iOS | Web | Motivo | Verificado em |
|---|---|---|---|---|---|---|
| `expo` (SDK) + `expo-router` | 58 | ⏳ | ⏳ | ✅ | Base do app (D-001, D-032) | Sprint 2: export das três plataformas, web testada no navegador |
| `react-native` / `react` | 0.88 / 19.3 | ⏳ | ⏳ | ✅ | Fixadas pelo SDK 58 | Sprint 2 |
| `react-native-web` | 0.21 | — | — | ✅ | Web/PWA | Sprint 2 |
| `react-native-reanimated` | 4.7 | ⏳ | ⏳ | ✅ | Animações (brilho, pop) | Sprint 2: anel pulsante na web |
| `react-native-safe-area-context` | 5.10 | ⏳ | ⏳ | ✅ | Safe areas | Sprint 2 |
| `expo-status-bar` | 58 | ⏳ | ⏳ | — | Barra de status por tema | Sprint 2 |
| `expo-secure-store` | 58 | ⏳ | ⏳ | — | Sessão (Better Auth) e token anônimo no nativo | Sprint 2: compila no export |
| `expo-network` | 58 | ⏳ | ⏳ | ✅ | Exigida pelo plugin Expo do Better Auth | Sprint 2 |
| `better-auth` (cliente) + `@better-auth/expo` | 1.7.7 | ⏳ | ⏳ | ✅ | Login Google (D-017) | Sprint 2: na web, o clique leva ao Google com PKCE e state. Sprint 5: fluxo completo na web (e2e com Google simulado); export nativo verde |
| `expo-web-browser` | 58 | ⏳ | ⏳ | — | Abre o login do Google no nativo (plugin Expo do Better Auth) | Sprint 5: export nativo |
| `hono/client` (`hono` 4.13) | 4.13 | ⏳ | ⏳ | ✅ | Cliente RPC tipado por módulo (D-009) | Sprint 8: jest com o módulo de teste; export web e nativo |
| `expo-notifications` | 58.1 | ⏳ | ⏳ | — | Permissão, token Expo e toque na notificação (D-012) | Sprint 9: export nativo e `expo-doctor` 20/20; falta aparelho e projeto EAS |
| `zod` | 4.6 | ⏳ | ⏳ | ✅ | Validação no app com as mesmas regras da API (`@erre/core/client`) | Sprint 5: e2e web, export nativo |
| `@noble/hashes` | 2.4.0 | ✅* | ⏳ | ✅ | SHA-256/384 do cliente da assinatura cega (D-011) | Sprint 2: vitest, navegador e Hermes 0.12 (*motor Hermes via CLI, não aparelho) |
| `@tanstack/react-query` | 5.104 | ⏳ | ⏳ | ✅ | Cache e estado de servidor no app (ARQUITETURA) | Sprint 3: JS puro; export Android/iOS e e2e web verdes |
| `expo-font`, `expo-splash-screen`, `expo-system-ui`, `expo-constants`, `expo-linking` | 58 | ⏳ | ⏳ | ✅ | Módulos do SDK usados pelo Expo Router e pelo tema | Sprint 3: `expo-doctor` 20/20, export das três plataformas |
| `@babel/runtime` | 7.29 | ⏳ | ⏳ | ✅ | Helpers do Babel; precisa ser dependência direta do app com o layout isolado do pnpm | Sprint 3 |
| `@expo-google-fonts/geist`, `@expo-google-fonts/geist-mono` | 0.4 | ⏳ | ⏳ | ✅ | Fontes Geist (DESIGN §4); importar por peso (`/400Regular`), o pacote inteiro leva 18 arquivos | Sprint 10: web com a fonte carregada (prints), export nativo |
| `expo-haptics` | 58.0 | ⏳ | ⏳ | — | Háptico (DESIGN §8); nada na web | Sprint 10: export nativo |
| `@react-native-async-storage/async-storage` | 2.2 | ⏳ | ⏳ | — | Tema e preferências no aparelho (DESIGN §3.1); web usa `localStorage` | Sprint 10: export nativo, jest com o mock oficial |
| `expo-blur` | 58.0 | ⏳ | ⏳ | ✅ | Barra fixa e conteúdo reservado (DESIGN §7); Android usa fundo sólido | Sprint 10: galeria na web |
| `expo-linear-gradient` | 58.0 | ⏳ | ⏳ | ✅ | Banner de destaque e medalha (DESIGN §7, §9.14) | Sprint 10: galeria na web |

## Servidor

| Biblioteca | Versão | Motivo | Verificado em |
|---|---|---|---|
| `hono` + `@hono/node-server` | 4.13 / 2.1 | API (D-008) | Sprint 2 (spike de auth) |
| `drizzle-orm` | 0.45.4 | ORM e query builder (D-032); schemas dos módulos via `@erre/db/pg-core` | Sprint 4 |
| `pg` | 8.23 | Driver Postgres (pools `erre_app` e `erre_jobs`, runner de migrations) | Sprint 4 |
| `node-cron` | 4.6 | Agenda os jobs dos módulos (D-013) | Sprint 8 |
| `web-push` | 3.6 | Web Push com VAPID para a PWA (D-012; o legado já usava) | Sprint 9 (transporte simulado nos testes) |
| `expo-server-sdk` | 8.0 | Envio em lotes e recibos do Expo Push (D-012) | Sprint 9 (transporte simulado nos testes) |
| `pino` | 10.4 | Log estruturado com `redact` (sem dados pessoais) | Sprint 3 |
| `zod` | 4.6 | Validação de entrada em toda rota | Sprint 3 |
| `better-auth` | 1.7.7 | Auth (D-017, D-031) | Sprint 2: início do login Google, checagem de origem, guarda do callback |
| `@cloudflare/blindrsa-ts` | 0.4.6 | Assinatura cega no servidor (D-011) | Sprint 2: interoperabilidade com o cliente JS puro |

## Desenvolvimento

| Biblioteca | Versão | Motivo |
|---|---|---|
| `typescript` | 6.0 | Não usar 7 enquanto `typescript-eslint` exigir `<6.1` (D-032) |
| `vitest` | 5.0 | Testes unitários e de integração |
| `tsx` | 4.23 | `dev` da API com recarga |
| `esbuild` | 0.28 | Empacota a API para produção (inclui `@erre/*`, deixa as libs de fora) |
| `@babel/*` | — | Só no spike do Hermes (`prototypes/anon-vote`) |
| `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks` | 9.39 / 8 / 7 | Lint. ESLint 9 e não 10: o plugin de hooks ainda não declara suporte ao 10 (D-034) |
| `prettier` | 3.9 | Formatação |
| `turbo` | 2.11 | Orquestra tarefas e cache no monorepo |
| `jest` + `jest-expo` + `@testing-library/react-native` | 30 / 58 / 14 | Testes unitários do app com o preset do SDK |
| `@playwright/test` | 1.63 | E2E contra o export web |
| `serve` | 14.2 | Servidor estático do export web no e2e |
