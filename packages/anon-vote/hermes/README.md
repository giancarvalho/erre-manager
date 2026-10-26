# Cliente no Hermes (verificação manual)

Roda o cliente de `src/client.ts` dentro do motor Hermes (o do React Native): vetor A.1 da RFC 9474 e uma rodada de 2048 bits contra a biblioteca do servidor. Não roda no CI (precisa do binário do Hermes).

```sh
# binário: npm pack hermes-engine-cli@0.12.0 → package/linux64-bin/hermes
HERMES_BIN=/caminho/para/hermes pnpm --filter @erre/anon-vote hermes
```

O script usa `tsx`, `esbuild` e `@babel/cli` com `@babel/preset-env` (o mesmo passo que o Metro faz no app). Resultado no Sprint 11: tudo passou; cegar 7 ms, finalizar + verificar 5 ms (CPU de servidor). A medição num Android intermediário continua pendente (aparelho).
