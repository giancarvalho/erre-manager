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
**Data:** 2026-10-25 · **Status:** substituída por D-026
**Decisão:** `core_groups` e `core_group_memberships` ficam no core. Uma comunidade tem vários grupos. A membership de grupo tem fluxo `pending → approved | rejected`, `approved → removed`, e papel de grupo (`admin`, `membro`).
**Motivo:** o humano escolheu subgrupos. Como Errômetro e Eventos usam grupos e módulos não podem compartilhar tabelas, grupos precisam ser do core.
**Consequências:** a aprovação para votar no Errômetro (`votingStatus` do legado, limite de 50 votantes) vira tabela do módulo (`errometro_participants`). Participantes de evento ficam em `eventos_participants`. Módulos consultam grupos pela API pública do core (`ctx.groups`), nunca pelas tabelas.

### D-007 — Módulos ligados/desligados para o app inteiro, por variável de ambiente
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** não existe `community_modules`. A API lê `MODULES_ENABLED` (lista separada por vírgula). Desligar um módulo = mudar a variável e reiniciar a API.
**Motivo:** o humano não precisa de liga/desliga por comunidade agora e quer desligar fácil por deploy.
**Consequências:** ver ARQUITETURA §5.4. Liga/desliga por comunidade fica no backlog.

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
**Decisão:** módulos podem declarar uma sub-app `anon`, montada em `/v1/<id>/anon` sem middleware de sessão, com contexto `{ community, tx }`. A comunidade vem no caminho e é validada pela própria credencial anônima: a assinatura cega só confere com a chave do período daquela comunidade (revisto com D-026; ARQUITETURA §4.5).
**Motivo:** no legado, a rota de envio de votos não lê a sessão de propósito (`legado:src/app/api/groups/[id]/vote/route.ts`); se ela souber quem é o usuário, o anonimato acaba. O contrato original entregava `user` em todo contexto.

### D-011 — Assinatura cega no app nativo: implementação JS pura do cliente
**Data:** 2026-10-25 · **Status:** aceita e validada no Sprint 2 (`prototypes/anon-vote`: vetor RFC 9474 A.1, interoperabilidade com `@cloudflare/blindrsa-ts` e execução no Hermes)
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

### D-023 — Entrada na comunidade por link de convite, com um pedido só
**Data:** 2026-10-25 · **Status:** aceita (respostas a P-001, P-002, P-005; revista com D-026)
**Decisão:** a comunidade tem link de convite. Quem abre o link pede entrada e fica `pending` até `owner`/`admin` aprovar, com os mesmos estados do fluxo de entrada no grupo do legado (`pending → approved | rejected`, `approved → removed`). Um convite pode incluir uma intenção de um módulo (ex.: "Entrar e participar do Errômetro"): a pessoa faz **um pedido só** e uma aprovação vale para os dois (ARQUITETURA §5.2). `owner`/`admin` da comunidade administram tudo dela, inclusive o Errômetro (resposta a P-002).
**Consequências:** `joinIntents` + `onJoinApproved` entram no contrato de módulo `[contrato]`; se o módulo não puder concluir (limite cheio), a entrada vale e a participação vai para a fila do módulo.

### D-024 — Referência de design obrigatória
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** `docs/design/DESIGN.md` é a referência de design de todo o app e de todos os módulos. Preserva a identidade do legado (escuro como padrão, zinc, ciano, dourado, emoji como protagonista) e corrige problemas medidos: dois estilos de botão principal em vez de quatro, contraste AA nos textos e controles, tamanho mínimo de fonte 12, raio único de 12 em controles.
**Motivo:** design é ponto importante para o humano, e módulos de várias pessoas só parecem um app se partirem dos mesmos tokens e componentes.
**Consequências:** regra 12 do `AGENTS.md`, item na definição de pronto, `packages/ui` implementa exatamente o DESIGN.md (Sprint 10), lint contra cores literais.

### D-025 — Dois temas: escuro (padrão) e claro (diurno)
**Data:** 2026-10-25 · **Status:** aceita
**Decisão:** o app nasce com tema escuro, padrão para todos, e tema claro. A pessoa escolhe em Perfil → Aparência entre "Escuro", "Claro" e "Igual ao sistema". A escolha fica no dispositivo.
**Motivo:** pedido do humano. O escuro continua sendo a identidade; o claro atende leitura sob luz forte e preferência pessoal.
**Consequências:** todos os tokens de cor têm valor para os dois temas, com contraste AA conferido em cada um (DESIGN.md §3.2); o modo claro é desenho novo, sem referência no legado, validado no Sprint 2 e na galeria do Sprint 10; toda tela é verificada nos dois temas (definição de pronto, checklist §14); emojis, avatares, cor de evento e ícone do app não mudam com o tema.

### D-026 — Sem subgrupos na v1: tudo é da comunidade `[contrato]`
**Data:** 2026-10-25 · **Status:** aceita (substitui D-006)
**Decisão:** não há grupos no core nem nos módulos na v1. A comunidade é o único escopo compartilhado. O Errômetro é **um por comunidade**, com resultados visíveis para qualquer membro aprovado. Eventos são da comunidade, e qualquer membro se inscreve se quiser. Perfil, e no futuro apresentações e cadastro de membros, também são da comunidade.
**Motivo:** o app é gestão de comunidade; um membro participa de vários subgrupos (como os do WhatsApp), então o que é da pessoa ou da comunidade fica na comunidade. Nada no escopo atual precisa ser exclusivo de um subgrupo. No legado, o "grupo" já funcionava como uma comunidade: um espaço de membros com convite e aprovação, com o Errômetro (segunda aprovação, limite de votantes) e os eventos (inscrição livre) dentro dele; membros aprovados viam resultados sem votar (`legado:src/app/results/page.tsx:222`).
**Consequências:** sai a Sprint 7 de grupos (vira "Convites, entrada e membros da comunidade"); `can()` não tem escopo menor que a comunidade; o contexto do módulo traz `ctx.members` em vez de `ctx.groups`; a rota anônima recebe a comunidade no caminho, validada pela assinatura (ARQUITETURA §4.5). Subgrupos entram no core quando houver algo exclusivo de um subgrupo (provavelmente com o bot do WhatsApp: estatísticas de um subgrupo, avisos direcionados); entram como tabela nova e escopo opcional, sem refazer o que existe. Limites em D-027; grupos do legado em D-028.

