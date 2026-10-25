# Perguntas em aberto

Formato: ID, sprint que bloqueia, contexto, opções, recomendação. Quando respondida, registre a resposta e a data, e crie uma decisão em `DECISOES.md` se for o caso.

| ID | Bloqueia | Status |
|---|---|---|
| P-001 | Sprint 7 | aberta |
| P-002 | Sprint 7 | aberta |
| P-003 | Sprint 1 (classificação) | aberta |
| P-004 | Sprint 1 | aberta |
| P-005 | Sprint 7 | aberta |
| P-006 | Sprint 6 | aberta |
| P-007 | Sprint 9 | aberta |
| P-008 | Sprint 18 | aberta |
| P-009 | Sprint 6 (seed) | aberta |
| P-010 | Sprint 19 | aberta |
| P-011 | Sprint 3 | aberta |

---

### P-001 — Entrar num grupo cria membership na comunidade?
**Contexto:** hoje as pessoas entram em grupos por convite. Na nova estrutura, um grupo está dentro de uma comunidade.
- **A. Sim, automaticamente como `membro` quando aprovado no grupo.** Prós: mantém o fluxo atual de convite. Contras: a comunidade não aprova separadamente.
- **B. Exige entrar na comunidade antes.** Prós: controle da comunidade. Contras: um passo a mais; muda o fluxo atual.
**Recomendação:** A.

### P-002 — Papéis de grupo
**Contexto:** no legado, só o criador administra o grupo (`isGroupCreator`).
- **A. Modelar `role` (`admin`/`membro`) na membership do grupo; o criador vira `admin`; promover outras pessoas fica para depois da migração.** Prós: paridade sem fechar portas.
- **B. Manter "criador = admin" sem coluna de papel.** Contras: retrabalho quando houver mais de um admin.
**Recomendação:** A. E admins/owners da comunidade também têm poder de admin em todos os grupos dela.

### P-003 — Grupo demo
**Contexto:** o legado tem um grupo virtual `demo`, sem banco e sem login, usado na landing.
- **A. Descartar.** **B. Recriar como tela estática de demonstração.** **C. Portar como está.**
**Recomendação:** A, a menos que a landing dependa dele para converter visitantes.

### P-004 — Congelamento do legado
**Contexto:** o legado continua recebendo funcionalidades; a paridade vira alvo móvel.
- **A. Congelar funcionalidades no legado (só correções) a partir do Sprint 1.**
- **B. Não congelar; o Sprint 19 faz o diff desde `7c5c5bf` e traz o que faltar.**
**Recomendação:** A.

### P-005 — Quem cria grupos?
**Contexto:** no legado, qualquer usuário logado cria grupo pelo assistente.
- **A. Permissão `core.grupos.criar` dada a `membro` por padrão (paridade).** **B. Só admin da comunidade.**
**Recomendação:** A.

### P-006 — Quem cria comunidades?
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
