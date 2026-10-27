# Perguntas em aberto

Formato: ID, sprint que bloqueia, contexto, opções, recomendação. Quando respondida, registre a resposta e a data, e crie uma decisão em `DECISOES.md` se for o caso.

| ID | Bloqueia | Status |
|---|---|---|
| P-001 | — | sem efeito (D-026: não há grupos) |
| P-002 | — | respondida (D-023) |
| P-003 | Sprint 18 | aberta |
| P-004 | Sprint 1 | respondida (D-021) |
| P-005 | — | sem efeito (D-026: não há grupos) |
| P-006 | Sprint 6 | respondida (D-022) |
| P-007 | Sprint 9 | decidida provisoriamente (A), confirmar |
| P-008 | Sprint 18 | aberta |
| P-009 | Sprint 6 (seed) | aberta |
| P-010 | Sprint 19 | aberta |
| P-011 | Sprint 3 | aberta |
| P-012 | — | respondida (D-027) |
| P-013 | — | respondida (D-028) |
| P-014 | Sprint 16 | aberta |
| P-015 | Sprint 7 | aberta |
| P-016 | Sprint 14 | aberta |
| P-017 | Sprint 15 | aberta (paridade com o legado até a resposta) |
| P-018 | Sprint 15 | decidida provisoriamente (A), confirmar |
| P-019 | Sprint 18 | aberta |
| P-020 | plano de dados (D-016) | aberta |
| P-021 | plano de dados (D-016) | aberta |
| P-022 | — (módulo `avisos`, Sprint 20) | decidida provisoriamente (A), confirmar |

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
**Situação (Sprint 18):** implementado A, provisório (D-049): a landing tem "Como funciona" estático no lugar de "Ver grupo demo". Nada do demo foi portado.
**Evidência do Sprint 1:** o demo é o único que usa o caminho de voto HMAC com `VOTER_TAG_SECRET` (R-ANON-08) e a tela "Resultados reservados" (R-RES-06). Descartá-lo elimina esse segredo e esses dois caminhos de código. A landing pode trocar o "Ver grupo demo" por um "Ver como funciona" estático.

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
**Situação (Sprint 9):** implementado A (`PUSH_ENABLED`), seguindo a preferência do humano por desligar pelo deploy (D-007). Trocar para B é uma tabela e uma rota; nenhum outro código muda.

### P-008 — Imagens de compartilhamento (OG) e ícones dinâmicos
**Contexto:** o legado gera imagens OG (`/api/og`) e ícones PWA (`/api/pwa-icons/[size]`) dinamicamente. O export web do Expo é estático.
- **A. Ícones estáticos gerados no build; OG gerado pela API (satori ou similar).** **B. Ícones e OG estáticos.**
**Recomendação:** A para ícones estáticos; decidir OG conforme a importância dos links compartilhados.
**Situação (Sprint 18):** ícones estáticos e uma imagem OG estática da marca, gerados uma vez (`pnpm gen:pwa`) e versionados (D-049). Sem OG dinâmico por comunidade ou resultado; se os links de resultado no WhatsApp precisarem de prévia própria, a API gera depois (opção A completa).

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

### P-014 — Abrir o link de um evento torna a pessoa participante sem aprovação?
**Contexto:** no legado, quem abre o link de um evento vira participante na hora, inclusive quem não é membro aprovado (só cria um pedido pendente de entrada). Quem foi rejeitado ou removido fica bloqueado (R-EVT-07). Participante pode votar e recebe votos.
- **A. Manter:** link de evento = participação imediata, mais um pedido pendente de entrada na comunidade. Prós: paridade; eventos abertos a convidados (ex.: festa). Contras: alguém de fora vota e recebe votos sem aprovação.
- **B. Só membros aprovados participam;** quem não é membro faz o pedido de entrada com a intenção "participar do evento" (D-023) e entra quando aprovado. Contras: muda o comportamento atual.
**Recomendação:** B, coerente com "tudo é da comunidade" (D-026), a menos que eventos com convidados de fora sejam um uso real.
**Situação (Sprint 16):** implementado B, provisório (D-047): membro aprovado se inscreve (`POST /eventos/:id/inscricao`) enquanto o evento está ao vivo; quem não é membro entra pelo convite com a intenção `eventos.participar`, que inscreve no evento ao vivo quando o pedido é aprovado. Se a resposta for A, muda só a inscrição (aceitar quem tem pedido pendente) e o alvo da cédula.

