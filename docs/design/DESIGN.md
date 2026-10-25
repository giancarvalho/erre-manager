# Referência de design

**Leitura obrigatória antes de criar ou alterar qualquer tela, componente ou texto de interface**, seja no core, no Errômetro, em Eventos ou num módulo do hackathon. Vale para agentes e pessoas.

Este documento parte da análise do app legado (código em `queridometro@7c5c5bf` e capturas reais em [`legado/`](legado/)). Ele preserva a identidade que funciona, corrige o que medimos como problema (contraste, inconsistências) e traduz tudo para React Native.

- **Versão visual:** o design system com tokens, componentes ao vivo nos dois temas e capturas do legado está em https://claude.ai/artifact/6JyXWiTBAsmNXfZKrDhc5x (privado: abre para quem o dono compartilhar). Este documento continua sendo a fonte de verdade; se os dois divergirem, vale este e o artifact é atualizado.
- **Dois temas:** escuro (padrão) e claro (diurno). O legado só tinha o escuro; o claro é desenho novo sobre a mesma identidade (§3.1).
- **Fonte de verdade da implementação:** `packages/ui` (Sprint 10). Este documento define o que o pacote deve conter. Se os dois divergirem, corrija o que estiver errado e registre em `docs/migration/DECISOES.md`.
- **Mudanças neste documento** exigem aprovação humana, como qualquer decisão.

---

## 1. Princípios

1. **O emoji é o protagonista.** A interface é neutra (cinzas zinc sobre quase-preto) para que os emojis, os avatares coloridos e os troféus sejam as únicas coisas coloridas da tela. Não adicione cor decorativa.
2. **Escuro por padrão, claro quando a pessoa quiser.** O escuro é a identidade (o legado só tinha ele) e é o padrão para todos. O modo claro (diurno) existe para leitura sob luz forte e preferência pessoal, com a mesma hierarquia e o mesmo destaque ciano (§3.1). Toda tela é desenhada e conferida nos dois.
3. **Brincadeira com respeito.** A voz é irreverente ("Ritual de iniciação", "Erra com convicção", "Bora votar"), mas o anonimato é sério: nunca brinque com ele nem dê margem a dúvida sobre ele.
4. **Uma ação principal por tela.** Sempre fica óbvio o que fazer a seguir.
5. **Rápido de usar com uma mão.** Votar leva segundos; alvos de toque grandes; ação principal ao alcance do polegar (barra fixa embaixo).
6. **Estado sempre explicado.** Nada fica desabilitado, oculto ou bloqueado sem dizer por quê e o que fazer.
7. **Surpresa e celebração com medida.** Resultados ficam reservados até a rodada fechar; troféus brilham. A animação serve ao significado (seu voto, um troféu), nunca é enfeite.
8. **Consistência entre módulos.** Um módulo do hackathon deve parecer parte do mesmo app. Isso só acontece se todos usarem só `packages/ui` e estes tokens.

---

## 2. Identidade

- **Nome:** Errômetro. **Marca:** 🦄 sobre o fundo escuro com brilho ciano (`legado:src/lib/brand/brand-icon.tsx`).
- **Assinatura visual:** fundo `#09090b`, superfícies translúcidas com borda sutil, rótulos em caixa alta pequena e espaçada (eyebrow), ciano como destaque, dourado para troféus.
- **Voz:** português do Brasil, informal, segunda pessoa ("você", "pra", "bora"), frases curtas, humor leve. Veja §11.

---

## 3. Cores

### 3.1 Temas

O app tem dois temas: **escuro (padrão)** e **claro (diurno)** (D-025).

- **Padrão:** escuro, para todo mundo, inclusive na primeira abertura. É a identidade do app.
- **Escolha:** em Perfil → Aparência, com três opções: "Escuro" (padrão), "Claro" e "Igual ao sistema" (segue o celular ou o navegador e muda junto quando o sistema muda).
- **Onde fica a escolha:** no dispositivo (AsyncStorage no nativo, `localStorage` na web), não no servidor. É preferência de tela, não de conta.
- **Sem piscar o tema errado:** a escolha é lida antes da primeira pintura. Na web, um script inline no `<head>` aplica o tema antes do bundle carregar; no nativo, a splash fica até o tema estar resolvido.
- **Troca instantânea**, sem reiniciar o app, com transição de cor de 150 ms (`motion.color`), desligada com "reduzir movimento".
- **Junto com o tema mudam:** barra de status (`expo-status-bar`: texto claro no escuro, escuro no claro), cor de fundo da janela e da splash, `theme-color` e `color-scheme` na web, teclado (`keyboardAppearance`).
- **Não mudam com o tema:** emojis, cores de avatar (são fundos com o próprio texto), cor escolhida para um evento, ícone do app e da PWA (sempre o 🦄 sobre fundo escuro).
- O modo claro **não existe no legado**: é desenho novo, a partir da mesma identidade. Não há capturas de referência para ele; valide no protótipo (Sprint 2) e na galeria do Sprint 10.

### 3.2 Tokens semânticos

Use **sempre** o token, nunca o hex nem o nome Tailwind direto no código de tela. O componente pede `bg.surface`; o tema decide o valor. Os contrastes indicados foram calculados (WCAG 2) nos dois temas.

**Fundos e superfícies**

| Token | Escuro (padrão) | Claro | Uso |
|---|---|---|---|
| `bg.canvas` | `#09090b` | `#fafafa` | fundo do app |
| `bg.surface` | `rgba(24,24,27,0.5)` | `#ffffff` | cards, listas, acordeões |
| `bg.surfacePressed` | `rgba(24,24,27,0.7)` | `#f4f4f5` | card interativo pressionado |
| `bg.raised` | `#18181b` | `#ffffff` (com sombra) | sheets, modais, toasts, menus |
| `bg.input` | `#18181b` | `#ffffff` | campos de texto |
| `bg.control` | `#27272a` | `#f4f4f5` | botões de emoji, segmentos inativos |
| `bg.controlSelected` | `#3f3f46` | `#e4e4e7` | emoji selecionado, segmento ativo |
| `bg.overlay` | `rgba(9,9,11,0.95)` | `rgba(250,250,250,0.95)` | barras fixas com blur |
| `bg.scrim` | `rgba(0,0,0,0.6)` | `rgba(9,9,11,0.4)` | atrás de sheets e modais |

