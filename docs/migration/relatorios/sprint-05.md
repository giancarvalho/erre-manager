# Sprint 5 — Auth e perfil

## O que foi feito

- `@erre/core` criado: Better Auth (Google, plugin Expo, adaptador Drizzle) em `/v1/auth/*`, guarda de `callbackURL` (D-031), `requireSession`, `GET /v1/me`, `PATCH /v1/me/profile`, handler de erro único (movido de `apps/api`), Zod com mensagens em pt-BR. Regras portadas: nome de exibição (2–32), nome inicial vindo do Google/e-mail, variante de avatar.
- Migrations `core_0001_auth` (tabelas `auth_*`) e `core_0002_profiles`; tabelas na allowlist global do teste de RLS.
- `apps/api`: variáveis validadas com Zod no boot (o erro cita o nome, nunca o valor), CORS só para origens confiáveis com credenciais, core montado em `/v1`. Bundle único, testado fora do workspace.
- App: cliente Better Auth (cookie na web, secure store no nativo), tela Entrar, guarda de sessão com retorno ao destino (só caminhos internos), onboarding do nome, sair. Tudo com componentes de `packages/ui`.
- `@erre/core/testing`: Google simulado (endpoint de token falso) e login completo para testes. Servidor de e2e (`apps/api/e2e/server.ts`) com banco descartável.

## Testes

- Core (21): login cria usuário e sessão; mesmo Google reaproveita a conta; token de outro cliente, outro emissor ou vencido é recusado; sessão de 400 dias sem IP; 401 sem sessão ou com cookie forjado; sair e revogar todas as sessões → 401; validação do nome (curto, longo, campo extra); nome a partir do e-mail; callbacks não confiáveis e parecidos → 403; origem não confiável → 403; rate limit → 429; logs sem token nem e-mail; erro de banco logado sem parâmetros.
- API (9): login + `/v1/me` pela API montada; CORS; variáveis de ambiente.
- App (5, jest + expo-router): sem sessão vai para Entrar guardando o destino; destino externo é ignorado; onboarding valida e segue; sair; erro do servidor mostra "Tentar de novo".
- E2E web (4, Playwright): login com Google simulado → onboarding → recarregar mantém a sessão → sair; quem volta pula o onboarding; tema escuro padrão e claro salvo.

## Decidido

- D-036 (ids uuid, sessão sem IP, claims do Google conferidas, perfil na primeira leitura, formato das rotas de auth, log sem parâmetros, rate limit, bundle único, componentes antecipados).

## Paridade

- CORE-04 concluído; CORE-02 concluído na web; CORE-05: parte da sessão concluída.

## Pendente (precisa de pessoa, aparelho ou conta)

1. Credenciais OAuth reais no Google Cloud (cliente Web; redirect `${PUBLIC_API_URL}/v1/auth/callback/google`) e teste no domínio real.
2. Login, onboarding e sair num Android e num iPhone (dev build). O export nativo compila.
3. Prints das telas nas três plataformas (checklist §14 do DESIGN.md).
4. Shake e háptico no erro do campo (DESIGN §9.2) entram com o movimento no Sprint 10.

## Riscos

- Rate limit sem IP cai num balde único compartilhado (o próprio Better Auth avisa no log). Em produção, atrás de proxy, é preciso configurar o header de IP (Sprint 19); sem isso, 30 logins por minuto valeriam para todo mundo.
- `fireEvent` da Testing Library 14 é assíncrono: sem `await`, o teste usa estado velho e falha de um jeito confuso. Vale constar no template do hackathon.

## Contrato `[contrato]`

- Testes de módulo vão precisar de usuário logado: `@erre/core/testing` (`installFakeGoogle` + `signInWithGoogle`) já resolve isso sem credenciais reais.