### D-027 — Limites por comunidade: 50 votantes no Errômetro
**Data:** 2026-10-25 · **Status:** aceita (resposta a P-012)
**Decisão:** o Errômetro tem no máximo 50 votantes por comunidade; acima disso, o pedido de participação fica na fila (`pending`) até um moderador abrir vaga, como no legado. A comunidade aceita até 300 membros, o mesmo limite que o grupo tinha no legado (assumido por paridade; o humano pode revisar).
**Motivo:** paridade com o legado; votar em mais de 50 pessoas por rodada é cansativo e a tela foi pensada para isso. Reavaliar com uso real.

### D-028 — Cada grupo do legado vira uma comunidade
**Data:** 2026-10-25 · **Status:** aceita (resposta a P-013)
**Decisão:** no plano de dados (D-016), cada grupo do legado vira uma comunidade própria, com seu Errômetro, histórico de rodadas, emojis e eventos.
**Motivo:** nada se perde nem se mistura; com um Errômetro por comunidade (D-026), fundir grupos obrigaria a fundir históricos e configurações.
**Consequências:** quem estava em mais de um grupo passa a ter uma membership em cada comunidade correspondente; o app já lida com várias comunidades (seletor, D-014). Não afeta a arquitetura.

### D-029 — Execução contínua das sprints e branch único
**Data:** 2026-10-25 · **Status:** aceita (instrução do humano)
**Decisão:** o agente segue para a próxima sprint assim que a anterior termina com todos os checks verdes, sem esperar aprovação, a menos que precise de uma decisão muito importante que não possa ficar para depois. Os "gates humanos" do PLANO viram revisão assíncrona: o humano revisa os relatórios em `docs/migration/relatorios/` e as decisões, e pode pedir mudança a qualquer momento. Nesta execução, todo o trabalho vai para o branch designado da sessão (`claude/practical-darwin-wsd749`), um commit ou mais por sprint, em vez de um branch e um PR por sprint.
**Consequências:** o que exige o humano ou um dispositivo físico (teste em Android/iOS, conta Google Cloud, conta Apple, publicação) fica registrado como pendência no relatório da sprint, sem travar as seguintes.

### D-030 — Estilo com `StyleSheet` e tokens tipados, sem NativeWind
**Data:** 2026-10-25 · **Status:** aceita (Sprint 2)
**Decisão:** componentes estilizados com `StyleSheet` do React Native a partir dos tokens de `packages/ui` (DESIGN.md §13), com estilos criados a partir do tema ativo. Sem NativeWind, Uniwind ou Tailwind.
**Motivo:** a documentação do Expo SDK 58 diz que Tailwind padrão só funciona na web e aponta NativeWind/Uniwind como camada extra de compatibilidade; com React Native 0.88 e Reanimated 4, é risco e dependência a mais. O protótipo mostrou que `StyleSheet` + tokens cobre os dois temas, o brilho animado e as três plataformas (exports web, Android e iOS verdes). Para o hackathon, tokens tipados com autocompletar são mais simples que aprender as particularidades do NativeWind.
**Consequências:** mais verboso que classes utilitárias; o lint contra cores literais (Sprint 10) garante o uso dos tokens.

### D-031 — Better Auth: checagem de origem fixa e guarda própria do `callbackURL`
**Data:** 2026-10-25 · **Status:** aceita (Sprint 2)
**Decisão:** a configuração do Better Auth fixa `advanced.disableOriginCheck: false`, e a API valida `callbackURL`, `errorCallbackURL` e `newUserCallbackURL` contra a lista de origens confiáveis antes de repassar ao Better Auth.
**Motivo:** medido no spike (`prototypes/auth-spike`): (1) o Better Auth desliga sozinho a checagem de origem quando detecta ambiente de teste (`dist/context/create-context.mjs:211`, `isTest() ? true`), então os testes passariam com uma proteção diferente da de produção; (2) sem cookie na requisição (primeiro login num navegador), ele aceita qualquer `callbackURL`.
**Consequências:** testes do Sprint 5 cobrem callback externo, relativo ao protocolo (`//host`) e domínio parecido (`localhost:8081.evil.example`).

### D-032 — Versões base
**Data:** 2026-10-25 · **Status:** aceita (Sprint 2)
**Decisão:** Expo SDK 58 (React Native 0.88, React 19.3, Expo Router 58), Better Auth 1.7, Hono 4.13, Drizzle ORM 0.45, TypeScript **6.0** (não o 7: `typescript-eslint` aceita até `<6.1`), Node 22 LTS, pnpm 10.
**Motivo:** versões que o próprio Expo fixa para o SDK 58 e que funcionaram juntas no protótipo.

### D-033 — Navegação do app (proposta do protótipo)
**Data:** 2026-10-25 · **Status:** proposta (DESIGN.md §9.16); revisar com o humano quando houver telas reais
**Decisão:** pilha (stack) sem barra de abas na v1. Sem sessão: tela de entrada. Com sessão e sem comunidade: criar comunidade ou abrir convite. Com comunidade: o **hub da comunidade** é a tela inicial, com uma seção por módulo habilitado; o perfil abre pelo avatar no cabeçalho; o seletor de comunidade aparece no cabeçalho só para quem tem mais de uma.
**Motivo:** com dois módulos, uma barra de abas acrescenta pouco e ocupa espaço; a pilha com cabeçalho de voltar é o padrão do legado. Reavaliar com 4 ou mais módulos.