**Bordas**

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `border.subtle` | `rgba(39,39,42,0.8)` | `#e4e4e7` | contorno de cards e separadores (decorativo) |
| `border.default` | `#3f3f46` | `#d4d4d8` | botões secundários, segmentos (identificados pelo próprio texto) |
| `border.input` | `#71717a` (3,7:1 contra o campo) | `#71717a` (4,8:1) | borda de campo de texto: um campo vazio só é identificável pela borda, e o WCAG pede 3:1 |
| `border.focus` | `#a1a1aa` (7,8:1) | `#52525b` (7,7:1) | foco de teclado e de campo |

**Texto** (contraste sobre `bg.canvas` / sobre `bg.control`)

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `text.primary` | `#fafafa` (19,1 / 15,2) | `#09090b` (19,1 / 18,1) | títulos, nomes, valores |
| `text.secondary` | `#d4d4d8` (13,5 / 10,7) | `#3f3f46` (10,0 / 9,5) | corpo de texto |
| `text.muted` | `#a1a1aa` (7,8 / 5,8) | `#52525b` (7,4 / 7,0) | descrições, legendas, eyebrows, metadados |
| `text.disabled` | `#52525b` (2,6) | `#a1a1aa` (2,5) | **só** texto desabilitado ou decorativo |
| `text.placeholder` | `#71717a` (3,7 no campo) | `#71717a` (4,8 no campo) | placeholder (exemplo, nunca substitui o rótulo) |

**Botão primário** (inverte com o tema)

| Token | Escuro | Claro |
|---|---|---|
| `primary.bg` | `#f4f4f5` | `#18181b` |
| `primary.text` | `#09090b` (18,1:1) | `#fafafa` (17,0:1) |

**Destaque (ciano, a cor da marca)**

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `accent.solid` | `#06b6d4` | `#06b6d4` | fundo do botão de destaque |
| `accent.onSolid` | `#09090b` (8,2:1) | `#09090b` (8,2:1) | texto sobre `accent.solid`; nunca branco |
| `accent.text` | `#67e8f9` (13,7:1) | `#0e7490` (5,1:1; 4,8:1 sobre `accent.subtle`) | texto e ícone em destaque |
| `accent.subtle` | `rgba(6,182,212,0.12)` | `rgba(6,182,212,0.12)` | fundo de selo, ícone em caixa, banner de destaque |
| `accent.border` | `rgba(6,182,212,0.4)` | `rgba(8,145,178,0.4)` | borda de banner e de card em destaque |
| `accent.ring` | `#22d3ee` (11,0:1) | `#0891b2` (3,5:1) | anel de seleção (card escolhido, emoji votado) |
| `accent.glow` | `34 211 238` (rgb) | `6 182 212` (rgb) | brilho "seu voto está aqui" (no claro, discreto) |

**Troféus**

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `trophy.gold` | `#fbbf24` | `#d97706` (3,2:1) | anel do troféu e do 1º lugar |
| `trophy.goldStrong` | `#f59e0b` | `#f59e0b` | selo do troféu (com texto escuro), brilho dourado |
| `trophy.silver` | `#cbd5e1` | `#64748b` (4,8:1) | "quase" (empate) e 2º/3º lugar |
| `trophy.goldSubtle` | `rgba(245,158,11,0.08)` | `rgba(245,158,11,0.1)` | fundo do card de quem ganhou troféu |

**Feedback**

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `danger.text` | `#f87171` (7,2:1) | `#b91c1c` (6,5:1) | mensagens de erro, ações destrutivas |
| `danger.subtle` | `rgba(239,68,68,0.1)` | `rgba(239,68,68,0.08)` | fundo de alerta de erro e botão destrutivo |
| `danger.border` | `rgba(239,68,68,0.3)` | `rgba(185,28,28,0.3)` | borda do botão destrutivo |
| `warning.text` | `#fcd34d` (12,1:1 no fundo de aviso) | `#b45309` (4,6:1 no fundo de aviso) | avisos |
| `warning.subtle` | `rgba(245,158,11,0.1)` | `rgba(245,158,11,0.12)` | fundo de aviso |
| `warning.border` | `rgba(245,158,11,0.2)` | `rgba(180,83,9,0.25)` | borda de aviso |
| `success.text` | `#34d399` (10,4:1) | `#047857` (5,5:1) | confirmação |

### 3.3 Avatares

Oito variantes, escolhidas de forma determinística pelo id do usuário (hash FNV-1a em `legado:src/lib/avatar/variants.ts`; portar exatamente igual, para cada pessoa manter a cor que já tem). O usuário pode trocar no perfil. **Iguais nos dois temas.**

| Variante | Fundo | Texto |
|---|---|---|
| `indigo` | `#4f46e5` | `#e0e7ff` |
| `violet` | `#7c3aed` | `#ede9fe` |
| `emerald` | `#059669` | `#d1fae5` |
| `amber` | `#f59e0b` | `#451a03` |
| `sky` | `#0284c7` | `#e0f2fe` |
| `rose` | `#e11d48` | `#ffe4e6` |
| `slate` | `#475569` | `#f1f5f9` |
| `teal` | `#0d9488` | `#ccfbf1` |

Contraste das iniciais: de 3,3:1 (emerald, teal) a 7,0:1 (amber). Isso passa como texto grande, não como texto normal. Por isso: a inicial é sempre peso 600 e pelo menos 16; e o avatar **nunca é o único identificador** da pessoa: o nome aparece ao lado em texto (e é o rótulo de acessibilidade).

### 3.4 Cor de evento

Eventos têm uma cor de banner escolhida pelo criador (`banner_rgb`). Regras: a cor só tinge fundo (10–15% de opacidade), borda (25–40%), ícone e o brilho do voto naquele evento. **Texto continua com os tokens de texto**, nunca na cor do evento, para garantir contraste com qualquer cor escolhida, nos dois temas. Ícone na cor do evento precisa de 3:1 sobre o fundo do tema; se a cor escolhida não alcançar (ex.: amarelo claro no tema claro), o ícone usa `text.secondary`.

