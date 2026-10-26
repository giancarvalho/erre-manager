# Sprint 16 — Eventos API

## O que foi feito

- Módulo `modules/eventos`: manifesto (permissões `eventos.ver`, `eventos.votar`, `eventos.criar`, `eventos.moderar`; notificação `eventos.resultado_pronto`; intenção `eventos.participar`), 8 tabelas `eventos_*` com FK composta para o evento, ligado na API (`MODULES`).
- Domínio portado: estados e validações de rascunho, calculadoras categórica e de escala (média exata, teto 1 por contagem, mínimo de 3 votos), vencedor de troféu, limites, roster, mensagem de compartilhamento, troféus do perfil; a cédula anônima virou função pura.
- Rotas: listar, criar, ver, editar rascunho, emojis, publicar, abrir votação, encerrar, excluir (suave), inscrição, chave, token, resultados. Rotas anônimas de voto e "meus votos".
- Jobs `eventos.abrir_agendados` e `eventos.fechar_agendados`; push de resultado aos participantes, uma vez.
- Seção de perfil `eventos.trofeus` (×N dos categóricos, vitórias de escala com evento e média).
- `MAPEAMENTO-DADOS.md` com as tabelas de evento.
- `@erre/db/testing`: o detector de drift ignora o espaço em `numeric(8, 2)`.

## Testes

- `eventos` (155): domínio portado do legado (calculadoras, vencedor, compartilhamento) e reescrito como função pura (rascunho, publicação, roster, cédula, troféus do perfil); integração com a API real: matriz de permissões, rascunho e bloqueio após publicar, um evento ao vivo (também no banco), transições fora de ordem, abrir e fechar antecipados, exclusão suave, isolamento entre comunidades, fim a fim categórico e de escala com troféus, inscrição, saída da comunidade, token único, cédula sem sessão e sem log identificável, token de outro evento ou comunidade, assinatura forjada, voto concorrente com o fechamento, jobs agendados, push, perfil e intenção de convite.
- `pnpm check` (35 tarefas) e e2e verdes.

## Decidido

- D-047 (`[contrato]`). P-014 implementada como B, provisório.

## Itens de `PARIDADE.md`

EVT-04, EVT-06, EVT-08, EVT-09 e EVT-11 concluídos; API de EVT-01 a EVT-03, EVT-05, EVT-07, EVT-10 e EVT-12 concluída (telas nos Sprints 17 e 18).

## Pendente

- Telas (Sprint 17). A tela de convites já mostra a intenção "Entrar e participar do evento em andamento", porque o módulo está ligado na API.
- Testes do legado com o fechamento em duas escritas (`close-voting-event.test.ts`, "gap between snapshot write and status flip") não foram portados: com uma transação só, o caso não existe.

## Riscos

- P-014: se a resposta for A (participação pelo link, sem aprovação), muda a inscrição e quem pode ser alvo; o resto fica.
- O push de resultado de evento é novo: a cópia ("Resultado de <evento> saiu! 📊" / "Veja quem levou cada troféu.") precisa de revisão humana.

## Contrato `[contrato]`

- A intenção de convite não tem parâmetro: `eventos.participar` só funciona porque há no máximo um evento ao vivo. Um módulo com vários itens abertos ao mesmo tempo (ex.: inscrição em uma de várias atividades) precisaria de `intent` com alvo (`{ id, ref }`).
- O "period" de `@erre/anon-vote` serve para eventos sem mudança (é o id do evento); o nome é de rodada. Renomear para `scope` no template do hackathon deixaria isso óbvio.
- Rota raiz do módulo: `/v1/<id>` sem barra no fim (Hono estrito). Os testes erraram isso primeiro; anotado no CONTRATO.
