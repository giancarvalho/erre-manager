# Sprint 7 — Convites, entrada e membros da comunidade

## O que foi feito

- Migration `core_0004_invites`: links de convite (tenant) e a intenção do pedido na membership.
- Rotas: prévia pública e pedido por link; minhas solicitações; membros (qualquer membro); pedidos, aprovar, recusar e remover (`core.membros.gerenciar`); sair; criar, listar e desativar links (`core.convites.gerenciar`).
- API de membros para módulos (`createMembersApi`: `list`, `get`, `isApprovedMember`) e ganchos `onJoinApproved` (savepoint) e `onMemberLeft` (mesma transação), registrados em `docs/CONTRATO.md` `[contrato]`.
- App: tela do convite (sem sessão mostra a prévia e leva ao login voltando para o convite; com sessão pede e mostra "Pedido enviado"; link desativado avisa), "Aguardando aprovação" no início, Membros (lista, pedidos com aprovar/recusar, remover com confirmação, sair com confirmação), Convidar pessoas (criar, compartilhar ou copiar, desativar com confirmação). `ConfirmCard` em `packages/ui`.

## Testes

- Core (51 no total, 14 novos): código do convite (ida e volta, adulterado); matriz de quem cria links e vê pedidos; desativar link impede prévia e pedido; intenção desconhecida recusada; prévia pública mínima; pedido sempre pendente sem acesso até aprovar; tabela de transições completa, incluindo pedir de novo depois de recusado e removido; código apontado para outra comunidade não vale; dono não sai nem é removido; intenção roda na transação da aprovação; intenção que falha é desfeita sozinha; `onMemberLeft` que falha desfaz a remoção; limite de 300 deixa o pedido na fila.
- App (11): estados da tela de convite (sem sessão, com sessão, desativado).
- E2E web (7): duas pessoas, em navegadores separados, do link à aprovação, à saída, e o link desativado.

## Decidido

- D-038 (formato do código, transições, limite, dono, ganchos, visibilidade).

## Paridade

- CORE-08 (core), CORE-09, CORE-10, CORE-11 concluídos; CORE-12 com a casca.

## Pendente

- P-015 (entrar digitando o nome) segue aberta; só o link foi feito.
- Links universais (abrir o app pelo link https no celular) dependem do domínio real (Sprint 19). Hoje o link abre a web; o nativo abre `erre://convite/<código>`.
- Prints e aparelhos, como antes.

## Riscos

- O texto do link de convite mostra a origem configurada em `EXPO_PUBLIC_WEB_URL`; no nativo sem essa variável, o padrão é `localhost`. O deploy (Sprint 19) precisa definir.

## Contrato `[contrato]`

- `onJoinApproved` e `onMemberLeft` com garantias diferentes de falha (isolada × desfaz tudo). O template do hackathon deve deixar claro que regra de negócio (ex.: limite) não lança erro em `onJoinApproved`.