### 3.5 Regras de uso

- **Contraste mínimo WCAG AA nos dois temas:** 4,5:1 para texto normal, 3:1 para texto grande (≥ 18 pt, ou 14 pt em negrito) e para ícones e bordas que identificam um controle. Os tokens acima já cumprem isso; combinações novas precisam ser medidas nos dois temas.
- **Cor nunca é o único sinal.** Selecionado também muda forma ou peso (anel, borda mais grossa, ícone de check); erro também tem mensagem em texto.
- **Proibido** hex ou rgba literal fora de `packages/ui/tokens`, e proibido decidir cor por `if (tema === 'escuro')` numa tela: se um valor precisa mudar com o tema, ele vira token. Uma regra de lint cobre o primeiro caso a partir do Sprint 10.

---

## 4. Tipografia

- **Família:** Geist (texto) e Geist Mono (códigos: chave, código do voto, convite), via `expo-font`. No nativo o `expo-font` precisa de TTF/OTF (o legado só tem WOFF e um TTF Bold): usar `@expo-google-fonts/geist` e `@expo-google-fonts/geist-mono` (TTF, licença OFL), um arquivo por peso.
- **Peso:** 400 regular, 500 médio (padrão de rótulos e botões), 600 semibold (títulos e botões principais), 700 bold (só título de marca).

| Token | Tamanho / altura de linha | Peso | Uso | Origem |
|---|---|---|---|---|
| `display` | 40 / 44 | 700, tracking −0,5 | nome do app na landing | `text-5xl` |
| `title.lg` | 24 / 30 | 600, tracking −0,3 | título da tela ("Demo", "Crie sua conta") | `text-2xl` |
| `title.md` | 18 / 26 | 600 | título de card, sheet ou seção | `text-lg` |
| `body.lg` | 16 / 24 | 400 | descrição de tela, texto de onboarding | `text-base` |
| `body` | 14 / 20 | 400 ou 500 | texto padrão, botões, nomes | `text-sm` (257 usos) |
| `caption` | 12 / 16 | 400 | ajuda, metadados, rodapé de barra | `text-xs` (213 usos) |
| `overline` | 12 / 16 | 500, CAIXA ALTA, tracking +0,8 | eyebrow acima de títulos e rótulos de campo | `text-xs uppercase tracking-wider` |
| `mono` | 13 / 18 | 400 | chave secreta, código do voto, convite | `font-mono text-xs` |

Regras:
- **Tamanho mínimo 12.** O legado usa 10 e 11 px 48 vezes; isso não vem para o app novo.
- **Respeitar o tamanho de fonte do sistema** (`allowFontScaling`). Em componentes densos (grade de emojis, chips), limitar com `maxFontSizeMultiplier={1.4}` em vez de desligar.
- **Padrão de cabeçalho de tela:** `overline` (contexto, ex.: "ERRÔMETRO") → `title.lg` (nome) → `body.lg` em `text.muted` (o que fazer aqui). Ver `legado/05-votacao.png`.
- Títulos com no máximo 2 linhas; usar `numberOfLines` com reticências em nomes e títulos de evento.

---

## 5. Espaçamento e layout

**Base de 4 pt.** Escala: `0.5`=2, `1`=4, `1.5`=6, `2`=8, `3`=12, `4`=16, `5`=20, `6`=24, `8`=32, `10`=40, `12`=48.

| Regra | Valor | Origem |
|---|---|---|
| Margem lateral da tela | 16 (20 em telas ≥ 640) | `px-4 sm:px-5` |
| Largura máxima do conteúdo | 512, centralizado (web/tablet) | `max-w-lg` (37 usos) |
| Topo da tela (abaixo da safe area) | 16 | `pt-4` |
| Rodapé da tela | 40 + safe area | `pb-10` |
| Padding de card | 16 (12 em card denso) | `p-4` / `p-3` |
| Entre itens relacionados (ícone/texto, chips) | 8 | `gap-2` (117 usos) |
| Entre cards de uma lista | 12 | `gap-3` |
| Entre título e conteúdo de uma seção | 12 | `mb-3` |
| Entre seções | 24 | `mb-6` |
| Entre blocos principais | 32 | `mb-8` |

- Layout de coluna única no celular. A grade de votação usa 2 colunas a partir de 360 de largura e 1 coluna abaixo disso.
- Respeitar safe areas (notch, barra de gestos) em toda tela; barras fixas somam `insets.bottom`.
- Telas com campo de texto usam `KeyboardAvoidingView` ou equivalente: o botão de confirmar nunca fica atrás do teclado.

---

## 6. Forma

| Token | Raio | Uso |
|---|---|---|
| `radius.sm` | 6 | chips pequenos, códigos inline |
| `radius.md` | 8 | elementos dentro de cards |
| `radius.lg` | 12 | **botões, campos, cards, botões de emoji, segmentos** |
| `radius.xl` | 16 | banners, sheets, modais |
| `radius.full` | 999 | avatares, selos, pílulas, medalhas |

O legado mistura `rounded-lg` (8) e `rounded-xl` (12) em botões equivalentes. No app novo, **todo controle tocável usa 12**.

Bordas têm 1 px (`border.subtle` em cards, `border.default` em controles). Seleção usa anel de 2 px em `accent.ring`.

---

## 7. Elevação e efeitos

O app é **plano**: profundidade vem de superfície translúcida + borda sutil, não de sombra.

