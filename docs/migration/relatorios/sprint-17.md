# Sprint 17 — Eventos UI

## O que foi feito

- Telas do módulo `eventos`: lista, evento (sala de espera, inscrição, inscritos, administração), assistente de criação e edição em sheet (4 passos), votação categórica e por escala, resultados com troféus, ranking e compartilhar, seção do hub com o banner do evento e renderizador da seção de perfil `eventos.trofeus`.
- `@erre/ui`: `IntensityPicker` (pips do eixo), `RankingRow` com `valueLabel`, vibração na web.
- Rotas finas no app e registro do módulo; domínio de apresentação (`presentation.ts`) testado.

## Testes

- Domínio (`eventos`): ordem e rótulos das telas, banner do hub (2 dias), escala em %, troféus e texto de compartilhamento (9 novos).
- Componentes (`apps/mobile`, 10): banner do hub, lista, assistente com validação por passo, inscrição, publicar e excluir com confirmação, cédula categórica e de escala sem identidade, estado antes de abrir, resultados de escala.
- E2E: criar pelo assistente, publicar, convite com a intenção do evento, abrir, votar anonimamente (sem cookie, `Authorization` nem `X-Community-Id`), fechar, ver o resultado; depois um evento de escala votado pelos pips.
- `pnpm check` e e2e verdes.

## Prints (DESIGN §14)

`sprint-17/votacao-escala-dark.png`, `votacao-escala-light.png`, `hub-light.png`, `assistente-dark.png`, `resultados-dark.png`. Android e iOS: pendente de aparelho (como nos Sprints 14 e 15).

## Checklist DESIGN §14

Componentes e tokens do `@erre/ui` só; dois temas; texto nunca na cor do evento; alvos de 48 (pips com 48 de altura); estados de carregando, vazio e erro; confirmação em publicar, abrir, fechar e excluir; rótulos de acessibilidade em pt-BR; nada sugere quem votou em quem.

## Decidido

- D-048 (`[contrato]`). Propostas no DESIGN.md: seletor de intensidade (§9.4) e linha de ranking de escala (§9.14).

## Itens de `PARIDADE.md`

EVT-01, EVT-02, EVT-03, EVT-05, EVT-07, EVT-10 e EVT-13 concluídos na web; EVT-12 com o renderizador (página de membro no Sprint 18).

## Pendente

- Testes nos aparelhos (gate deste sprint).
- Seletor de data nativo: as datas são digitadas; se for incômodo, avaliar `@react-native-community/datetimepicker` (dependência nativa nova).
- O brilho do voto continua ciano, não na cor do evento (DESIGN §3.4 permite tingir); fica para quando o `VoteTargetCard` aceitar uma cor.

## Riscos

- Datas no fuso do aparelho: quem cria um evento agendado fora do fuso da comunidade vê e digita no próprio fuso. Igual ao legado.

## Contrato `[contrato]`

- O helper de erros da API (`ok`, `EventosError`) foi copiado do Errômetro: módulos não importam um do outro. Candidato a ir para `@erre/core/client` no template do hackathon.
- O link de navegação para a lista vem do menu do manifesto, abaixo da seção do hub: a seção não precisa (nem deve) repetir o botão.
