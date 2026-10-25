# Protótipos do Sprint 2

Código de validação, não de produção. Resultados em `docs/migration/relatorios/sprint-02.md`.

| Pasta | O que prova | Como rodar | Destino |
|---|---|---|---|
| `prototipo-expo/` | Expo SDK 58 + Expo Router nas três plataformas, tokens e temas, assinatura cega dentro do app, cliente Better Auth | `npm install && npx expo export -p web` (ou `npx expo start`) | substituído por `apps/mobile` (Sprint 3) |
| `anon-vote/` | Cliente RFC 9474 em JS puro (D-011) | `pnpm install && pnpm test`; Hermes: `HERMES_BIN=... pnpm hermes` | vira `packages/anon-vote` (Sprint 11) |
| `auth-spike/` | Better Auth + Google + plugin Expo, guarda do callback (D-031) | `pnpm install && pnpm test` | base de `packages/core/server/auth` (Sprint 5) |

Fora do workspace pnpm do monorepo: cada pasta tem as próprias dependências.
