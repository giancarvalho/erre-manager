# Perguntas em aberto

Formato: ID, sprint que bloqueia, contexto, opções, recomendação. Quando respondida, registre a resposta e a data, e crie uma decisão em `DECISOES.md` se for o caso.

| ID | Bloqueia | Status |
|---|---|---|
| P-001 | — | sem efeito (D-026: não há grupos) |
| P-002 | — | respondida (D-023) |
| P-003 | Sprint 1 (classificação) | aberta |
| P-004 | Sprint 1 | respondida (D-021) |
| P-005 | — | sem efeito (D-026: não há grupos) |
| P-006 | Sprint 6 | respondida (D-022) |
| P-007 | Sprint 9 | aberta |
| P-008 | Sprint 18 | aberta |
| P-009 | Sprint 6 (seed) | aberta |
| P-010 | Sprint 19 | aberta |
| P-011 | Sprint 3 | aberta |
| P-012 | — | respondida (D-027) |
| P-013 | — | respondida (D-028) |

---

### P-001 — Entrar num grupo cria membership na comunidade?
**Atualização (2026-10-25):** sem efeito. Não há grupos na v1 (D-026); a entrada é só na comunidade, com um pedido só (D-023).
**Resposta (2026-10-25):** "assim como o Errômetro, através de um link de convite". Interpretação registrada em D-023: um único pedido pelo link do grupo; aprovado no grupo, vira `membro` da comunidade. **Confirmar.**

**Contexto:** hoje as pessoas entram em grupos por convite. Na nova estrutura, um grupo está dentro de uma comunidade.
- **A. Sim, automaticamente como `membro` quando aprovado no grupo.** Prós: mantém o fluxo atual de convite. Contras: a comunidade não aprova separadamente.
- **B. Exige entrar na comunidade antes.** Prós: controle da comunidade. Contras: um passo a mais; muda o fluxo atual.
**Recomendação:** A.

### P-002 — Papéis de grupo
**Confirmação (2026-10-25):** `owner`/`admin` da comunidade têm poder sobre tudo dela. Sem grupos (D-026), não há papel de grupo.
**Resposta (2026-10-25):** respondida junto com P-001 ("link de convite"), sem tratar de papéis. Assumida a recomendação A até confirmação (D-023).

**Contexto:** no legado, só o criador administra o grupo (`isGroupCreator`).
- **A. Modelar `role` (`admin`/`membro`) na membership do grupo; o criador vira `admin`; promover outras pessoas fica para depois da migração.** Prós: paridade sem fechar portas.
- **B. Manter "criador = admin" sem coluna de papel.** Contras: retrabalho quando houver mais de um admin.
**Recomendação:** A. E admins/owners da comunidade também têm poder de admin em todos os grupos dela.

### P-003 — Grupo demo
**Contexto:** o legado tem um grupo virtual `demo`, sem banco e sem login, usado na landing.
- **A. Descartar.** **B. Recriar como tela estática de demonstração.** **C. Portar como está.**
**Recomendação:** A, a menos que a landing dependa dele para converter visitantes.

### P-004 — Congelamento do legado
**Resposta (2026-10-25):** o legado não está sendo mexido (D-021).

**Contexto:** o legado continua recebendo funcionalidades; a paridade vira alvo móvel.
- **A. Congelar funcionalidades no legado (só correções) a partir do Sprint 1.**
- **B. Não congelar; o Sprint 19 faz o diff desde `7c5c5bf` e traz o que faltar.**
**Recomendação:** A.

### P-005 — Quem cria grupos?
**Atualização (2026-10-25):** sem efeito (D-026).
**Resposta (2026-10-25):** como no Errômetro: qualquer membro (D-023).

**Contexto:** no legado, qualquer usuário logado cria grupo pelo assistente.
- **A. Permissão `core.grupos.criar` dada a `membro` por padrão (paridade).** **B. Só admin da comunidade.**
**Recomendação:** A.

### P-006 — Quem cria comunidades?
**Resposta (2026-10-25):** qualquer pessoa com conta (D-022).

- **A. Só administradores da plataforma, por script/CLI, na v1.** **B. Qualquer usuário pelo app.**
**Recomendação:** A. Criar comunidade pelo app é funcionalidade nova, não paridade.

### P-007 — Kill switch global de push
**Contexto:** o legado tem `push_notifications_config` e `POST /api/admin/push-notifications/toggle`.
- **A. Virar variável de ambiente `PUSH_ENABLED`.** **B. Manter no banco com rota administrativa.**
**Recomendação:** A, coerente com D-007.

### P-008 — Imagens de compartilhamento (OG) e ícones dinâmicos
**Contexto:** o legado gera imagens OG (`/api/og`) e ícones PWA (`/api/pwa-icons/[size]`) dinamicamente. O export web do Expo é estático.
- **A. Ícones estáticos gerados no build; OG gerado pela API (satori ou similar).** **B. Ícones e OG estáticos.**
**Recomendação:** A para ícones estáticos; decidir OG conforme a importância dos links compartilhados.

### P-009 — Comunidade inicial
**Contexto:** necessário para seeds e, depois, para o ETL. Nome, slug e quem é `owner`.

### P-010 — Hospedagem
**Contexto:** o legado roda em Docker num servidor via SSH. Onde ficam a API e a web exportada (mesmo servidor? CDN?) e se haverá staging.

### P-011 — Branch `main` do repositório novo
**Contexto:** o repositório está vazio. O primeiro PR precisa de uma `main` como base, e a proteção de branch (CI obrigatório, revisão) é configurada por quem administra o repositório.
**Recomendação:** criar `main` a partir do merge deste plano e proteger com CI obrigatório a partir do Sprint 3.

### P-012 — Limites por comunidade
**Resposta (2026-10-25):** manter 50 votantes (D-027). Limite de membros mantido em 300 por paridade.
**Contexto:** no legado, os limites eram por grupo: até 300 membros e até 50 votantes no Errômetro (os demais ficam na fila). Agora o Errômetro é um por comunidade (D-026), então uma comunidade grande teria só 50 votantes.
- **A. Manter 50 votantes por comunidade.** Prós: votar em mais de 50 pessoas por rodada é cansativo, e a tela foi pensada para isso. Contras: numa comunidade de 300, a maioria fica de fora.
- **B. Aumentar o limite** (ex.: 100). Contras: rodada longa; a grade de votação precisa de busca e filtro.
- **C. Sem limite de votantes; limitar quem cada pessoa vota** (ex.: votar só em quem ela escolhe). Contras: muda a regra do jogo; vira uma decisão de produto.
Também: manter ou não um limite de membros por comunidade (no legado, 300 por grupo).
**Recomendação:** A para a migração (paridade) e reavaliar com uso real.

### P-013 — Grupos do legado viram quais comunidades?
**Resposta (2026-10-25):** cada grupo vira uma comunidade (D-028).
**Contexto:** o legado tem vários grupos (os scripts citam, por exemplo, `r-uberlandia` e `r-esportes`), cada um com seu próprio Errômetro, histórico de rodadas, emojis e eventos. Com um Errômetro por comunidade, dois grupos não podem virar a mesma comunidade sem fundir rodadas e históricos.
- **A. Cada grupo do legado vira uma comunidade.** Prós: nada se perde nem se mistura. Contras: quem estava em dois grupos fica em duas comunidades.
- **B. Fundir grupos numa comunidade** (ex.: "R"). Contras: históricos e configurações de Errômetro conflitantes; precisa escolher qual vale.
**Recomendação:** A. Não afeta a arquitetura, só o plano de dados (D-016). O Sprint 1 levanta quantos grupos existem e quem está em cada um.
