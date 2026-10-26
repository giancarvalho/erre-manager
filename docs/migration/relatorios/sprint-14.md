# Sprint 14 — Errômetro UI I: hub e votação

## O que foi feito

- Seção do Errômetro no hub: cadência e próximo resultado, e os estados de participação (sem pedido, pendente, fila do limite de 50, recusado, removido) com "Quero participar do Errômetro".
- Tela de votação: cabeçalho, cadência, legenda dos emojis, ordenação "Alfabética / Não votados", grade de cards com emojis (sem o próprio card), barra fixa com "Enviar votos" / "Atualizar votos" e o estado ("1 de 2 pessoas votadas"), código do voto para anulação, estados de carregando, erro, sem participação, já votou, pré-preenchido e bloqueado.
- Fluxo anônimo completo no aparelho, com o voto saindo por uma requisição sem sessão.
- Convites podem levar a intenção do Errômetro ("um pedido só", marcada por padrão); `?comunidade=` troca para a comunidade de uma notificação.
- `@erre/ui`: `VoteTargetCard`, `EmojiGrid`, `ListScreen`, `CopyableCode`, `EmojiButton` com tamanho; estados de acessibilidade com `aria-*`.
- Contrato: `storage` e `secureStorage` no host do módulo; `crypto.getRandomValues` do `expo-crypto` no nativo.

## Testes

- App (33): 8 novos da votação: grade sem a própria pessoa, marcar/desmarcar, envio sem cookie, `Authorization` nem header de comunidade e com `credentials: 'omit'`, token guardado e votos lembrados, "meus votos" pelo código, pré-preenchimento filtrado, bloqueio de token já emitido, estados de participação, seção do hub. A emissão roda a assinatura cega de verdade (RSA cru no teste).
- E2E web (12): convite com intenção → um pedido → aprovação → votante; voto da dona; na rede, a requisição anônima sai sem cookie, `Authorization` e `X-Community-Id`; recarregar traz os votos pelo token do aparelho; código do voto visível.
- `errometro` (194): formato "segunda, 12h".

## Prints

`relatorios/sprint-14/votacao-dark.png`, `votacao-light.png` e `hub-dark.png` (web, Pixel 7). Android e iOS: pendentes (sem aparelho aqui).

## Checklist do DESIGN.md (§14)

- [x] Li o DESIGN.md; cabeçalho, espaçamento e componentes de lá.
- [x] Só `@erre/ui` e tokens (lint `erre/no-raw-style` verde).
- [x] Um botão primário (a barra); desabilitado com motivo.
- [x] Carregando, vazio, erro; sem conexão vira mensagem de erro com o que fazer (sem aviso persistente no topo ainda).
- [x] Nenhuma combinação nova de cor; nenhuma cor por `if` de tema.
- [ ] Alvos de 48 (com `hitSlop` na grade densa) e rótulos em pt-BR feitos; **leitor de tela não testado em aparelho**.
- [ ] Fonte aumentada e "reduzir movimento": pulso respeita a preferência; fonte aumentada não conferida em aparelho.
- [x] Nenhuma ação destrutiva nesta tela.
- [x] Textos na §11 ("código do voto", sem "token").
- [ ] Prints: web nos dois temas; Android e iOS pendentes.

## Decidido

- D-045 (`[contrato]`). Proposta no DESIGN.md §9.4 (grade densa: botão de 40 a 48 com `hitSlop`) e §10.7 (`aria-*`): **precisam de aprovação**.

## Itens de `PARIDADE.md`

ERR-01 e ERR-08 concluídos; ERR-07 e ERR-09 concluídos na web.

## Pendente

- Aparelho: votar no Android e no iOS (secure store, `expo-crypto`, desempenho da assinatura cega no Hermes num Android intermediário, háptico, blur da barra).
- Ir para os resultados depois de votar e o link "Resultados": Sprint 15.
- Aviso persistente de "sem conexão" (§9.15) para o app todo.

## Riscos

- No Android, o `fetch` nativo pode anexar cookies do cookie jar mesmo com `credentials: 'omit'`. O servidor descarta cookie e `Authorization` antes da rota anônima (D-010), então a rota não vê a sessão; o risco que sobra é o cookie trafegar até o servidor.
- O `accessibilityState` não chegava à web em nenhum componente desde o Sprint 10; corrigido aqui, vale conferir as telas antigas com leitor de tela.

## Contrato `[contrato]`

- Faltava onde o módulo guardar coisas no aparelho: `storage` e `secureStorage` no host.
- Um módulo que precise de aleatoriedade segura no nativo depende do app ter instalado `crypto.getRandomValues`; isso agora é garantido pelo app.
- O módulo não sabe quem é a pessoa logada no app: o id veio na resposta da API (`viewerId`). Se mais módulos precisarem, vale pôr o usuário no host.
