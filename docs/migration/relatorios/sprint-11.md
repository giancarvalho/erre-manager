# Sprint 11 — Pacotes compartilhados: `anon-vote` e `emoji`

## O que foi feito

- `@erre/anon-vote`: cliente em JS puro (preparar, cegar, finalizar, verificar; base64url sem `atob`), servidor sobre `@cloudflare/blindrsa-ts` (chaves, assinatura cega com checagem de tamanho, verificação que nunca lança, `voter_tag`), fluxos `issueToken` e `verifyBallot`, agregação de votos e interfaces de repositório (chaves, emissões, votos).
- `@erre/emoji`: catálogo global e descrições, nomes e brilhos de troféu, limites, cálculo de troféus da rodada, grafema único (com alternativa para o Hermes) e brilho inferido (só web).
- Cabeçalho `// Portado de queridometro@7c5c5bf:...` em todo arquivo portado.

## Testes

- `anon-vote` (24): vetor A.1 da RFC 9474; interoperabilidade cliente JS ↔ biblioteca do servidor nos dois sentidos; todos os casos de `blind-signature.test.ts` do legado; um token por pessoa e período; valor cegado inválido não gasta a emissão; agregação.
- `emoji` (49): `trophies.test.ts`, `trophy-catalog.test.ts` e `infer-glow-color.test.ts` do legado; grafema comparado ao `Intl.Segmenter` (família ZWJ, tom de pele, bandeiras, keycap, tags, texto, vazio) e sem `Segmenter`.
- Hermes 0.12 (manual): vetor A.1 e rodada de 2048 bits contra o servidor, tudo passou (cegar 13 ms, finalizar + verificar 11 ms em CPU de servidor).

## Decidido

- D-042: fluxos no pacote e tabelas no módulo; brilho de emoji personalizado calculado na web e gravado (nativo usa o padrão); grafema com alternativa sem `Segmenter`; tokens do legado seguem válidos.

## Não portado

- `voter-tag.ts` (HMAC) e seu teste: só o caminho do demo usa (R-ANON-08, P-003 em aberto). Entra se P-003 decidir portar o demo.

## Pendente

- Medir cegar/finalizar num Android intermediário (aparelho).
- `expo-crypto` como fonte de aleatoriedade entra no Sprint 14, junto com a tela de votação.

## Contrato `[contrato]`

- Padrão útil para o hackathon: lógica sensível num pacote com interfaces de repositório; o módulo implementa as interfaces com as próprias tabelas, no `tx` que recebe.
