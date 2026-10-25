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
| `better-auth` (cliente) + `@better-auth/expo` | 1.7.7 | ⏳ | ⏳ | ✅ | Login Google (D-017) | Sprint 2: na web, o clique leva ao Google com PKCE e state |
| `@noble/hashes` | 2.4.0 | ✅* | ⏳ | ✅ | SHA-256/384 do cliente da assinatura cega (D-011) | Sprint 2: vitest, navegador e Hermes 0.12 (*motor Hermes via CLI, não aparelho) |
| `@expo-google-fonts/geist`, `@expo-google-fonts/geist-mono` | 0.4 | | | | Fontes TTF para o nativo (DESIGN §4) | a verificar no Sprint 10 |

## Servidor

| Biblioteca | Versão | Motivo | Verificado em |
|---|---|---|---|
| `hono` + `@hono/node-server` | 4.13 / 2.1 | API (D-008) | Sprint 2 (spike de auth) |
| `better-auth` | 1.7.7 | Auth (D-017, D-031) | Sprint 2: início do login Google, checagem de origem, guarda do callback |
| `@cloudflare/blindrsa-ts` | 0.4.6 | Assinatura cega no servidor (D-011) | Sprint 2: interoperabilidade com o cliente JS puro |

## Desenvolvimento

| Biblioteca | Versão | Motivo |
|---|---|---|
| `typescript` | 6.0 | Não usar 7 enquanto `typescript-eslint` exigir `<6.1` (D-032) |
| `vitest` | 5.0 | Testes unitários e de integração |
| `tsx`, `esbuild`, `@babel/*` | — | Só no spike do Hermes (`prototypes/anon-vote`) |
