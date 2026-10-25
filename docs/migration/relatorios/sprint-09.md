# Sprint 9 — `notify()` e push (Web Push + Expo Push)

## O que foi feito

- Migration `core_0005_notifications`: inscrições de push (Web Push e Expo, uma por aparelho) e preferências por tipo (tabelas globais).
- Notificador com transportes `web-push` e `expo-server-sdk` (lotes, recibos), preferências com o padrão do manifesto, remoção de inscrições inválidas, kill switch `PUSH_ENABLED`.
- `ctx.notify` e `JobContext.notify` enviam **depois do commit**, em segundo plano (`afterCommit` no contexto de tenant).
- Rotas: `GET /v1/push/config`, `POST`/`DELETE /v1/push/subscriptions`, `GET`/`PUT /v1/notification-preferences`.
- App: service worker portado do legado (só web, registrado ao abrir), `expo-notifications` no nativo, toque abre a rota, tela Notificações (ligar neste aparelho, com o motivo quando não dá, e um interruptor por tipo). `SwitchRow` em `packages/ui` e proposta da §9.17 no DESIGN.md.

## Testes

- Core (73 no total, 8 novos): preferências e padrões; kill switch; tipo desconhecido; remoção por 404/410, por ticket e por recibo do Expo; logs sem id, endpoint, token nem texto; validação das inscrições (só https, token Expo válido), aparelho muda de dono, só o dono remove; preferências recusam tipo desconhecido.
- API (26): `notify` de rota de módulo só sai depois do commit (rota que falha não notifica) e respeita a preferência; tipos listados só dos módulos ligados.
- App (19): ligar push no aparelho, motivo de indisponível, erro de permissão, preferência por tipo na hora, lista vazia.
- E2E web (8): service worker servido e ativo; tela de notificações com push desligado.

## Decidido

- D-040. P-007 decidida provisoriamente (A).

## Paridade

- CORE-16, CORE-17, CORE-18 concluídos; CORE-19 em parte (pedido no momento de valor no Sprint 14).

## Pendente (precisa de pessoa, conta ou aparelho)

1. Gerar as chaves VAPID e configurar no deploy.
2. Criar o projeto EAS (dá o `projectId`), dev build e testar token, recebimento e toque no Android e no iPhone. iOS exige conta Apple paga e chave APNs.
3. Web Push de verdade num navegador (o headless dos testes não tem serviço de push) e na PWA instalada no iPhone.
4. Confirmar P-007.

## Riscos

- Recibos do Expo checados em memória: se a API reiniciar nos ~15 min, a limpeza fica para o próximo envio (o ticket seguinte acusa o token inválido).

## Contrato `[contrato]`

- `notify` agora tem semântica clara: depois do commit, por preferência. O template do hackathon deve dizer que o envio é assíncrono e não confirma entrega.
