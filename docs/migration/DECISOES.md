# Registro de decisões

Formato: ID, data, decisão, motivo, consequências. Decisões só mudam com aprovação do humano. Ao mudar, não apague: marque como "Substituída por D-NNN".

Entradas marcadas `[contrato]` alimentam o template de módulo do hackathon (Sprint 20).

---

### D-001 — Expo + React Native + RN Web (mantido)
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** o app é reescrito em Expo + Expo Router, com React Native Web para a PWA.
**Motivo:** presença nas lojas com app nativo de verdade; o shell Capacitor do legado só carrega o site e corre risco de rejeição na App Store (regra 4.2, funcionalidade mínima).
**Consequências:** toda a interface é reescrita (no legado: 64 arquivos `"use client"`, 96 `.tsx` com Tailwind, 45 arquivos com APIs só-web). O Sprint 2 valida o caminho com as telas mais difíceis antes de investir.

### D-002 — Repositório novo
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** a reescrita acontece em `giancarvalho/erre-manager`. O legado (`giancarvalho/queridometro`) fica em produção e serve só de referência, no commit `7c5c5bf`.
**Motivo:** o legado deploya produção a cada push na `main`, sem testes no CI, e tem desenvolvimento ativo; um branch longo de reestruturação divergiria e poria a produção em risco. Quase nada do legado é reaproveitado por cópia direta.
**Consequências:** lógica de domínio pura e testes são copiados com referência ao commit de origem. Se o legado continuar recebendo funcionalidades, o Sprint 19 faz o diff desde `7c5c5bf` e atualiza `PARIDADE.md` (ver P-004).

### D-003 — Nome do módulo: Errômetro
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** o módulo se chama Errômetro (`id: errometro`, tabelas `errometro_*`). "Queridômetro" e "Karmômetro" são nomes antigos do mesmo produto.

### D-004 — Escopo de paridade
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** entram na migração: Errômetro recorrente, Eventos, comentários nos resultados e troféus no perfil.
**Fora (backlog pós-migração):** mural/apresentações (`presentations`, `presentation_reactions`), bot de WhatsApp, estatísticas, cobrança, lista de banidos, Sign in with Apple, publicação nas lojas, migração de dados e virada (D-016).

### D-005 — Dois módulos: `errometro` e `eventos` `[contrato]`
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** Errômetro recorrente e Eventos são módulos separados. O que eles compartilham vai para pacotes: `@erre/anon-vote` (assinatura cega, agregação) e `@erre/emoji` (catálogo de emojis e troféus, grafemas, limites).
**Motivo:** no legado a dependência é unidirecional (eventos importam da votação recorrente; o contrário não acontece) e o commit #97 já tinha separado eventos como aplicação própria. Separar força o contrato a resolver pacotes compartilhados e extensão do perfil, que os módulos do hackathon também vão precisar.

### D-006 — Grupos são subgrupos de comunidade, no core `[contrato]`
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** `core_groups` e `core_group_memberships` ficam no core. Uma comunidade tem vários grupos. A membership de grupo tem fluxo `pending → approved | rejected`, `approved → removed`, e papel de grupo (`admin`, `membro`).
**Motivo:** o humano escolheu subgrupos. Como Errômetro e Eventos usam grupos e módulos não podem compartilhar tabelas, grupos precisam ser do core.
**Consequências:** a aprovação para votar no Errômetro (`votingStatus` do legado, limite de 50 votantes) vira tabela do módulo (`errometro_participants`). Participantes de evento ficam em `eventos_participants`. Módulos consultam grupos pela API pública do core (`ctx.groups`), nunca pelas tabelas.

### D-007 — Módulos ligados/desligados para o app inteiro, por variável de ambiente
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** não existe `community_modules`. A API lê `MODULES_ENABLED` (lista separada por vírgula). Desligar um módulo = mudar a variável e reiniciar a API.
**Motivo:** o humano não precisa de liga/desliga por comunidade agora e quer desligar fácil por deploy.
**Consequências:** ver ARQUITETURA §5.3. Liga/desliga por comunidade fica no backlog.

