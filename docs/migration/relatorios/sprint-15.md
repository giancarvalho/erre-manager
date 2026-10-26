# Sprint 15 — Errômetro UI II: resultados e administração

> **Gate humano (revisão assíncrona, D-029):** paridade do Errômetro. Falta conferir em Android e iOS.

## O que foi feito

- **Resultados:** navegação entre rodadas fechadas, medalhas dos troféus da rodada, ranking com selos de troféu e "quase", comentários (escrever, editar o próprio, apagar o próprio ou qualquer um como moderador, com confirmação), compartilhar no formato do legado, próximo resultado, vazio e aviso de rodada escondida só para moderadores.
- **Administração:** votantes, liberar agora, recalcular, esconder/reexibir, anular por código, cadência (dias e hora, ou manual) e emojis (ordem, catálogo, guardados e novos).
- Hub com "Administrar Errômetro" para quem modera; menu do módulo com "Votar" e "Resultados"; "← Início" nas telas do módulo; "Ver resultados" na votação.
- Seção de perfil `errometro.trofeus` renderizada.
- `@erre/ui`: `ChipToggle`, `Stepper`, selos de troféu no `RankingRow`; sem anel de pódio para quem tem zero.
- Contrato: `webUrl` e `back()` no host; `canModerate` em `GET /rodada`.

## Testes

- App (43): 10 novos: resultados (rodada mais recente, troféus, anterior/próxima, vazio), comentários (abrir, escrever, apagar com confirmação), administração (só moderador; aprovar e remover com confirmação; liberar e esconder com confirmação, rodada aberta sem "Esconder"; anular com validação e confirmação; cadência com os dias e a hora certos; emojis do catálogo e novo, com validação de grafema), seção de troféus.
- E2E web (12): o fluxo do Errômetro agora vai até a moderadora liberar a rodada, o convidado abrir os resultados, ver o ranking e comentar, sem botão de administração.
- `errometro` (194) e o resto da suíte sem mudança.

## Prints

`relatorios/sprint-15/resultados-dark.png` e `admin-light.png` (web, Pixel 7). Olhando os prints, corrigi o anel de 2º lugar em quem tinha zero votos. Android e iOS: pendentes.

## Checklist do DESIGN.md (§14)

- [x] Cabeçalho, espaçamento e componentes do DESIGN.md; só `@erre/ui` e tokens.
- [x] No máximo um primário por tela ("Salvar emojis" na administração); desabilitados com motivo.
- [x] Carregando, vazio e erro; sem conexão como mensagem de erro.
- [x] Ações destrutivas confirmam (remover votante, esconder, liberar, anular, apagar comentário); reversíveis não.
- [x] Textos na §11.
- [ ] Leitor de tela, fonte aumentada e prints em Android e iOS: pendentes (sem aparelho).

## Paridade (`PARIDADE.md`)

Todos os `ERR-*` a migrar estão concluídos na web. ERR-10 (voto HMAC do demo) e ERR-22 ("Resultados reservados") esperam a resposta de **P-003** (demo); recomendação: descartar. ERR-21 tem API e renderizador; a página de membro é do Sprint 18.

## Decidido

- D-046 (`[contrato]`). Propostas no DESIGN.md §9.14 (sem anel de pódio com zero; `ChipToggle`; `Stepper`): **precisam de aprovação**.

## Pendente

- Conferir toda a paridade do Errômetro em Android e iOS (gate deste sprint).
- P-003, P-017, P-018.

## Contrato `[contrato]`

- O módulo precisava do endereço público do app para o link do "Compartilhar" e de um "voltar": `webUrl` e `back()` no host.
- Estado "pode moderar" veio na resposta da API (`canModerate`); um `can()` no host evitaria esse campo por módulo.