| Efeito | Quando usar | Especificação |
|---|---|---|
| Sombra | só em camadas sobrepostas: sheet, modal, toast, menu | escuro: iOS/web `shadowColor #000, opacity 0.5, radius 24, offset y 8`; claro: `opacity 0.12, radius 24, offset y 8`; Android `elevation 12` nos dois. No tema claro, `bg.raised` é branco sobre `bg.canvas` quase branco: a sombra e a borda `border.subtle` são o que separa a camada |
| **Brilho ciano** | "seu voto está aqui": card de pessoa que já recebeu seu voto; emoji escolhido | anel `accent.ring` 1–2 px + brilho `accent.glow` pulsando (§8) |
| **Brilho dourado** | troféu ganho, 1º lugar | anel `trophy.gold` 2 px + brilho na cor do emoji do troféu (fallback `trophy.goldStrong`) pulsando |
| Brilho prata | "quase" (empate), 2º e 3º lugares | anel `trophy.silver` 2 px, brilho fixo suave, sem pulsar |
| Desfoque (blur) | barra fixa sobre conteúdo rolando; conteúdo reservado ("Resultados reservados") | `expo-blur` (intensidade ~20); no Android, onde o blur é caro, usar `bg.overlay` sólido |
| Gradiente | só tinta sutil em banner de destaque | `accent.subtle` → `rgba(139,92,246,0.05)` (ciano → violeta), `expo-linear-gradient` |

Regras:
- **Brilho tem significado.** Ciano = sua ação; dourado = troféu; prata = quase. Não use brilho para enfeitar.
- **O botão em gradiente ciano→violeta do legado (botão "Criar" do assistente) não vem para o app novo.** Use o botão primário.
- **Degradação no Android:** sombra colorida não é confiável em todas as versões. O brilho precisa funcionar só com o anel animado; a sombra colorida é um extra no iOS e na web.
- **No tema claro, o anel carrega o significado.** Brilho colorido sobre fundo claro quase não aparece; ele fica discreto (opacidade menor) e o anel em `accent.ring` ou `trophy.gold`, que têm 3:1 ou mais sobre o fundo claro, é o que diz "seu voto" ou "troféu".
- **Desfoque no tema claro** usa `bg.overlay` claro; o conteúdo reservado continua ilegível (desfoque + opacidade), nos dois temas.

---

## 8. Movimento e háptico

Tokens extraídos de `legado:src/app/globals.css` e dos componentes. Implementar com Reanimated.

| Token | Duração | Curva | Uso |
|---|---|---|---|
| `motion.press` | 100 ms | ease-out | escala ao pressionar: 0,95 em botão pequeno, 0,98 em botão largo |
| `motion.color` | 150 ms | ease-out | troca de cor de fundo e borda |
| `motion.pop` | 280 ms | `cubic-bezier(0.34,1.56,0.64,1)` (passa do ponto e volta) | aparecer: medalha, troféu, selo, emoji escolhido |
| `motion.fadeUp` | 380 ms | mesma curva, deslocamento 8 | entrada de itens de lista (ranking), escalonar 30–40 ms por item, no máximo 10 itens |
| `motion.expand` | 240 ms | `cubic-bezier(0.22,1,0.36,1)` | abrir e fechar acordeão, seção do formulário |
| `motion.shake` | 420 ms | `cubic-bezier(0.36,0.07,0.19,0.97)`, ±6 | erro de validação |
| `motion.pulseNeon` | 2200 ms, infinito | ease-in-out | brilho ciano |
| `motion.pulseGold` | 2000 ms, infinito | ease-in-out | brilho dourado |
| `motion.sheet` | spring (damping ~20) | — | sheets entrando e saindo |

**Háptico** (`expo-haptics`; na web, nada ou `navigator.vibrate` curto quando houver):

| Momento | Tipo |
|---|---|
| Escolher ou trocar um emoji | `selectionAsync` |
| Enviar votos com sucesso, ganhar troféu | `notificationAsync(Success)` |
| Erro de validação (junto com o shake) | `notificationAsync(Error)` |
| Ação destrutiva confirmada | `impactAsync(Medium)` |

**Reduzir movimento:** respeitar a preferência do sistema (`useReducedMotion` do Reanimated). Com ela ligada: sem pulsos infinitos (anel fixo no lugar), sem shake (só a mensagem e o háptico), `pop` e `fadeUp` viram fade de 150 ms.

---

## 9. Componentes

Todos vivem em `packages/ui`. Cada componente tem: estados padrão, pressionado, foco (web/teclado), desabilitado e carregando, quando fizer sentido. Telas de módulo **não** estilizam primitivos do React Native diretamente para criar variações; se faltar algo, o componente entra em `packages/ui`.

### 9.1 Botões

| Variante | Visual | Quando |
|---|---|---|
| **Primário** | fundo `primary.bg`, texto `primary.text` 14/600 (claro sobre escuro no tema claro, e o inverso no escuro) | a ação principal da tela. **No máximo um por tela.** (Legado: "Criar meu Errômetro", "Continuar", barra de votos) |
| **Destaque** | fundo `accent.solid`, texto `accent.onSolid` 14/600, brilho ciano opcional | ação dentro de um contexto em destaque (banner de evento aberto) ou momento de celebração ("Ir votar e liberar"). Nunca na mesma tela que um primário |
| **Secundário** | fundo transparente, borda `border.default`, texto `text.primary` 14/500 | alternativas: "Voltar", "Entrar com o código de convite", "Continuar com Google" |
| **Fantasma** | sem fundo e sem borda, texto `text.muted` → `text.primary` ao pressionar, ícone opcional | navegação secundária: "Ver como funciona ›", "Entrar" |
| **Destrutivo** | fundo `danger.subtle`, borda `danger.border`, texto `danger.text` | remover, excluir, anular. Sempre com confirmação (§10) |

- **Altura mínima 48** (atende 44 pt do iOS e 48 dp do Android), padding horizontal 20, raio 12. Largura total no celular quando for a ação principal.
- Botão compacto (36 de altura) só dentro de listas e cards densos, com `hitSlop` para completar 48.
- **Carregando:** mantém a largura, troca o rótulo pelo gerúndio ("Criando conta…", "Enviando…") e desabilita. Spinner só se não houver rótulo.
- **Desabilitado:** opacidade 0,4 e **um texto abaixo explicando por quê** ("Escolha pelo menos um emoji para continuar.").
- Rótulo é um verbo da ação ("Criar comunidade", "Enviar votos"), nunca "OK" ou "Sim".
- **Correção em relação ao legado:** o botão `bg-cyan-600/90` com texto claro (23 usos) tem contraste de 4,2:1 e não passa no AA. Ele vira **Destaque** (ciano claro com texto escuro, 8,2:1) ou **Primário**.