### D-008 — Montagem estática dos módulos na API
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** todos os módulos registrados são montados de forma estática; a flag é aplicada por middleware.
**Motivo:** montar sub-apps em tempo de execução quebra a inferência de tipos do Hono RPC.

### D-009 — Um cliente RPC por módulo
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** cada módulo exporta o tipo da sua sub-app (`ErrometroApi`) e o app cria `hc<ErrometroApi>(base + '/v1/errometro')`. O app só importa esses tipos com `import type`.
**Motivo:** um `AppType` único com todos os módulos deixa o TypeScript lento e acopla tudo.

### D-010 — Rotas anônimas sem sessão `[contrato]`
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** módulos podem declarar uma sub-app `anon`, montada em `/v1/<id>/anon` sem middleware de sessão, com contexto `{ community, tx }`. A comunidade é derivada no servidor a partir do recurso.
**Motivo:** no legado, a rota de envio de votos não lê a sessão de propósito (`legado:src/app/api/groups/[id]/vote/route.ts`); se ela souber quem é o usuário, o anonimato acaba. O contrato original entregava `user` em todo contexto.

### D-011 — Assinatura cega no app nativo: implementação JS pura do cliente
**Data:** 2026-10-25 · **Status:** aceita (validação no Sprint 2)
**Decisão:** o servidor mantém `@cloudflare/blindrsa-ts`. O cliente usa uma implementação JS pura das etapas do cliente da RFC 9474 (preparar, cegar, finalizar) com `@noble/hashes`, `BigInt` do Hermes e `expo-crypto`, testada contra os vetores da RFC e contra a biblioteca do servidor.
**Motivo:** o Hermes não tem WebCrypto `subtle`. `react-native-quick-crypto` exigiria dev build e não tem cobertura de RSA-PSS confirmada. Trocar de esquema mudaria o servidor sem necessidade.
**Consequências:** votação no app nativo não é publicada sem essa peça. Na web, o navegador tem `crypto.subtle`, mas usar a mesma implementação nas três plataformas simplifica os testes. Se o Sprint 2 provar que não funciona, a decisão volta ao humano.

### D-012 — `notify()` com dois transportes `[contrato]`
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** Web Push (VAPID, reaproveitando o service worker do legado) para a PWA e Expo Push para Android/iOS, por trás de um único `notify()`. Tipos de notificação são declarados no manifesto; preferências são genéricas por tipo.
**Motivo:** só Expo Push faria quem usa a PWA perder as notificações que tem hoje. FCM para tudo ou OneSignal não trazem ganho que justifique a dependência extra (e OneSignal é um terceiro processando dados pessoais).

### D-013 — Jobs declarados no manifesto, executados por comunidade `[contrato]`
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** módulos declaram `jobs` (id, cron, função). O runner, dentro da API, usa advisory lock, lista comunidades com o papel `erre_jobs` e executa cada job uma vez por comunidade em transação de tenant comum.
**Motivo:** o legado tem 4 jobs a cada 15 minutos (`legado:src/instrumentation.ts`) e o contrato original não previa jobs. Executar por comunidade evita `BYPASSRLS`.

### D-014 — Comunidade da requisição vem do header, validada
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** `X-Community-Id` em toda requisição autenticada, validado contra a membership. Nada de "comunidade ativa" na sessão. Com uma comunidade só, o app escolhe automaticamente.
**Motivo:** guardar a comunidade ativa na sessão quebra com várias abas e mistura estado de UI com autenticação.

### D-015 — Tabelas filhas com `community_id` próprio e FK composta
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** toda tabela de tenant tem `community_id`, inclusive filhas; FKs entre tabelas de tenant são compostas `(community_id, parent_id)`.
**Motivo:** impede, no banco, uma referência entre comunidades diferentes.