### P-015 — Entrar digitando o nome da comunidade
**Contexto:** no legado, o nome do grupo (slug) é o código de convite, e "Entrar com o nome do grupo" deixa qualquer pessoa que saiba o nome pedir entrada (R-MEM-07). O plano novo usa link de convite com código revogável.
- **A. Só link/código de convite revogável.** Prós: dá para revogar um link vazado. Contras: some o "digitar o nome".
- **B. Os dois:** código revogável e também pedir entrada digitando o slug da comunidade. Contras: o slug não é revogável; como todo pedido fica `pending`, o risco é só de spam de pedidos.
**Recomendação:** B, mantendo a paridade e a aprovação obrigatória.
**Situação (Sprint 7):** implementado só o link com código revogável, que vale para A e B. Se a resposta for B, entra uma rota de pedido pelo nome; o resto do fluxo (pedido `pending`, aprovação) já existe.

### P-016 — Biblioteca de ícones
**Contexto:** o DESIGN.md fala em ícones (acordeão, banner, botão só com ícone), mas não escolhe uma biblioteca. No Sprint 10 os ícones são glifos de texto (✕, ›, ⌄, ⋯), que funcionam nas três plataformas sem dependência.
- **A. Continuar com glifos e emojis.** Prós: zero dependência, combina com o emoji como protagonista. Contras: pouca variedade e desenho menos preciso.
- **B. `lucide-react-native` + `react-native-svg`.** Prós: conjunto grande e consistente (o mesmo estilo do shadcn/lucide que o legado usa na web). Contras: duas dependências nativas a validar nas três plataformas.
- **C. `expo-symbols`.** Contras: SF Symbols só existe no iOS.
**Recomendação:** A até o Errômetro (Sprints 14–15); se faltar ícone, B.

### P-017 — "Liberar agora" no mesmo dia do fechamento gera rodada com o mesmo rótulo
**Contexto:** o rótulo da rodada é o dia (`YYYY-MM-DD`) do próximo fechamento (R-CAL-05). Dois casos do legado em que a rodada nova fica com o mesmo rótulo da que acabou de fechar: (1) cadência semanal de segunda ao meio-dia e "liberar agora" numa segunda de manhã: o próximo fechamento é a mesma segunda ao meio-dia; (2) cadência manual liberada duas vezes no mesmo dia (o rótulo é o dia da liberação + 100 anos). Aí a rodada "nova" usa a mesma chave, a mesma emissão e os mesmos votos: quem já votou continua votando na rodada "liberada", e o fechamento seguinte reescreve o resultado publicado (sem novo push).
- **A. Manter como no legado.** Prós: paridade, nada muda no rótulo dos dados migrados. Contras: o resultado liberado pode mudar depois; confuso.
- **B. Na liberação manual, se o próximo rótulo for igual ao fechado, pular para o fechamento seguinte da cadência** (no caso 1, a segunda da semana que vem; no 2, o dia seguinte). Prós: cada rodada tem rótulo e chave próprios. Contras: muda R-CAL-03 nesse caso de borda.
- **C. Trocar o rótulo por data e hora.** Contras: mexe no formato de `period` e no mapeamento dos dados.
**Recomendação:** B.
**Situação (Sprint 13):** implementado A (paridade); um teste em `modules/errometro/tests/integration/closing.test.ts` documenta o caso 2.

### P-018 — Push do Errômetro em comunidade que não usa o Errômetro
**Contexto:** o Errômetro é ligado para o app inteiro (D-007), então toda comunidade tem rodada. No legado todo grupo era do Errômetro e todos os membros recebiam "resultado saiu" e "faltam 3h", mesmo sem voto. Numa comunidade sem nenhum votante aprovado, esses pushes seriam ruído semanal.
- **A. Sem votantes aprovados, a rodada fecha mas não manda push.** Prós: nada de ruído em comunidade que não usa o Errômetro. Contras: diferença pequena em relação ao legado (onde sempre havia votantes).
- **B. Mandar sempre, como no legado.**
- **C. Ligar o Errômetro por comunidade.** Contras: muda D-007.
**Recomendação:** A.
**Situação (Sprint 13):** implementado A, provisório (D-044).