### 9.2 Campos de formulário

- Rótulo em `overline` **acima** do campo (padrão do legado: "USERNAME", "COMO VOCÊ QUER APARECER PRO GRUPO?"; no app novo, "pra comunidade"). Placeholder só como exemplo ("ex: Noite"), nunca no lugar do rótulo.
- Campo: altura 48, fundo `bg.input`, borda `border.input`, raio 12, padding horizontal 16, texto `body` em `text.primary`.
- Foco: borda `border.focus` e anel de 1 px.
- Erro: borda `danger.text`, mensagem abaixo em `caption` `danger.text`, shake + háptico de erro. A mensagem diz o que fazer ("Use só letras minúsculas, números e hífens.").
- Ajuda: abaixo do campo em `caption` `text.muted`.
- Validação ao sair do campo ou ao enviar, não a cada tecla (exceto disponibilidade de nome, com debounce e estado "Verificando…").
- Teclado certo para cada campo (`autoCapitalize="none"` em username e slug, `textContentType`, `autoComplete`), e "próximo campo" no botão de retorno.

### 9.3 Cards

- **Card:** `bg.surface`, borda `border.subtle`, raio 12, padding 16.
- **Card tocável:** igual, mais `bg.surfacePressed` ao pressionar. Precisa parecer tocável: chevron, botão ou título que indique destino.
- **Card selecionável** (opções do assistente, ver `legado/04-assistente-passo4-selecao.png`): selecionado ganha anel 2 px `accent.ring`. Selo "RECOMENDADO" na opção sugerida.
- **Card de pessoa na votação:** avatar 64, nome `body` 500, grade de emojis 3 colunas. Com voto: anel `accent.ring` + pulso ciano.

### 9.4 Botão de emoji (grade de votação)

- 48 × 48 no mínimo, raio 12, fundo `bg.control`, emoji em 22–24.
- Selecionado: fundo `bg.controlSelected`, anel 1 px `accent.ring`, `motion.pop`, háptico de seleção. Tocar de novo no mesmo emoji desmarca.
- `accessibilityLabel` com nome e significado ("Cobra: falso, age pelas costas") e `accessibilityState={{ selected }}`.

### 9.5 Avatar

Círculo com a inicial (ou foto, no futuro), variante de cor (§3.3), anel 1 px na cor clara da variante a 30%. Tamanhos 32 (listas), 40 (cabeçalhos, ranking), 64 (votação, perfil).

### 9.6 Selos e pílulas

`radius.full`, padding 4 × 10, `overline` sem tracking extra. Variantes: destaque (`accent.subtle` + `accent.text`), neutro (`bg.control` + `text.secondary`), aviso, erro.

### 9.7 Controle segmentado

Contêiner com borda `border.default`, raio 12, padding 4; segmento ativo com fundo `bg.control` e `text.primary`; inativo em `text.muted`. Usado em "Alfabética / Não votados".

### 9.8 Acordeão

Linha com ícone, título e chevron que gira; conteúdo abre com `motion.expand`. Usado na legenda "O que significa cada emoji?".

### 9.9 Barra de ação fixa

Fica no rodapé da tela de votação e de formulários longos. Fundo `bg.overlay` com blur, borda superior `border.subtle`, padding 16 + safe area. Contém o botão primário em largura total e, abaixo, uma linha de `caption` com o estado ("Escolha pelo menos um emoji para continuar.", "3 de 12 pessoas votadas").

### 9.10 Sheet e modal

- **Sheet** (padrão para fluxos e escolhas): sobe de baixo, raio 16 no topo, `bg.raised`, borda `border.subtle`, scrim atrás, alça de arrastar, fechar com X (canto superior direito, rótulo acessível "Fechar") e com gesto.
- Estrutura: `overline` de contexto ("RITUAL DE INICIAÇÃO · PASSO 1 DE 4") → `title.lg` → conteúdo → ações (secundário à esquerda, primário à direita, mesma altura).
- **Modal centralizado** só para confirmação curta (§10).

### 9.11 Toast

Topo da tela, `bg.raised`, borda `border.subtle`, sombra, raio 12. Título `body` 500 em `text.primary`, descrição `caption` em `text.muted`. Some sozinho em 4 s; erros ficam até o usuário fechar. Frase curta, no tom do app ("Conta criada. Bora votar."). Nunca é o único lugar de um erro importante: o erro também aparece junto do que falhou.

### 9.12 Banner e aviso

| Tipo | Fundo / borda / texto | Uso |
|---|---|---|
| Informação | `bg.surface` / `border.subtle` / `text.muted` | contexto neutro |
| Aviso | `warning.subtle` / `warning.border` / `warning.text` | "Faltam 3h pra fechar", algo exige atenção |
| Erro | `danger.subtle` / `danger.border` / `danger.text` | falha que bloqueia |
| Destaque | gradiente de destaque / `accent.border`; ícone em caixa 40 × 40 com `accent.subtle` e `accent.text` | evento aberto, rodada liberada; tem uma ação de destaque |
| Evento | como o destaque, tingido com a cor do evento (§3.4) | banner de evento |

### 9.13 Conteúdo reservado

**Uso restrito.** No legado, esta tela só aparece no grupo demo (`legado:src/components/results/ResultsPaywall.tsx`); membros aprovados sempre veem os resultados sem precisar votar (`legado:src/app/results/page.tsx:222`), e isso continua valendo (D-026). Use o padrão só quando um conteúdo de fato depende de uma ação da pessoa; se o grupo demo for descartado (P-003), ele pode não ter uso na v1. Quando usado (ver `legado/08-resultados-reservados.png`): conteúdo desfocado ao fundo, card central `bg.raised` com título, explicação de uma linha e um botão de destaque que leva à ação que libera ("Ir votar e liberar"). Nunca mostrar dados reais sob o desfoque que possam ser lidos de outra forma (ex.: acessibilidade): os itens desfocados devem ser `accessibilityElementsHidden`.