### D-016 — Migração de dados e virada fora deste plano
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** ETL do banco legado para o novo e plano de virada são feitos em documento próprio, depois do Sprint 19. Não influenciam a arquitetura.
**Consequências:** cada sprint que cria tabelas atualiza `docs/migration/MAPEAMENTO-DADOS.md` (tabela antiga → tabela nova, colunas, transformações, dúvidas), para o ETL futuro ser barato.

### D-017 — Login só com Google via Better Auth
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** Better Auth com provedor Google, sessões no banco, plugin Expo. O login por usuário + segredo do legado não é portado.
**Consequências:** como ligar usuários antigos às contas novas (provavelmente por `google_id`/`sub`) e o que fazer com quem só usa usuário + segredo fica para o plano de dados (D-016).

### D-018 — Seções de perfil como ponto de extensão `[contrato]`
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** módulos contribuem com seções no perfil (`profileSections`): a parte de API carrega os dados, a parte de UI renderiza. O core monta a tela de perfil com as seções dos módulos habilitados.
**Motivo:** no legado o perfil soma troféus do Errômetro e de Eventos; sem esse ponto de extensão, o perfil teria que importar internals dos dois módulos.

### D-019 — Manifesto dividido em três arquivos `[contrato]`
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** `manifest.ts` (metadados puros), `api/index.ts` (`defineModuleApi`) e `ui/index.ts` (`defineModuleUi`).
**Motivo:** o manifesto do guia original incluía `api: queridometroApp`; como o app importa o manifesto para montar o menu, isso levaria código de servidor para o bundle do app.

### D-020 — Fuso horário global na primeira versão
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** paridade com o legado: `VOTING_TIMEZONE` global (default `America/Sao_Paulo`). Fuso por comunidade fica no backlog.

### D-021 — Legado parado no commit de referência
**Data:** 2026-10-25 · **Status:** aceita (resposta a P-004)
**Decisão:** o legado não está recebendo mudanças; `7c5c5bf` é a referência de paridade. O Sprint 19 só confere se isso continua verdade.

### D-022 — Qualquer usuário com conta cria comunidades
**Data:** 2026-10-25 · **Status:** aceita (resposta a P-006)
**Decisão:** criar comunidade é uma funcionalidade do app, aberta a qualquer usuário logado. Quem cria vira `owner`.
**Consequências:** `POST /v1/communities` é a única rota autenticada sem comunidade no contexto; precisa de rate limit e de teste próprio de isolamento (Sprint 6).

### D-023 — Entrada em comunidades e grupos por link de convite, como no Errômetro
**Data:** 2026-10-25 · **Status:** aceita (resposta a P-001, P-002, P-005); detalhes em confirmação
**Decisão:** comunidades e grupos têm link de convite. Quem abre o link pede entrada e fica `pending` até aprovação (`owner`/`admin` na comunidade; admin do grupo no grupo), com os mesmos estados do fluxo de grupos do legado. Qualquer membro aprovado da comunidade cria grupos, como qualquer usuário cria grupo no Errômetro hoje.
**Interpretações aguardando confirmação:**
- P-001: quem abre o link de um grupo sem ser da comunidade faz um único pedido; aprovado no grupo, vira `membro` da comunidade (sem uma segunda aprovação).
- P-002: a membership de grupo tem papel (`admin`/`membro`); quem cria o grupo é `admin`; promover outras pessoas fica para depois; `owner`/`admin` da comunidade têm poder de admin em todos os grupos.

### D-024 — Referência de design obrigatória
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** `docs/design/DESIGN.md` é a referência de design de todo o app e de todos os módulos. Preserva a identidade do legado (escuro, zinc, ciano, dourado, emoji como protagonista) e corrige problemas medidos: dois estilos de botão principal em vez de quatro, contraste AA nos textos e controles, tamanho mínimo de fonte 12, raio único de 12 em controles.
**Motivo:** design é ponto importante para o humano, e módulos de várias pessoas só parecem um app se partirem dos mesmos tokens e componentes.
**Consequências:** regra 12 do `AGENTS.md`, item na definição de pronto, `packages/ui` implementa exatamente o DESIGN.md (Sprint 10), lint contra cores literais.
