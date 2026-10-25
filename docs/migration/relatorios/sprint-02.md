# Sprint 2 — Protótipo Expo

**Recomendação: seguir com Expo (go).** Nenhum critério de parada foi atingido no que dá para medir sem aparelho. O que depende de aparelho ou de contas está listado em "Pendente" e não bloqueia as próximas sprints.

## O que foi feito

Três protótipos em `prototypes/` (ver `prototypes/README.md`):
- **`prototipo-expo`**: Expo SDK 58 + Expo Router, tela de votação, resultados, aparência e entrar, tokens do DESIGN.md nos dois temas, anel pulsante com Reanimated, autoteste da assinatura cega dentro do app.
- **`anon-vote`**: cliente RFC 9474 em JS puro (D-011), 11 testes.
- **`auth-spike`**: Hono + Better Auth com Google e plugin Expo, 6 testes.

## Resultados medidos

| Critério | Resultado |
|---|---|
| Assinatura cega: vetor oficial RFC 9474 A.1 | passa (Node e Hermes) |
| Interoperabilidade com a biblioteca do servidor (`@cloudflare/blindrsa-ts`) | passa nos dois sentidos |
| Rodar no motor Hermes | passa no Hermes 0.12 (CLI); cegar 8 ms, finalizar + verificar 13 ms (CPU de servidor) |
| Compilar para o Hermes do RN 0.88 | export Android e iOS geram bytecode Hermes v99 sem erro |
| Assinatura cega dentro do app web | OK em ~35 ms |
| Carga inicial web, 4G simulado + CPU 4× mais lenta, com gzip | conteúdo visível em 2,1 s (critério: < 3 s) |
| Tema escuro padrão, troca para claro, persistência após recarregar | funciona (web) |
| Login Google na web | clique leva ao Google com PKCE (S256), `state` e `redirect_uri` corretos (e2e com Playwright, Google interceptado) |
| `expo-doctor` | 20/20 |

Prints em `relatorios/sprint-02/`: votação e resultados no escuro, votação e aparência no claro.

## Decidido

- D-030: `StyleSheet` + tokens, sem NativeWind (Tailwind padrão só funciona na web; NativeWind/Uniwind seria risco extra com RN 0.88 + Reanimated 4).
- D-031: Better Auth desliga a checagem de origem sozinho em ambiente de teste e aceita qualquer `callbackURL` sem cookie; fixamos a checagem e validamos o callback nós mesmos.
- D-032: versões base (SDK 58, TypeScript 6.0 e não 7).
- D-033: navegação em pilha com hub da comunidade como início (proposta; DESIGN §9.16).
- D-011 passa a "validada".
- Fontes: `@expo-google-fonts/geist` e `geist-mono` (TTF) para o nativo.

## Pendente (precisa de aparelho ou de conta; não bloqueia)

1. Rodar o protótipo num Android e num iPhone (dev build ou Expo Go) e conferir: renderização, anel pulsante, háptico, troca de tema, barra de status.
2. Login Google de ponta a ponta: criar credenciais OAuth no Google Cloud (web, Android, iOS) e testar no aparelho e na web com o domínio real.
3. Push: token Expo Push em Android e iOS (exige dev build; iOS exige conta Apple paga e chave APNs) e Web Push no export web.
4. Instalar a PWA no Chrome Android e no Safari iOS.
5. Medir a assinatura cega num Android intermediário real (estimativa: dezenas a poucas centenas de ms).

## Riscos novos

- Versões muito recentes (SDK 58, RN 0.88): APIs mudam a cada SDK; o `AGENTS.md` do template pede consultar a documentação versionada, e foi o que fizemos.
- O e2e de login só cobre o início do fluxo; o retorno do Google precisa de credenciais reais.

## Contrato `[contrato]`

Nada novo.