### 9.14 Medalha de troféu e ranking

- **Medalha:** emoji num círculo com gradiente vertical (dourado 20% → `bg.surface` → `bg.canvas`), anel 2 px dourado e brilho; selo pequeno com 🏆 no canto inferior direito (fundo `trophy.goldStrong`, contorno 2 px `bg.canvas`). Variante prata para "quase". Entra com `motion.pop`.
- **Linha do ranking:** posição (`body` 500, `text.muted`, 24 de largura) · avatar 40 · nome e emojis recebidos (chips) · total à direita. 1º lugar: anel dourado com pulso; 2º e 3º: anel prata fixo; quem ganhou troféu: fundo `trophy.goldSubtle`. Entrada com `motion.fadeUp` escalonado.

### 9.15 Estados de tela

Toda tela que carrega dados tem os quatro estados desenhados:

| Estado | Padrão |
|---|---|
| Carregando | esqueleto com a forma do conteúdo (`bg.control`, pulso de opacidade 1,2 s); spinner só se a espera for imprevisível e curta |
| Vazio | ícone ou emoji grande, uma frase do que é isso, uma ação para sair do vazio ("Nenhum evento ainda." + "Criar evento") |
| Erro | o que aconteceu em linguagem simples + "Tentar de novo"; sem códigos técnicos |
| Sem conexão | aviso persistente no topo; ações que precisam de rede ficam desabilitadas com explicação |

### 9.16 Navegação e cabeçalho

- Navegação em pilha (stack). Cabeçalho: voltar com seta + rótulo do destino ("← Início"), alinhado à esquerda, como no legado.
- Gesto de voltar nativo sempre ativo (iOS) e botão voltar do Android respeitado.
- Abaixo do cabeçalho, o padrão de título da §4.
- **Estrutura (D-033, proposta do Sprint 2):** pilha sem barra de abas na v1.
  - Sem sessão → `Entrar`. Com sessão e sem comunidade → criar comunidade ou abrir convite.
  - Com comunidade → **hub da comunidade** como tela inicial, com uma seção por módulo habilitado (Errômetro, Eventos); telas de módulo entram na pilha.
  - Perfil (e Aparência dentro dele) pelo avatar no canto do cabeçalho do hub; seletor de comunidade no cabeçalho só para quem tem mais de uma.
  - Rotas Expo Router: `(auth)/entrar`, `(app)/index` (hub), `(app)/perfil`, `(app)/perfil/aparencia`, `(app)/errometro/...`, `(app)/eventos/...`, `convite/[codigo]`.
  - Reavaliar barra de abas quando houver 4 ou mais módulos.

### 9.17 Interruptor (proposto no Sprint 9)

Para preferências que ligam e desligam na hora (notificações por tipo, "receber notificações neste aparelho").

- Linha inteira tocável (altura mínima 48): rótulo `body` 500 em `text.primary` e, se houver, descrição `caption` em `text.muted` abaixo; o interruptor à direita.
- `Switch` nativo do React Native (funciona na web pelo React Native Web), com trilho `accent.solid` quando ligado e `bg.controlSelected` quando desligado; botão `primary.bg` (claro) no tema escuro e `bg.raised` no claro (o próprio sistema desenha a sombra).
- A mudança vale na hora, sem botão de salvar; em erro, volta ao estado anterior e mostra o motivo em `caption` `danger.text`.
- Acessibilidade: `accessibilityRole="switch"`, `accessibilityState={{ checked }}`, rótulo da linha como `accessibilityLabel`.
- Desabilitado: opacidade 0,4 e texto do motivo abaixo (§9.1), como "Seu navegador não aceita notificações."

---

## 10. Boas práticas de UX

### 10.1 Confiança e anonimato

- Explique o anonimato uma vez, no lugar certo (onboarding e legenda): "Ninguém vê quem votou o quê".
- Nenhuma tela, texto, notificação ou log mostra ou sugere quem votou em quem. Nem para admins.
- O "código do seu voto" (para anulação) é apresentado como algo que **só você tem** e que você compartilha se quiser.
- Pedidos de permissão (notificação) explicam o benefício antes do diálogo do sistema e aparecem num momento de valor (depois do primeiro voto), não ao abrir o app.

### 10.2 Clareza de estado

- Rodada aberta mostra quando fecha ("Fecha segunda, 12h"); rodada fechada mostra quando abre a próxima.
- Progresso visível em tarefas com várias etapas ("PASSO 2 DE 4", "3 de 12 pessoas votadas").
- Botão desabilitado sempre com o motivo (§9.1).
- Estados de participação (pendente, aprovado, recusado, fila) têm texto próprio e, quando possível, o que a pessoa pode fazer.

### 10.3 Feedback e prevenção de erro

- Resposta imediata ao toque (pressionado + háptico); seleção otimista na interface.
- Ações reversíveis não pedem confirmação; oferecem "Desfazer" no toast quando possível.
- **Confirmação obrigatória** para o que é destrutivo ou irreversível: anular voto, remover membro, excluir evento, sair da comunidade. O diálogo diz a consequência e o botão repete o verbo ("Remover Ana").
- Valores padrão bons e recomendados ("Clássico — RECOMENDADO").

### 10.4 Revelação progressiva

- Mostre o essencial; detalhes em acordeão (legenda dos emojis), configurações avançadas em telas próprias.
- Assistentes com no máximo 4 passos, com voltar em todos.

### 10.5 Celebração com medida

- Troféu e resultado liberado merecem `pop`, brilho e háptico de sucesso.
- No máximo um tipo de animação contínua por região da tela; pulsos só onde têm significado (§7).

### 10.6 Desempenho percebido

- Esqueleto em vez de tela em branco; prefetch da próxima tela provável (ex.: resultados depois de votar).
- Listas longas virtualizadas (a votação pode ter 50 pessoas × 15 emojis = 750 botões): `FlashList`, itens memoizados.
- Imagens e emojis personalizados com tamanho definido para não deslocar o layout.

