# Sprint 10 — `packages/ui`: design system

## O que foi feito

- `tokens.ts` igual à §13 do DESIGN.md (com `label` e as famílias Geist) e a correção de `warning.text` claro (abaixo).
- Componentes: `Text`, `Screen`, `ScreenHeader`, `Button` (5 variantes, carregando, motivo do desabilitado), `IconButton`, `TextField` (shake e háptico no erro), `Card` (simples, tocável, selecionável), `EmojiButton`, `Avatar` (anel), `Badge`, `SegmentedControl`, `Accordion`, `StickyActionBar` (blur; sólido no Android), `Sheet`, `ConfirmDialog`, `ConfirmCard`, `Toast`, `Banner` (5 tipos, incluindo cor de evento), `ReservedContent`, `TrophyMedallion`, `RankingRow`, `Skeleton`, `EmptyState`, `ErrorState`, `LoadingState`, `SwitchRow`, `ThemePicker`.
- Movimento (`motion.ts`) e háptico (`haptics.ts`) com "reduzir movimento".
- Tema salvo no aparelho; na web, script no `<head>` antes do bundle; splash até tema, fontes e preferências estarem prontos; fundo da janela no nativo segue o tema. Tela Perfil → Aparência.
- Lint `erre/no-raw-style`. Galeria `/dev/ui` (só com `EXPO_PUBLIC_DEV_GALLERY=1`).
- Preferências do app (comunidade escolhida, token de push) passam a persistir no nativo.

## Testes

- Contraste WCAG (59): 24 pares de token por tema e as 8 variantes de avatar.
- Lint (58 no total): cores literais e `fontSize` fora de `packages/ui`.
- App (25): galeria inteira nos dois temas; emoji marca e desmarca; segmentos e acordeão anunciam o estado; botão desabilitado explica o motivo; toast; troca de tema; `index.html` atualizado.
- E2E web (11): galeria nos dois temas, sheet, diálogo e toast.

## Prints

`relatorios/sprint-10/galeria-dark.png` e `galeria-light.png` (web, Pixel 7). Olhando os prints, corrigi três coisas: motivo do botão desabilitado centralizado num botão alinhado à esquerda; card do conteúdo reservado cortado; esqueleto quase invisível no tema claro.

Comparação com o legado (`docs/design/legado/`): mesma identidade (fundo `#09090b`, superfícies translúcidas com borda sutil, eyebrow em caixa alta, ciano de destaque, dourado nos troféus); botão de destaque com texto escuro (contraste 8,2:1, o legado tinha 4,2:1); tamanho mínimo de fonte 12.

## Decidido

- D-041. **Correção do token `warning.text` claro (`#b45309` → `#92400e`)**: precisa de confirmação; a página visual publicada do design ainda mostra o valor antigo.
- P-016 (biblioteca de ícones) aberta, com recomendação de seguir com glifos por enquanto.

## Pendente

- Rodar a galeria num Android e num iPhone (fontes, blur, háptico, sombra do sheet) e tirar os prints dessas plataformas.
- Gesto de arrastar o sheet (depende de biblioteca de gestos).
- Testar com leitor de tela (VoiceOver/TalkBack) em aparelho.

## Riscos

- O mock do Reanimated nos testes cobre só a API usada; componente novo com outra API do Reanimated precisa estender `apps/mobile/test/mocks/reanimated.tsx`.

## Contrato `[contrato]`

- Módulos usam só `@erre/ui` e tokens; o lint agora garante a parte de cores e fontes.