### P-019 — Nome do app: "Erre" ou "Errômetro"?
**Contexto:** o `app.json` (Sprint 2) chama o app de "Erre"; o DESIGN.md §2 diz "Nome: Errômetro", a marca é o 🦄 e a landing do legado diz "Errômetro". No Sprint 18 a web (título, PWA, imagem de compartilhamento, landing) usa "Errômetro"; o app nativo continua "Erre".
- **A. "Errômetro" em tudo** (trocar o `app.json`). Prós: uma marca só, a que a comunidade conhece. Contras: o app é de gestão de comunidade e o Errômetro vira um dos módulos.
- **B. "Erre" em tudo**, com o Errômetro como módulo. Contras: muda a marca conhecida; landing e PWA mudam.
- **C. Como está:** "Errômetro" na web, "Erre" na loja. Contras: duas marcas.
**Recomendação:** A para a migração (é o nome que os 200 usuários conhecem), revendo quando houver mais módulos.

### P-020 — Contas do legado só com usuário + chave
**Contexto:** no legado, quem se cadastrou com usuário + chave não tem e-mail nem `google_id`. O app novo só tem login Google (D-017) e exige e-mail. Fato testado: um usuário criado pelo ETL só com e-mail (mesmo id do legado, perfil e histórico) é vinculado automaticamente no primeiro login Google com esse e-mail.
- **A. Coletar o e-mail Google de cada pessoa antes da virada** (formulário ou mensagem no grupo), e o ETL cria a conta com esse e-mail. Prós: nada se perde (troféus, votos recebidos, comentários, participação); nenhum código novo. Contras: trabalho manual. Um e-mail errado entrega a conta a outra pessoa, então o e-mail tem de vir da própria pessoa.
- **B. Código de resgate no app novo:** quem opera gera um código por conta antiga, e a pessoa, já logada com o Google, digita o código para assumir o perfil antigo. Prós: sem coleta de e-mail. Contras: tela e rota novas no core (fusão de perfil), mais um sprint.
- **C. Não migrar essas contas:** a pessoa começa do zero. O histórico fica com um id sem dono, como numa exclusão. Contras: perde troféus e histórico.
**Recomendação:** A, com C para quem não responder até a virada (a conta pode ser recuperada depois rodando o ETL só para ela). Antes, contar quantas são (consulta em `MAPEAMENTO-DADOS.md`).

### P-021 — Mesma pessoa com duas contas no legado
**Contexto:** o legado não liga as duas formas de login: alguém que entrou por usuário + chave e depois pelo Google tem duas contas, com memberships, troféus e comentários separados. Os votos que a pessoa deu são anônimos e não pertencem a nenhuma das duas.
- **A. Migrar as duas como estão** e só vincular o Google à conta Google. Prós: simples e sem risco. Contras: a conta antiga fica órfã ou depende de P-020.
- **B. Fundir numa só no ETL** (memberships, participações, troféus, comentários e alvos de votos da conta antiga passam para a conta Google). Contras: precisa de uma lista confirmada pelas pessoas; numa mesma rodada as duas contas podem ter sido alvo, e a fusão soma votos que o resultado fechado não somou.
**Recomendação:** A, levantando os casos numa cópia do banco (mesmo `display_username` em contas de tipos diferentes) para o humano decidir um a um.

### P-022 — Texto que a pessoa escreveu para a comunidade: apagar na exclusão?
**Contexto:** na exclusão LGPD, o Errômetro apaga os comentários da pessoa, e Eventos mantém os eventos que ela criou (sem autor). No módulo `avisos` (Sprint 20), um aviso é texto livre da pessoa, mas escrito para a comunidade inteira. O `docs/lgpd.md` não diz qual regra vale para conteúdo assim.
- **A. Apagar** (como os comentários). Prós: texto livre é dado pessoal; regra simples para os módulos. Contras: a comunidade perde o aviso.
- **B. Manter sem autor** (como os eventos). Prós: o mural não perde história. Contras: o texto pode identificar a pessoa.
**Recomendação:** A como regra geral para texto livre, com B só para estruturas da comunidade (eventos, configurações). Implementado A no `avisos`, provisório.