### 10.7 Acessibilidade

- Contraste AA nos dois temas (§3.5) e alvos de toque de 48 (§9.1).
- Todo controle tem `accessibilityRole` e `accessibilityLabel` em pt-BR; botões só com ícone sempre têm rótulo ("Fechar", "Copiar chave").
- Estados anunciados (`accessibilityState`: selected, disabled, expanded) e mudanças importantes anunciadas (`AccessibilityInfo.announceForAccessibility`: "Votos enviados").
- Ordem de foco lógica; na web, tudo alcançável por teclado com foco visível (o legado corrigiu isso no commit `e0dedf0`).
- Fonte escalável (§4), reduzir movimento (§8), cor nunca como único sinal.
- Idioma da página/app em `pt-BR` (leitores de tela pronunciam certo).

### 10.8 Plataformas

- O mesmo design nas três plataformas, com comportamentos nativos onde o usuário espera: gesto de voltar, teclado, compartilhar (`expo-sharing`/folha nativa), háptico.
- **Web/PWA:** estados de hover equivalentes ao pressionado (mais sutis), cursor de ponteiro em tocáveis, conteúdo centralizado em 512 em telas largas, instalável.
- Nada depende só de hover (não existe no toque).

---

## 11. Escrita de interface (pt-BR)

- **Tom:** informal e direto, segunda pessoa, humor leve. Ex.: "Conta criada. Bora votar.", "Erra com convicção."
- **Botões:** verbo no infinitivo + objeto quando ajudar ("Criar comunidade", "Enviar votos", "Copiar chave"). Primeira letra maiúscula, resto minúsculo.
- **Eyebrows e rótulos de campo:** CAIXA ALTA (via estilo `overline`, não digitando em maiúsculas no texto).
- **Erros:** o que aconteceu + o que fazer, sem culpar e sem código técnico. "Esse nome já existe. Tente outro." em vez de "Erro 409".
- **Vocabulário técnico proibido na interface:** `voter_tag` → "código do seu voto"; "snapshot" → "resultado"; "token" → não aparece; "slug" → "código de convite".
- **Datas e números** no formato brasileiro, no fuso da votação (`date-fns` com `ptBR`): "segunda, 12h", "há 3 horas", "1.234".
- **Consistência de termos:** "rodada" (não "ciclo" e "rodada" misturados), "comunidade", "membro", "evento", "troféu", "votar". "Grupo" não aparece na v1 (não há subgrupos, D-026). Mantenha uma lista em `packages/ui` se o glossário crescer.
- Textos de interface ficam no código do módulo (pt-BR); não há internacionalização na v1, mas nada impede adicioná-la depois (strings não são montadas por concatenação).

---

## 12. O que muda em relação ao legado

| Problema medido no legado | Evidência | No app novo |
|---|---|---|
| Quatro estilos de botão principal: branco, ciano escuro, ciano claro com brilho e gradiente ciano→violeta | `bg-zinc-100` (15), `bg-cyan-600/90` (23), `bg-cyan-500` (16), `from-cyan-500` (5) | Dois: **Primário** (branco) e **Destaque** (ciano claro) com regra de uso (§9.1) |
| Botão ciano escuro com texto claro abaixo do AA | 4,2:1 | Ciano claro com texto escuro, 8,2:1 |
| Texto secundário mais usado abaixo do AA | `text-zinc-500` (164 usos): 4,1:1 no fundo, 4,0:1 em card | `text.muted` = zinc-400, 7,8:1 |
| Texto `zinc-600` usado como texto legível | 35 usos, 2,6:1 | Só para desabilitado/decorativo |
| Texto de 10 e 11 px | 48 usos | Mínimo 12 |
| Raio de botões alternando entre 8 e 12 | `rounded-lg` (119) e `rounded-xl` (121) | 12 para todo controle tocável |
| Feedback pensado para mouse | 193 usos de `hover:` contra 20 de `active:` (pressionado) | Estado pressionado em todo tocável; hover é extra na web |
| Bordas de campo com pouco contraste | `border-zinc-700/800`: 1,7:1 contra o fundo do campo | `border.input` (3,7:1) |
| Só tema escuro (`className="dark"` fixo) | `legado:src/app/layout.tsx` | Escuro (padrão) e claro, com escolha em Perfil → Aparência (§3.1) |
| Landing diz "grupos de até 50 pessoas", mas grupos aceitam 300 (50 é o limite de votantes do Errômetro) | `legado/01-landing.png`, `group-limits.ts` | Texto alinhado aos limites por comunidade: até 50 votantes, até 300 membros (D-027) |

---

## 13. Tokens para `packages/ui` (ponto de partida do Sprint 10)

