# Spike: cliente da assinatura cega em JS puro

Prova da decisão D-011 (Sprint 2). Implementa as etapas do cliente da RFC 9474 (`RSABSSA-SHA384-PSS-Randomized`: preparar, cegar, finalizar, verificar) sem WebCrypto, `atob`, `btoa` ou `TextEncoder`, só com `@noble/hashes` e `BigInt`. Vira `packages/anon-vote` no Sprint 11.

- `pnpm test`: vetor A.1 da RFC 9474 (chave de 4096 bits), interoperabilidade nos dois sentidos com `@cloudflare/blindrsa-ts` (a biblioteca do servidor), chave de período errada, `voter_tag` igual ao do legado, base64url manual.
- `HERMES_BIN=/caminho/para/hermes pnpm hermes`: gera uma fixture de 2048 bits assinada pelo servidor (Node) e roda o vetor da RFC e a rodada completa dentro do motor Hermes. O binário usado no Sprint 2 veio de `hermes-engine-cli@0.12.0` (npm, `linux64-bin/hermes`); o código passa por esbuild + Babel, como o Metro faz no app.

Resultado no Sprint 2: tudo passou no Hermes; cegar levou 8 ms e finalizar + verificar 13 ms (CPU de servidor).
