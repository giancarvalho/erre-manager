# Sprint 1 — Inventário e checklist de paridade

**O que foi feito.** Leitura do legado em `7c5c5bf` e cinco documentos: [`INVENTARIO.md`](../INVENTARIO.md), [`REGRAS.md`](../REGRAS.md) (55 regras com trecho literal e `arquivo:linha`), [`PARIDADE.md`](../PARIDADE.md) (58 itens; checado por script que cobre as 16 páginas, 19 route handlers e 45 server actions), [`MAPEAMENTO-DADOS.md`](../MAPEAMENTO-DADOS.md) (25 tabelas) e perguntas novas.

**Testes do legado (sem `.env` real).** Unitários: 106 arquivos, 1.096 testes, todos verdes. E2E: o único teste falha no commit de referência (espera a tela de voto no hub, que mudou com a separação membro/votante); registrado como dívida, não como regressão nossa.

**Descobertas que mudam o plano.**
- O caminho de voto com `VOTER_TAG_SECRET` só existe para o grupo demo (R-ANON-08). Descartar o demo (P-003) elimina esse segredo, a tela "Resultados reservados" e um caminho de voto inteiro.
- A cascata "aprovar a entrada aprova a votação, se houver vaga" do legado (R-MEM-05) é exatamente o "um pedido só" de D-023.
- Corrigido no PLANO (Sprint 7): rejeitado ou removido **pode** pedir de novo explicitamente (R-MEM-02); eu tinha escrito o contrário.
- O lembrete de fechamento vai para todos os membros, não só votantes (R-NOT-01).

**Decidido.** D-029 (execução contínua, branch único, gates viram revisão assíncrona).

**Pendente / perguntas.** P-003 (demo, com a evidência acima), P-014 (link de evento dá participação sem aprovação?), P-015 (entrar digitando o nome da comunidade). Nenhuma bloqueia as sprints 2 a 6.

**Riscos novos.** Ids de usuário dentro do JSON dos snapshots exigem tabela de correspondência no ETL. Rótulo/âncora de rodada já causou perda de votos no legado (R-CAL-05, R-RES-03): os testes portados precisam cobrir fechamento antecipado e mudança de cadência.

**Contrato `[contrato]`.** Nada novo nesta sprint.