```ts
// packages/ui/src/tokens.ts
// Os dois temas têm exatamente as mesmas chaves; um teste garante isso.
const dark = {
  bg: {
    canvas: '#09090b',
    surface: 'rgba(24,24,27,0.5)',
    surfacePressed: 'rgba(24,24,27,0.7)',
    raised: '#18181b',
    input: '#18181b',
    control: '#27272a',
    controlSelected: '#3f3f46',
    overlay: 'rgba(9,9,11,0.95)',
    scrim: 'rgba(0,0,0,0.6)',
  },
  border: { subtle: 'rgba(39,39,42,0.8)', default: '#3f3f46', input: '#71717a', focus: '#a1a1aa' },
  text: { primary: '#fafafa', secondary: '#d4d4d8', muted: '#a1a1aa', disabled: '#52525b', placeholder: '#71717a' },
  primary: { bg: '#f4f4f5', text: '#09090b' },
  accent: {
    solid: '#06b6d4',
    onSolid: '#09090b',
    text: '#67e8f9',
    subtle: 'rgba(6,182,212,0.12)',
    border: 'rgba(6,182,212,0.4)',
    ring: '#22d3ee',
    glowRgb: '34 211 238',
  },
  trophy: { gold: '#fbbf24', goldStrong: '#f59e0b', silver: '#cbd5e1', goldSubtle: 'rgba(245,158,11,0.08)' },
  danger: { text: '#f87171', subtle: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  warning: { text: '#fcd34d', subtle: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  success: { text: '#34d399' },
  shadow: { color: '#000000', opacity: 0.5 },
  statusBar: 'light',
} as const

const light: ThemeColors = {
  bg: {
    canvas: '#fafafa',
    surface: '#ffffff',
    surfacePressed: '#f4f4f5',
    raised: '#ffffff',
    input: '#ffffff',
    control: '#f4f4f5',
    controlSelected: '#e4e4e7',
    overlay: 'rgba(250,250,250,0.95)',
    scrim: 'rgba(9,9,11,0.4)',
  },
  border: { subtle: '#e4e4e7', default: '#d4d4d8', input: '#71717a', focus: '#52525b' },
  text: { primary: '#09090b', secondary: '#3f3f46', muted: '#52525b', disabled: '#a1a1aa', placeholder: '#71717a' },
  primary: { bg: '#18181b', text: '#fafafa' },
  accent: {
    solid: '#06b6d4',
    onSolid: '#09090b',
    text: '#0e7490',
    subtle: 'rgba(6,182,212,0.12)',
    border: 'rgba(8,145,178,0.4)',
    ring: '#0891b2',
    glowRgb: '6 182 212',
  },
  trophy: { gold: '#d97706', goldStrong: '#f59e0b', silver: '#64748b', goldSubtle: 'rgba(245,158,11,0.1)' },
  danger: { text: '#b91c1c', subtle: 'rgba(239,68,68,0.08)', border: 'rgba(185,28,28,0.3)' },
  warning: { text: '#b45309', subtle: 'rgba(245,158,11,0.12)', border: 'rgba(180,83,9,0.25)' },
  success: { text: '#047857' },
  shadow: { color: '#000000', opacity: 0.12 },
  statusBar: 'dark',
}

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : Widen<T[K]> }
export type ThemeColors = Widen<typeof dark>
export type ThemeName = 'dark' | 'light'
export type ThemePreference = ThemeName | 'system'

export const themes: Record<ThemeName, ThemeColors> = { dark, light }
export const DEFAULT_THEME: ThemeName = 'dark'
// Preferência salva no dispositivo; "system" segue Appearance/prefers-color-scheme.

// Iguais nos dois temas
export const avatar = {
  indigo: { bg: '#4f46e5', text: '#e0e7ff' },
  violet: { bg: '#7c3aed', text: '#ede9fe' },
  emerald: { bg: '#059669', text: '#d1fae5' },
  amber: { bg: '#f59e0b', text: '#451a03' },
  sky: { bg: '#0284c7', text: '#e0f2fe' },
  rose: { bg: '#e11d48', text: '#ffe4e6' },
  slate: { bg: '#475569', text: '#f1f5f9' },
  teal: { bg: '#0d9488', text: '#ccfbf1' },
} as const

export const space = { 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 } as const
export const layout = { screenPadding: 16, screenPaddingWide: 20, contentMaxWidth: 512, minTouch: 48 } as const

export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '700', letterSpacing: -0.5 },
  titleLg: { fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.3 },
  titleMd: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' },
  mono: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const

export const motion = {
  press: { duration: 100, scaleSmall: 0.95, scaleWide: 0.98 },
  color: { duration: 150 },
  pop: { duration: 280, easing: [0.34, 1.56, 0.64, 1] },
  fadeUp: { duration: 380, easing: [0.34, 1.56, 0.64, 1], distance: 8, stagger: 35, maxStaggered: 10 },
  expand: { duration: 240, easing: [0.22, 1, 0.36, 1] },
  shake: { duration: 420, easing: [0.36, 0.07, 0.19, 0.97], distance: 6 },
  pulseNeon: { duration: 2200 },
  pulseGold: { duration: 2000 },
} as const
```

---

## 14. Checklist de PR com interface

Copie no PR e marque:

- [ ] Li este documento; a tela segue o padrão de cabeçalho, espaçamento e componentes daqui.
- [ ] Só componentes de `packages/ui` e tokens; nenhum hex/rgba literal, nenhum tamanho de fonte fora da escala.
- [ ] No máximo um botão primário; botões desabilitados explicam o motivo.
- [ ] Estados de carregando, vazio, erro e sem conexão implementados.
- [ ] Contraste AA conferido nos dois temas para qualquer combinação nova de cor; nenhuma cor decidida por `if` de tema na tela.
- [ ] Alvos de toque ≥ 48; rótulos e estados de acessibilidade em pt-BR; testado com leitor de tela em pelo menos uma plataforma.
- [ ] Funciona com fonte do sistema aumentada e com "reduzir movimento".
- [ ] Ações destrutivas têm confirmação; ações reversíveis não.
- [ ] Textos seguem a §11 (tom, verbos, sem jargão técnico).
- [ ] Prints da tela em web, Android e iOS no PR, no tema escuro; e pelo menos uma plataforma no tema claro.

---

## 15. Capturas do legado

Em [`legado/`](legado/), capturadas do app rodando localmente em 390 × 844, sem banco:

| Arquivo | O que mostra |
|---|---|
| `01-landing.png` | eyebrow ciano, marca, botão primário branco, secundário com borda, link fantasma |
| `02-cadastro.png` | padrão de cabeçalho, rótulos em `overline`, campos, botão Google secundário, primário desabilitado |
| `03-assistente-passo1.png` | sheet com passos, cards informativos com emoji |
| `04-assistente-passo4-selecao.png` | card selecionável com anel ciano e selo "RECOMENDADO"; botão em gradiente (a não repetir) |
| `05-votacao.png` | cabeçalho, acordeão, controle segmentado, cards de pessoa, grade de emojis, barra fixa |
| `06-votacao-legenda.png` | acordeão aberto com o significado dos emojis |
| `07-votacao-selecionado.png` | emoji escolhido e cards com voto brilhando em ciano |
| `08-resultados-reservados.png` | conteúdo desfocado com card de liberação e botão de destaque com brilho (no legado, só no grupo demo) |

As capturas são referência de identidade e de padrões, não de pixel: onde elas contradizem a §12, vale a §12.