### D-034 — Ferramentas do monorepo
**Data:** 2026-10-25 · **Status:** aceita (Sprint 3)
**Decisão:**
- **Lint:** ESLint 9.39 (não 10), porque `eslint-plugin-react-hooks` ainda não declara suporte ao 10. Regras próprias em `packages/config/eslint`: `erre/boundaries` (ARQUITETURA §3) e `erre/no-identity-in-anon` (AGENTS.md, regra 9).
- **Testes unitários:** Vitest em pacotes e na API; `jest-expo` + Testing Library no app, porque o preset do SDK já resolve os mocks nativos e o Babel do Metro.
- **E2E:** Playwright contra o **export web estático** do app (o mesmo artefato que vai para produção), não contra o servidor de desenvolvimento.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` em todo lugar. O app estende `expo/tsconfig.base` (exigido pelo Metro e pelas rotas tipadas) e repete as flags estritas.
- **CI:** em push roda tudo; em PR roda só o afetado (`--filter=...[origin/<base>]`), e tudo quando muda arquivo compartilhado (lockfile, `turbo.json`, `tsconfig*`, workflows, `packages/{config,db,core}`, migrations). Postgres 16 como service container.
- **`packages/ui` mínimo já no Sprint 3:** tokens e `ThemeProvider` (copiados do protótipo), para o app nascer com tema escuro e claro (D-025). O Sprint 10 completa o pacote.
- `turbo.json` com `agentGuidance: false`: o Turborepo 2.11 escreve um bloco de instruções próprio no `AGENTS.md` quando detecta um agente; o arquivo de regras fica só com as regras do projeto.
**Motivo:** um conjunto mínimo e padrão de ferramentas, que funciona hoje com SDK 58 e TypeScript 6.

### D-035 — Migrations em SQL escrito à mão, RLS por função no banco, sem `drizzle-kit`
**Data:** 2026-10-25 · **Status:** aceita (Sprint 4); pede revisão humana (gate do Sprint 4, assíncrono pela D-029)
**Decisão:**
- Migrations são arquivos SQL `<dono>_<NNNN>_<desc>.sql` por dono, aplicados pelo runner de `@erre/db` (ordem `db` → `core` → módulos em ordem alfabética; tabela `erre_migrations` com checksum; uma transação por arquivo; lock consultivo; seção opcional `-- migrate:down` só para desenvolvimento). Migration aplicada e editada, ou numerada antes de uma já aplicada, faz o runner parar.
- O lado do banco de uma tabela de comunidade vem da função `erre_tenant_table(regclass)` (migration `db_0001`): valida `community_id uuid NOT NULL` com FK para `communities`, liga e **força** RLS, cria a policy `isolamento_comunidade`, o índice e o `UNIQUE (community_id, id)`. O lado do Drizzle vem de `createTenantTable()`.
- **Sem `drizzle-kit`.** Ele não gera `FORCE ROW LEVEL SECURITY` nem segue a nomenclatura por dono, e duas fontes de verdade (schema TS gerando SQL + SQL editado) confundem quem chega no hackathon. Em troca, `schemaDifferences()` (em `@erre/db/testing`) compara as tabelas Drizzle com o banco real (colunas, tipos, nulidade, índices nomeados) e roda nos testes.
- `GLOBAL_TABLES` em `@erre/db` é a allowlist das tabelas sem `community_id`.
**Motivo:** a garantia de isolamento fica no banco e num único lugar (a função), testável; o fluxo para um módulo novo é escrever um `CREATE TABLE` e uma linha.
**Consequências:** o desenvolvedor escreve o SQL e o schema Drizzle; o teste de drift pega divergência. Com RLS forçado, nem o dono das tabelas lê dados sem `app.community_id`: migrations de dados (Sprint 19) precisam definir a comunidade por transação. A policy falha já no planejamento da consulta quando a variável não existe, inclusive em tabela vazia.

### D-036 — Detalhes de auth e perfil
**Data:** 2026-10-25 · **Status:** aceita (Sprint 5)
**Decisão:**
- **Ids em uuid** (`generateId: 'uuid'`, default `gen_random_uuid()` no banco), para `app.user_id` poder ser comparado como uuid nas policies (Sprint 6).
- **Sessão deslizante de 400 dias**, renovada uma vez por dia de uso (R-MEM-09). Sem cache de sessão em cookie: revogar vale na hora. Sessões **não guardam IP nem user agent** (dado pessoal sem uso).
- **Google:** o app entra pelo navegador (plugin Expo), então o login com ID token cru fica **desligado** (`disableIdTokenSignIn`). No fluxo por código, o Better Auth não confere as claims do ID token que vem do endpoint de token do Google; conferimos emissor, audiência, expiração, `sub` e e-mail (`verifiedGoogleUserInfo`). A assinatura não é verificada nesse caminho porque o token chega direto do Google por TLS (OIDC Core §3.1.3.7).
- **Perfil criado na primeira leitura** (`GET /v1/me`), com o nome do Google ou a parte local do e-mail (regra do legado) e `name_confirmed_at` nulo até o onboarding. Um caminho só, sem depender de hook do Better Auth.
- **Rotas `/v1/auth/*` seguem o formato do Better Auth** (consumidas pelo cliente dele), exceção ao formato `{ code, message }`. Erros inesperados do Better Auth sobem para o handler da API (`onAPIError.throw`), que registra o erro **sem os parâmetros da consulta**: o `better-call` imprimia o erro inteiro no console, com e-mail e `state`.
- **Rate limit** do Better Auth por IP, em memória: 100/min no geral, 30/min no início do login e no callback (cabe um grupo entrando junto no mesmo Wi-Fi). Com mais de uma instância, ou atrás de proxy, o Sprint 19 configura armazenamento e o header de IP.
- **API empacotada num arquivo só** (esbuild com todas as dependências; só `pg-native` fica de fora): o deploy precisa só de `dist/` e Node.
- **Componentes antecipados do Sprint 10:** `Text`, `Screen`, `ScreenHeader`, `Button` (5 variantes, carregando, motivo do desabilitado), `TextField`, `Avatar`, `LoadingState`, `ErrorState`, e `tokens.ts` idêntico à §13 do DESIGN.md (mais `label`, corpo 14/500, previsto na §4). Movimento e háptico ficam para o Sprint 10.
- **Onboarding fora do grupo `(app)`**: a rota `/onboarding/nome` faz a própria checagem de sessão; `(app)/_layout` manda para ela enquanto o nome não foi confirmado.
**Motivo:** cada item fecha uma lacuna encontrada ao testar (ids, vazamento em log, confiança nas claims, IP) ou simplifica o caminho.

### D-037 — Contexto da comunidade, permissões e criação
**Data:** 2026-10-25 · **Status:** aceita (Sprint 6); pede revisão humana (gate do Sprint 6, assíncrono pela D-029)
**Decisão:**
- **Validação dentro da transação de tenant:** o middleware abre a transação da comunidade do header e a primeira consulta é a membership da própria pessoa. Sem `approved`, 403 e rollback antes de qualquer código da rota. Equivale a validar antes de abrir, com uma ida ao banco a menos.
- **Rollback também em status ≥ 400:** o Hono captura o erro da rota e devolve a resposta sem propagar a exceção; o middleware confere `c.error` e o status e desfaz a transação. Rotas devem lançar `AppError`, mas uma resposta de erro devolvida à mão também não grava nada.
- **"Minhas comunidades" com `withUserTx`:** `app.community_id` = uuid nulo e `app.user_id` = a pessoa. Policies permissivas se combinam por OU, mas a de isolamento ainda avaliaria `current_setting` e falharia sem a variável; o uuid nulo resolve sem afrouxar o fail closed.
- **Criar comunidade sem policy especial:** a API gera o id da nova comunidade e abre a transação de tenant **para esse id**; comunidade, membership `owner` e permissões padrão nascem nela, e qualquer escrita em outra comunidade bate no RLS. Limite: **5 comunidades por pessoa a cada 24 h** (429 `TOO_MANY_COMMUNITIES`).
- **Nome = código, como no legado** (R-MEM-07): letras minúsculas, números e hífens, 1–32, `demo` reservado. `slug` e `name` recebem o mesmo valor. Um nome de exibição livre fica para quando houver pedido.
- **Papéis:** `owner` não é atribuível pela rota de papéis (sem transferência de posse na v1); `admin` não muda o papel do `owner`; o `owner` não se rebaixa (422 `OWNER_REQUIRED`), porque a comunidade ficaria sem dono.
- **Permissões do core:** `core.membros.gerenciar` e `core.convites.gerenciar` (owner, admin), semeadas em `core_role_permissions` na criação. Quando os manifestos dos módulos chegarem (Sprint 8), o boot precisa semear permissões novas nas comunidades existentes (só inserir, nunca remover).
- **Comunidade escolhida no app:** `localStorage` na web e memória no nativo, até a biblioteca de armazenamento do Sprint 10.
**Motivo:** isolamento garantido pelo banco em todos os caminhos, inclusive o único sem contexto (criação), com regras do legado onde ele já decidia.

### D-038 — Convites, pedidos e ganchos de membership
**Data:** 2026-10-25 · **Status:** aceita (Sprint 7)
**Decisão:**
- **Código do convite = `base64url(community_id)` (22) + segredo (12, 72 bits):** a prévia (`GET /v1/invites/:code`, sem sessão) e o pedido abrem a transação da comunidade do código e conferem o segredo dentro dela. Nenhuma tabela global nem função que contorne o RLS; trocar o id da comunidade invalida o código. Vários links ativos por comunidade; desativar não afeta pedidos já feitos.
- **Transições do legado** (R-MEM-01/02): pedido sempre `pending`; `pending → approved | rejected`; `approved → removed`; quem foi rejeitado ou removido pede de novo explicitamente e volta a `pending` (papel `membro`); pedido repetido ou de quem já é membro não muda nada. Transição inválida: 409 `INVALID_TRANSITION`.
- **Limite de 300 aprovados** (R-MEM-03): aprovar acima disso dá 422 `COMMUNITY_FULL` e o pedido continua na fila.
- **`owner` não sai nem é removido** (R-MEM-06); a remoção por `admin` de outro `admin` é permitida (o legado não distinguia).
- **Ganchos para módulos** (`docs/CONTRATO.md`): `onJoinApproved` roda em savepoint (falha isolada, a pessoa entra); `onMemberLeft` roda na mesma transação e, se falhar, desfaz a mudança. Assim a participação no módulo acompanha a comunidade, como a votação no legado (R-MEM-05).
- **Lista de membros visível a todo membro aprovado** (nome, avatar, papel); pedidos pendentes só para `core.membros.gerenciar`; links só para `core.convites.gerenciar`.
- **P-015 continua aberta:** só o link foi implementado (vale para A e B).
**Motivo:** paridade com o legado nas regras de entrada, com o isolamento garantido pelo banco também nas rotas sem sessão.

### D-039 — Runtime de módulos (contrato v0)
**Data:** 2026-10-25 · **Status:** aceita (Sprint 8); **pede revisão humana** (gate do Sprint 8) antes dos módulos reais
**Decisão:**
- **Contexto via `c.var.ctx`** (Hono): `createModuleApp()` e `createAnonApp()` já tipam o contexto; o runtime monta `user`, `community`, `can`, `tx`, `notify`, `members` depois da sessão e da comunidade.
- **Rotas anônimas recebem uma cópia da requisição** só com `content-type`, `accept` e `accept-language`, executada num app separado, sem os middlewares de sessão. O lint continua valendo; o runtime garante mesmo que o lint falhe.
- **`@erre/core/manifest`** é a entrada pura para manifestos; `@erre/core/client` traz React (host de módulo e `useModuleClient`). O lint proíbe o manifesto, a API de módulo e `apps/api` de importarem `@erre/core/client`. Achado ao testar: o manifesto puxava React para a API.
- **Intenções só de módulos ligados; `onMemberLeft` de todos os registrados.** Permissões semeadas de todos os registrados (o schema não depende da flag).
- **Jobs:** `node-cron` no fuso global, lock consultivo `hashtext('job:<id>')` numa conexão dedicada, comunidades listadas pelo pool `erre_jobs`, uma transação de tenant por comunidade, erro isolado por comunidade. Rota interna com comparação em tempo constante.
- **Seções de perfil** em savepoint; falha esconde só a seção.
- **App:** registro estático de UIs (`apps/mobile/src/modules.ts`) ∩ `GET /v1/modules`; seção do hub por módulo; `withModule(id, Tela)` nas rotas finas.
- **Módulo de teste em `modules/_contrato-teste`:** pastas com `_` ficam fora das migrations de produção e do registro.
**Motivo:** o contrato é o produto; cada garantia tem teste no módulo de teste, e as que dependem de disciplina (anonimato, React fora da API) ganharam proteção em código.

### D-040 — Notificações
**Data:** 2026-10-25 · **Status:** aceita (Sprint 9)
**Decisão:**
- **Kill switch = `PUSH_ENABLED`** (P-007, opção A, provisória até o humano confirmar). Variáveis VAPID com os nomes do legado (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); sem as três, o Web Push fica desligado sem erro, como no legado. A chave pública vai ao app por `GET /v1/push/config`, sem rebuild.
- **Envio depois do commit:** o contexto de tenant ganhou `afterCommit`; `ctx.notify` junta as mensagens e o notificador envia em segundo plano quando a transação confirma. Nos jobs, por comunidade, depois do commit dela.
- **Preferências guardam só as escolhas**; sem linha vale o `defaultEnabled` do manifesto. Tipos listados são os dos módulos ligados.
- **Uma inscrição por aparelho** (`endpoint` ou token únicos): quem registra por último fica com o aparelho; só o dono remove.
- **Inscrições inválidas removidas**: Web Push 404/410; Expo `DeviceNotRegistered` no ticket ou no recibo (~15 min depois, melhor esforço, em memória).
- **Logs só com contagens** (tipo, destinatários, enviadas, removidas).
- **App:** service worker do legado só na web; `expo-notifications` no nativo (precisa de `extra.eas.projectId`, criado com o projeto EAS); toque abre a rota da notificação. Pedido de permissão só quando a pessoa liga em "Notificações" (o pedido no momento de valor vem com o Errômetro, DESIGN §10.1).
- **DESIGN §9.17 (proposta):** interruptor (`SwitchRow`), que o DESIGN.md não cobria.
**Motivo:** notificação nunca sai de algo que foi desfeito, nem segura o banco esperando a rede.

### D-041 — Design system (`packages/ui`)
**Data:** 2026-10-25 · **Status:** aceita (Sprint 10)
**Decisão:**
- **Componentes da §9 do DESIGN.md** em `@erre/ui`, com movimento (Reanimated, tokens `motion`), háptico (`expo-haptics`, nada na web) e "reduzir movimento" (sem pulso nem shake; pop e fadeUp viram fade).
- **Correção de token:** `warning.text` claro passa de `#b45309` para `#92400e`. O teste de contraste mostrou 4,41:1 sobre o fundo de aviso composto no `bg.canvas` (a tabela dizia 4,6:1, que só vale sobre branco). DESIGN.md e tokens atualizados; **pede confirmação humana** (a página visual publicada do design ainda mostra o valor antigo).
- **Tema persistido:** AsyncStorage no nativo (splash fica até ler), `localStorage` na web com script inline no `<head>` gerado dos tokens (`public/index.html`, `pnpm gen:html`; um teste falha se ficar desatualizado). HTML em `pt-BR`.
- **Fontes Geist** carregadas antes de mostrar o app; uma família por peso (no Android, `fontWeight` não escolhe peso de fonte própria).
- **Lint `erre/no-raw-style`:** cor literal (hex, rgb, hsl) e `fontSize` numérico fora de `packages/ui` são erro.
- **Galeria em `/dev/ui`**, ligada só com `EXPO_PUBLIC_DEV_GALLERY=1` (o CI liga; o deploy não).
- **Ícones como glifos de texto** até decidir uma biblioteca (P-016).
- **Testes de componentes no app** (jest-expo), com um mock mínimo do Reanimated (o oficial não carrega fora do runtime nativo no SDK 58).
- **Sheet sem gesto de arrastar** por enquanto (fecha pelo X, pelo fundo e pelo voltar do Android); o gesto entra se uma biblioteca de gestos for aprovada.
**Motivo:** o DESIGN.md vira código verificável: contraste testado, cores só por token, e os componentes vistos nos dois temas.

### D-042 — Pacotes `anon-vote` e `emoji`
**Data:** 2026-10-26 · **Status:** aceita (Sprint 11)
**Decisão:**
- **`@erre/anon-vote`** com três entradas: `.` (tipos, agregação e interfaces, seguro no app e na API), `./client` (JS puro, D-011) e `./server` (`@cloudflare/blindrsa-ts`). Esquema igual ao do legado: RSABSSA-SHA384-PSS-Randomized, rótulo `karmometro-vote-token-v1`, `voter_tag` = SHA-256 hex da mensagem preparada. **Tokens já emitidos pelo legado continuam válidos** com as chaves migradas.
- **Fluxos no pacote, tabelas no módulo:** `issueToken({ keys, issuances }, { userId, period, blindedMsgB64 })` checa o tamanho do valor cegado **antes** de gastar a emissão e devolve `ALREADY_ISSUED` ou `INVALID_BLINDED_MESSAGE`; `verifyBallot({ keys }, ...)` devolve o `voter_tag` ou `null`. Interfaces `SigningKeyRepository`, `TokenIssuanceRepository` (sem timestamp) e `AnonVoteRepository`. `period` é a unidade do módulo (rodada, evento).
- **Métodos por `userId` do repositório de votos do legado não foram portados:** pertencem ao caminho HMAC do demo (R-ANON-08, P-003).
- **Aleatoriedade:** `crypto.getRandomValues` quando existe; no nativo o app passa `randomBytes` do `expo-crypto` (sem fonte segura, o cliente lança erro em vez de seguir).
- **Grafemas:** `isSingleGrapheme` usa `Intl.Segmenter`; sem ele (Hermes), uma contagem por code point que cobre ZWJ, tons de pele, bandeiras, keycap e tags. Testada contra o `Segmenter` em 14 casos. **A API é quem decide** (Node sempre tem `Segmenter`).
- **Brilho do troféu de emoji personalizado:** `inferEmojiGlowColor` mede no `canvas` e só roda na web. O valor é **calculado uma vez, quando o emoji é criado na web, e gravado** com o emoji; criado no nativo, fica `DEFAULT_TROPHY_GLOW_RGB`. Emojis do catálogo usam `TROPHY_GLOW_RGB`.
- **Verificação no Hermes:** `pnpm --filter @erre/anon-vote hermes` (manual, precisa do binário; fora do CI).
**Motivo:** Errômetro e Eventos usam o mesmo voto anônimo; o que garante o anonimato (gate de emissão sem horário, verificação antes de gravar) fica num lugar só e testado, e cada módulo só guarda dados.

### D-043 — Errômetro API I `[contrato]`
**Data:** 2026-10-26 · **Status:** aceita (Sprint 12)
**Decisão:**
- **Rodada = janela ancorada no histórico** (R-CAL-03): `from` é o `created_at` do último snapshot (ocultos inclusive) ou, antes do primeiro, a criação da comunidade; `to` é o próximo horário da cadência. O rótulo (`period`, YYYY-MM-DD de `to`) é a chave da assinatura, da emissão e dos votos. A rodada só muda quando um snapshot é gravado (fechamento: troca de cadência agora, job no Sprint 13).
- **Mudança de contrato:** `community.createdAt` em `ModuleContext`, `AnonContext` e `JobContext` (a âncora do primeiro período; o legado usava `groups.created_at`). Aditivo.
- **Rota anônima sem `ctx.members`:** os alvos do voto anônimo são os participantes aprovados do módulo, que `onMemberLeft` mantém em dia (roda para todo módulo registrado, ligado ou não). As rotas autenticadas cruzam com `ctx.members` também. Se aparecer um caminho que muda membership sem o hook, a rota anônima precisa de `members` (registrar `[contrato]`).
- **Trava da rodada:** lock consultivo por comunidade, compartilhado na chave, na emissão e no voto, exclusivo no fechamento e na troca de cadência. Fecha a corrida que o legado deixou registrada em `group-release-config.ts` (voto lendo a cadência antiga enquanto a nova é gravada).
- **Emissão:** o valor cegado fora de `[0, n)` é recusado antes de reservar a emissão (no legado, assinar falhava depois da reserva e queimava o período). Emissão repetida: 409 `TOKEN_ALREADY_ISSUED`.
- **"Meus votos" só pela rota anônima**, por `voter_tag` (como no legado): uma rota com sessão veria pessoa e tag juntas.
- **Erros:** token inválido 401 `INVALID_TOKEN` (não `UNAUTHENTICATED`, para o app não tratar como sessão expirada); nenhum voto válido 422 `NO_VALID_VOTES`; limite de votantes 422 `PARTICIPANTS_FULL`; transição inválida 409.
- **Participação:** `errometro.participar` aprova junto com a entrada se houver vaga; com 50 votantes, fica `pending` e `GET /participacao` responde `full: true` para a tela explicar (sem push: hooks não têm `notify`, e o legado também não avisava). Saída da comunidade: pedido pendente vira `rejected`, participação aprovada vira `removed`.
- **Permissões:** `errometro.ver` e `errometro.votar` para todos os papéis; `errometro.moderar` para `owner` e `admin` (D-023).
- **Emoji personalizado:** id no formato `custom-...` (validação de entrada; o legado aceitava qualquer texto).
- **Notificações declaradas** com os nomes do mapeamento de dados: `errometro.resultado_pronto` e `errometro.lembrete_fechamento` (enviadas no Sprint 13).
- **Estrutura do módulo:** lógica pura em `domain/` (o app pode importar), código de servidor em `api/server/`. Testes de integração com `createModuleHarness` de `@erre/core/testing`, sem depender de `apps/api`.
**Motivo:** paridade com o legado no comportamento, com as duas correções que o próprio legado apontava (corrida da cadência e emissão queimada), e o contrato só mudando no mínimo necessário.

### D-044 — Errômetro API II `[contrato]`
**Data:** 2026-10-26 · **Status:** aceita (Sprint 13)
**Decisão:**
- **Fechamento agendado** (`errometro.fechar_rodadas`, a cada 15 min, por comunidade): fecha toda rodada cujo `to` passou, até 14 por execução (R-RES-02), cada uma ancorada no próprio `to`; cadência manual nunca fecha sozinha. Trava exclusiva da rodada (D-043) durante o fechamento.
- **"Resultado saiu" uma vez por rodada:** o fechamento marca `notified_at` com `UPDATE ... WHERE notified_at IS NULL` na mesma transação; o push sai depois do commit. Recalcular não reenvia. Troca de cadência fecha sem push (R-RES-05).
- **Lembrete** (`errometro.lembrete_fechamento`, a cada 15 min): faltando 3h ou menos, uma vez por rodada (`errometro_release_reminders`); pula cadência manual. Destinatários dos dois pushes: todos os membros aprovados, como no legado.
- **Comunidade sem votantes aprovados não recebe push do Errômetro** (P-018, provisório): a rodada fecha, mas ninguém é avisado.
- **Rotas de moderação** (`errometro.moderar`): liberar agora, listar rodadas (fechadas, inclusive ocultas, e rótulos com voto, só contagens), recalcular uma rodada (a atual fecha agora; passada mantém o `created_at`; nunca fechada usa o fim do próprio dia), ocultar/mostrar, anular por código (apaga as linhas do `voter_tag`, sem reemitir token).
- **Resultados** (`errometro.ver`, vote ou não): só rodadas fechadas e visíveis; ranking com todos os membros atuais (quem não recebeu voto aparece com zero, quem saiu some), troféus da rodada e status por membro, contagem de comentários; `hiddenCount` só para moderadores; `nextReleaseAt` nulo na cadência manual.
- **Comentários:** 1 a 280 caracteres depois do `trim`; só o autor edita; o autor ou um moderador apaga. O nome do autor é lido de `ctx.members` a cada leitura; autor que saiu aparece como "Ex-membro" (o legado guardava o nome).
- **Troféus no perfil:** seção `errometro.trofeus` (rodadas visíveis), nula para quem não ganhou nada.
- **Rota das notificações:** `/errometro/resultados?comunidade=<id>` e `/errometro?comunidade=<id>`; o app troca para essa comunidade ao abrir (Sprint 14/15).
- **Correção no core:** a política `propria_membership` quebrava `ctx.members` em jobs e rotas anônimas (convertia `app.user_id` vazio em uuid). Migration `core_0006` usa `nullif(...)`, continuando fechada sem pessoa.
- **Mudanças de contrato:** `JobContext.community` ganha `slug` e `name` (o título do push usa o nome); `createModuleHarness({ recordPush })` grava os pushes para os testes de módulo.
**Motivo:** paridade com o legado no fechamento e nas notificações, com o mínimo de diferença onde o contexto novo (Errômetro em toda comunidade) pede.

### D-045 — Errômetro UI I: hub e votação `[contrato]`
**Data:** 2026-10-26 · **Status:** aceita (Sprint 14)
**Decisão:**
- **Fluxo anônimo no aparelho:** chave → emissão (cliente autenticado do módulo) → cegar/finalizar com `@erre/anon-vote/client` → voto e "meus votos" por um `fetch` comum com `credentials: 'omit'` e só `content-type` (sem cookie, `Authorization` nem `X-Community-Id`). O runtime também tira esses headers do lado do servidor (D-010), o que cobre o caso em que um cookie jar nativo anexa cookie mesmo assim.
- **Token no aparelho:** `secureStorage` (secure store no nativo, `localStorage` na web, como no legado), chave por comunidade e rodada. Votos lembrados por comunidade em `storage`, filtrados por pessoas e emojis atuais, nunca enviados.
- **Mudança de contrato:** `ModuleHost.storage` e `ModuleHost.secureStorage` (`getItem`/`setItem`/`removeItem`, chaves `<módulo>.<...>` só com letras, números, `.`, `-` e `_`). Módulos não dependem de AsyncStorage nem do secure store diretamente.
- **Aleatoriedade segura no nativo:** o app instala `crypto.getRandomValues` do `expo-crypto` na inicialização (o Hermes não tem); o cliente da assinatura cega usa o padrão sem mudar.
- **Grade:** a própria pessoa não aparece (R-ANON-09, como o legado); "Alfabética / Não votados" com a ordem congelada no momento da troca; 2 colunas a partir de 360 de largura; lista virtualizada.
- **Depois de enviar:** toast, háptico e anúncio para leitor de tela; a tela continua (ir para os resultados entra no Sprint 15, com a tela de resultados). Rodada que virou durante o voto: mensagem e recarga.
- **Próximo resultado formatado no servidor** ("segunda, 12h"), no fuso da votação (`VOTING_TIMEZONE`), que o app não conhece.
- **Convite com intenção:** a tela de convites deixa escolher "Só entrar na comunidade" ou a intenção do módulo, que vem marcada (o link do legado já pedia entrada e voto juntos).
- **`?comunidade=<id>`** em qualquer rota troca para essa comunidade, se a pessoa for membro (toque em notificação).
- **`@erre/ui`:** `VoteTargetCard`, `EmojiGrid`, `ListScreen`, `CopyableCode`; `EmojiButton` com `size` (40–48 com `hitSlop`, proposta no DESIGN §9.4); estados de acessibilidade passam a usar `aria-*` (o `accessibilityState` não chegava à web).
**Motivo:** a votação nas três plataformas com o anonimato do legado, sem cada módulo reimplementar armazenamento e aleatoriedade.

### D-046 — Errômetro UI II: resultados e administração `[contrato]`
**Data:** 2026-10-26 · **Status:** aceita (Sprint 15)
**Decisão:**
- **Resultados:** a rodada mais recente visível, com "‹ Anterior / Próxima ›" entre as rodadas fechadas; medalhas dos troféus da rodada; ranking (`RankingRow` com selos de troféu dourado e "quase" prateado); comentários por pessoa; "Compartilhar resultado" com a folha nativa (e a área de transferência na web sem `navigator.share`), no formato do legado; próximo resultado. Sem rodada: vazio com a data do próximo; moderador com tudo escondido vê o aviso que só ele vê (R-RES-07).
- **Anel de pódio só para quem recebeu voto:** no legado o 2º e o 3º lugar ganhavam anel mesmo com zero; aqui um zero não ganha anel.
- **Administração** (`errometro.moderar`, entrada pelo hub): votantes (aprovar, recusar, remover com confirmação), rodadas (liberar agora e esconder com confirmação; recalcular sem; a rodada aberta só recalcula), anular por código (validação e confirmação), cadência (dias da semana ou manual, hora com `Stepper`; "daily"/"weekly" do legado aparecem como os dias equivalentes; salvar confirma que a rodada atual fecha) e emojis (ordem, tirar, adicionar do catálogo ou guardados, criar com brilho medido na web).
- **Contrato:** `ModuleHost.webUrl` (endereço público do app para links compartilhados) e `ModuleHost.back()` ("← Início" nas telas do módulo); `GET /rodada` traz `canModerate`; `hiddenCount` vem nulo para quem não modera.
- **`@erre/ui`:** `ChipToggle`, `Stepper`; `RankingRow` com `trophies`.
- **Seção de perfil `errometro.trofeus`** renderizada pelo módulo; a página de membro que a mostra é do Sprint 18.
**Motivo:** paridade do Errômetro no app, com as confirmações que o DESIGN.md pede para ações destrutivas.


### D-047 — Eventos API `[contrato]`
**Data:** 2026-10-26 · **Status:** aceita (Sprint 16)
**Decisão:**
- **Módulo `eventos`** com 8 tabelas por comunidade; as filhas apontam para o evento por `(community_id, event_id)` (D-015). Domínio portado (estados, calculadoras categórica e de escala, vencedor de troféu, limites, mensagem de compartilhamento) e regras da cédula como função pura (`planEventBallot`).
- **Permissões:** `eventos.ver` e `eventos.votar` para todos os papéis; `eventos.criar` (criar e editar rascunho, emojis) e `eventos.moderar` (publicar, abrir, encerrar, excluir) para owner e admin. No legado só o criador do grupo geria eventos; owner/admin administram a comunidade (D-023). Rascunho só existe para quem cria ou modera (404 para os outros, como evento excluído).
- **Participação (P-014 B, provisório):** só membro aprovado participa, inscrevendo-se enquanto o evento está ao vivo (`accepting_applications` ou `open`); o link do evento não cria pedido pendente nem dá participação. A intenção de convite `eventos.participar` inscreve no evento ao vivo quando o pedido de entrada é aprovado. Quem sai da comunidade sai dos eventos não fechados (a cédula anônima não vê membros, D-043); eventos fechados mantêm os participantes.
- **Um evento ao vivo por comunidade** (R-EVT-03): checado ao publicar, sob lock por comunidade, e garantido também por índice único parcial no banco.
- **Fechamento numa transação só:** snapshot, status, livro de troféus e push na mesma transação, sob lock exclusivo do evento (voto e emissão de token usam o mesmo lock compartilhado). O legado gravava snapshot e status separados e precisava de um caminho de "retentativa que reaproveita o snapshot"; aqui um fechamento pela metade não é gravado, e fechar de novo é 409.
- **Push "resultado do evento saiu"** (`eventos.resultado_pronto`, novo; o legado tinha a coluna `notified_at` mas não mandava): para os participantes que ainda são membros, uma vez por evento.
- **Jobs** `eventos.abrir_agendados` e `eventos.fechar_agendados` a cada 15 min, como o tique do legado. Sem o teto de 50 eventos por execução do legado: o job roda por comunidade e há no máximo um evento ao vivo.
- **Rascunho e emojis só em rascunho, sem a janela do legado:** salvar emojis relê o status com `FOR UPDATE` na mesma transação (o legado registrava esse "KNOWN GAP"); editar campos usa `WHERE status = 'draft'`.
- **Resultados:** `GET /eventos/:id/resultados` devolve o payload congelado, os emojis e o nome dos alvos que ainda são membros; ordenação e formato (percentual da escala, "×N" no teto 1) ficam na tela (Sprint 17), como no legado.
- **Rotas anônimas:** `/v1/eventos/anon/c/:communityId/:eventId/{votos,meus-votos}`. O `period` de `@erre/anon-vote` é o id do evento: uma chave e uma emissão por evento.
**Motivo:** paridade de Eventos com as decisões já tomadas para a comunidade (D-026) e o anonimato no mesmo pacote do Errômetro.

### D-048 — Eventos UI `[contrato]`
**Data:** 2026-10-26 · **Status:** aceita (Sprint 17)
**Decisão:**
- **Telas:** lista (`/eventos`), evento (`/eventos/:id`: sala de espera, inscritos, emojis, administração e "zona de perigo"), votação (`/eventos/:id/votar`) e resultados (`/eventos/:id/resultados`). Seção no hub com o banner do evento ao vivo, ou do encerrado nos últimos 2 dias (como o legado); a lista vem pela entrada de menu do manifesto.
- **Assistente em sheet, 4 passos** (o evento e o tipo; emojis ou eixos; abertura e fechamento; cor), cada passo validado com as mesmas funções de domínio da API. Criar e editar rascunho usam o mesmo assistente; o tipo não muda depois de criado.
- **Datas agendadas** digitadas como "dd/mm/aaaa" e "hh:mm" no fuso do aparelho (o formulário do legado também usava a hora local), sem biblioteca nova de seletor de data. Exibição também no fuso do aparelho.
- **Cor do banner:** 7 cores prontas mais a padrão, em vez do seletor livre do legado; a cor só tinge fundo, borda e ícone (DESIGN §3.4) via `Banner tone="event"`.
- **Votação por escala:** um card por pessoa, com uma linha de pips por eixo (`IntensityPicker`, proposta no DESIGN §9.4); categórica igual à do Errômetro. Ordenação "Alfabética / Não votados", código do voto, voto anônimo pelo mesmo caminho do Errômetro (token por evento no `secureStorage`).
- **Resultados:** medalhas dos troféus (empate mostra quem empatou, sem troféu), ranking único no categórico e um por eixo na escala (percentual do teto, "×N" no teto 1), compartilhar no formato do legado.
- **`@erre/ui`:** `IntensityPicker`; `RankingRow` com `valueLabel`; `haptic` usa `navigator.vibrate` na web quando existe (DESIGN §8).
**Motivo:** paridade de Eventos no app, com os componentes e tokens do design system, sem dependência nova.

### D-049 — Perfil, página de membro e PWA `[contrato]`
**Data:** 2026-10-26 · **Status:** aceita (Sprint 18)
**Decisão:**
- **Perfil** (`/perfil`, pelo avatar no canto do hub, DESIGN §9.16): nome, cor do avatar (as 8 variantes; o legado só derivava a cor do id), "Seus troféus em <comunidade>", Notificações, Aparência, instalar o app e sair. `PATCH /v1/me/profile` aceita `displayName` e/ou `avatarVariant`; só o nome confirma o onboarding.
- **Página de membro** (`/comunidade/membro/:id`): nome, avatar, papel e as seções de perfil dos módulos ligados, cada uma com o renderizador do próprio módulo. Links nela a partir da lista de membros, dos rankings de resultado (Errômetro e Eventos) e dos inscritos de um evento.
- **Contrato:** `ModuleHost.openMember(userId)`; `RankingRow` com `onPress`.
- **Landing** em `/entrar`: marca, limites reais (50 votantes, 300 membros, DESIGN §12) e "Como funciona" estático no lugar do grupo demo (P-003 A, provisório).
- **PWA:** `manifest.webmanifest` gerado dos tokens; ícones estáticos (192, 512, maskable, apple-touch-icon) e imagem OG estática gerados por `pnpm gen:pwa` e versionados (P-008); meta tags de app instalável e de compartilhamento. "Instalar o app" no perfil (prompt no Android/Chrome; instruções no iOS Safari).
- **Pós-build web** (`scripts/finish-web.ts`): com `EXPO_PUBLIC_WEB_URL`, a imagem de compartilhamento vira URL absoluta; com `APPLE_TEAM_ID` e `ANDROID_CERT_SHA256`, gera `.well-known/apple-app-site-association` e `assetlinks.json`. Sem os valores, nada é gerado: nenhum valor inventado chega à produção.
- **Nome na web:** "Errômetro" (DESIGN §2); o `app.json` continua "Erre" até a P-019.
**Motivo:** fechar as telas transversais com o que os módulos já expõem (D-018) e deixar a web instalável sem serviço novo.

### D-050 — Segurança e LGPD `[contrato]`
**Data:** 2026-10-27 · **Status:** aceita (Sprint 19)
**Decisão:**
- **Limites de requisição** no runtime de módulos, em memória: por pessoa (300/min), emissão de token (10/min) e rotas anônimas **por comunidade** (600/min), nunca por IP, para a rota anônima continuar sem saber quem chama. Com mais de uma instância da API, o limite vira por instância.
- **Headers de segurança** na API (`secureHeaders`) e teste do cookie de sessão em HTTPS. Revisão rota a rota em `docs/seguranca.md`.
- **Contrato:** `data: { export, delete }` em `defineModuleApi`, chamado pelo core em cada comunidade da pessoa.
- **Exportação** pela própria pessoa (`GET /v1/me/export`, "Baixar meus dados" no perfil). **Exclusão** por quem opera (`POST /v1/internal/users/:id/delete`, `ADMIN_SECRET`), recusada enquanto a pessoa for a única dona de uma comunidade com outros membros. Votos anônimos e resultados fechados ficam (o id deixa de apontar para alguém); comentários por ela e sobre ela saem.
**Motivo:** o plano pede exclusão acionada por admin na v1; deixar comunidade sem dono quebraria a administração dela; o anonimato do voto impede (e dispensa) apagar votos por pessoa.

### D-051 — Assinatura cega no OpenSSL do Node; deploy da API em imagem empacotada
**Data:** 2026-10-27 · **Status:** aceita (Sprint 19)
**Decisão:**
- A operação de chave privada da emissão de token (RSASP1, RFC 9474 §4.3) usa `privateDecrypt` com `RSA_NO_PADDING` do Node, com a verificação RSAVP1 da RFC antes de devolver. `@cloudflare/blindrsa-ts` continua na geração de chave e na verificação do voto, que já são nativas.
- A API vai para produção como imagem com um único arquivo JavaScript (`apps/api/Dockerfile`). As migrations rodam numa imagem separada (`--target migrate`), como `erre_migrator`, antes da API nova. O workflow `api-image.yml` só constrói e testa quando a API ou suas dependências mudam. O deploy em si espera P-010.
**Motivo:** a biblioteca fazia o RSA em BigInt de JavaScript: ~350 ms de CPU por token, com o event loop travado. No OpenSSL leva ~1 ms, com resultado idêntico (testado contra a biblioteca e o vetor A.1). Imagem sem `node_modules` e sem código-fonte é menor e expõe menos. Migrations num passo à parte mantêm a API sem permissão de alterar o schema. Medições em `docs/desempenho.md`, passos em `docs/deploy.md`.

