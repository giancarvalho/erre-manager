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
