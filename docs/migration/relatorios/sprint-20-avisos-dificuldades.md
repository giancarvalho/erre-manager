# Sprint 20: dificuldades ao criar o módulo `avisos` (teste do gerador e da documentação)

Módulo `avisos` (mural de avisos) criado só com `pnpm create-module`, `docs/criando-um-modulo.md` e os documentos para onde ele aponta. Uma dificuldade por item: **o que eu estava fazendo** · **o que travou ou confundiu** · **como resolvi** · **sugestão**. `[contrato]` marca o que é sobre o contrato de módulo.

## Tempo e passos por etapa

| Etapa | Tempo | Passos | Observação |
|---|---|---|---|
| Preparar (`pnpm install`) | ~1 min | 1 comando | sem `db:bootstrap`: os testes só precisaram de `DATABASE_ADMIN_URL` |
| Ler guia, CONTRATO, CONTRIBUTING, guia de PR, LGPD, DESIGN | ~3 min | 5 leituras | DESIGN.md é longo (638 linhas), mas a seção "Design do seu módulo" do guia resume bem |
| Gerar | ~1 min | 3 comandos (`create-module`, `pnpm install`, os dois testes) | verde de primeira |
| Modelar dados | ~2 min | 2 arquivos (`db/schema.ts`, migration) | teste de contrato (schema = migration, índices) verde de primeira |
| Rotas + LGPD | ~3 min | 3 arquivos + 3 testes adaptados | 2 tropeços nos testes (itens 6 e 8) |
| Notificação | ~3 min | manifesto + `domain/push.ts` + teste | precisei ler código do Errômetro e do app (itens 3 e 4) |
| Telas | ~3 min | 4 arquivos (`AvisosScreen`, `HubSection`, `data.ts`, `index.tsx`) + rota fina | teste da tela verde de primeira; typecheck e lint também |
| Testes | junto com cada etapa | 4 rodadas da API, 1 da tela | 21 testes da API, 6 da tela |
| `pnpm check` | ~1 min (41 tarefas, 20 em cache) | 1 rodada, depois de um `prettier --write` em 2 arquivos | verde de primeira |

**Funcionou bem de primeira:** o gerador (registro em API, app, `package.json` e `.env.example`) e os testes gerados; o teste de contrato pegando schema × migration; `permissionMatrix` e `h.fixture()`; `fakeModuleHost` para a tela; o cliente tipado (`InferResponseType`) acompanhando a renomeação dos campos sem nenhum ajuste; o tipo de `avatarVariant` de `ctx.members` encaixando direto no `Avatar` de `@erre/ui`; o lint de design (não precisei de nenhuma exceção).

## Dificuldades

1. **Preparando o ambiente** · O §0 do guia manda `docker compose`, `DATABASE_ADMIN_URL=.../erre`, `DATABASE_MIGRATOR_URL` e `db:bootstrap` antes de tudo; não ficou claro o que disso é necessário só para rodar os testes do módulo · Usei só `DATABASE_ADMIN_URL` (apontando para o Postgres local) e os testes criaram o banco descartável sozinhos · **Sugestão (guia):** separar "para rodar os testes basta `DATABASE_ADMIN_URL`" de "para ver no app: bootstrap + migrate + `.env`".

2. **Instalando depois de gerar** · `pnpm install` imprime `unmet peer @better-auth/utils@0.4.2: found 0.5.1`; parece erro do meu módulo · Ignorei (não é do módulo, os testes passam) · **Sugestão (guia):** uma linha "avisos de peer dependency do core podem ser ignorados" ou resolver o aviso no core.

3. **Montando a notificação** `[contrato]` · O guia sugere `route: '/avisos'`, mas um push precisa abrir a comunidade certa: quem está em duas comunidades e toca no push abriria o mural da comunidade ativa, não da que publicou. A convenção `?comunidade=<id>` só aparece no código do Errômetro/Eventos e em `apps/mobile/src/app/(app)/_layout.tsx` · Li esse código e usei `/avisos?comunidade=<id>` (`domain/push.ts`) · **Sugestão (contrato):** o `notify()` acrescentar `comunidade=<ctx.community.id>` sozinho (o core já sabe a comunidade); enquanto isso, corrigir o exemplo do guia e do CONTRATO §4.1.

4. **Testando o push** `[contrato]` · CONTRATO §7 diz que `recordPush: true` grava em `h.pushes`, mas não que é preciso esperar `h.runtime.notifier.idle()` (o envio é depois do commit, assíncrono). O template não tem exemplo de teste de notificação · Copiei o helper `pushesAfter` de `modules/errometro/tests/integration/closing.test.ts` · **Sugestão (harness/template):** `h.pushesAfter(fn)` no harness e um teste de notificação no template (ou ao menos citar `notifier.idle()` no §7).

5. **Testando LGPD** · Não há exemplo de teste de `data.export`/`data.delete`; a opção `adminSecret` do harness (que liga `POST /v1/internal/users/:id/delete`) não está no CONTRATO §7 · Li os tipos em `packages/core/src/server/testing-harness.ts` e testei pelas rotas do core (`GET /v1/me/export` e a exclusão com `ADMIN_SECRET`) · **Sugestão (template):** gerar um `privacy.test.ts` que exporta e apaga a tabela de exemplo; documentar `adminSecret` no §7.

6. **Criando uma comunidade de teste com nome** · `h.fixture('Turma do vôlei')` falhou com `VALIDATION_ERROR`: o nome precisa ser minúsculo com hífens. O guia só diz "h.fixture() cria uma comunidade com uma pessoa por papel" · Usei `h.fixture('turma-do-volei')` · **Sugestão (harness/guia):** documentar o formato ou o harness converter o nome.

7. **Escrevendo o título do push** `[contrato]` · `ctx.community` tem `slug` e `name`, mas o nome da comunidade aceita só letras minúsculas, números e hífens, então o push fica "📌 Aviso novo em turma-do-volei". Não ficou claro qual campo usar em texto para pessoas nem qual a diferença entre os dois · Usei `name` · **Sugestão (contrato):** dizer no §4.1 o que é cada campo e qual mostrar na interface (ou o core ter um nome de exibição).

8. **Testando "o autor saiu da comunidade"** · Não há helper para sair/remover membro no harness; a rota `/v1/communities/:id/leave` não está na documentação de módulo e responde 403 sem o header `X-Community-Id` · Achei a rota com grep em `packages/core/src/server/app.ts` e mandei `community` no `h.req` · **Sugestão (harness):** `h.leave(user, fx)` / `h.remove(user, fx)` para testar `onMemberLeft` e dados de ex-membros.

9. **Mostrando o autor do aviso** `[contrato]` · CONTRATO §4.1 diz que `members` tem "membros aprovados com nome e avatar", sem o formato · Li `packages/core/src/server/members.ts` (`{ userId, displayName, avatarVariant, role }`) · **Sugestão (contrato):** pôr o tipo `Member` na tabela do §4.1. Também vale dizer que ex-membros não aparecem (o módulo precisa tratar autor ausente: aqui, `author: null` e "Ex-membro" na tela).

10. **Fazendo o campo de texto longo** · DESIGN §9.2 não cobre campo de várias linhas; `TextField` não aceita `style`, então não dá para dar altura mínima nem padding vertical a um `multiline` · Usei `multiline`, `numberOfLines={4}` e `textAlignVertical="top"` (props do `TextInput`, aceitas). Não consegui conferir visualmente nas três plataformas · **Sugestão (DESIGN + `packages/ui`):** variante `multiline` do `TextField` (altura mínima ~96, padding vertical 12) descrita no §9.2.

11. **Escolhendo o ícone do manifesto** · `icon` é texto livre; não há lista de valores válidos nem onde ele aparece · Usei `megaphone` · **Sugestão (CONTRATO §2):** listar os ícones aceitos (ou validar) e dizer onde aparecem.

12. **Conferindo links do app** `[contrato]` · `apps/mobile/src/web/well-known.ts` fixa `APP_PATHS = ['/convite/*', '/errometro/*', '/eventos/*', ...]`. O gerador não acrescenta `/avisos/*`, então um link web para o mural não abre o app nativo (universal link). Não alterei (fora do escopo permitido) · **Sugestão (gerador ou core):** derivar `APP_PATHS` dos módulos registrados (`MODULE_UIS`/menus) em vez de lista fixa.

13. **Renomeando o exemplo** · O template usa `items`/`Item`/`ItemsScreen`/`useItems`/`avisos_items`/`avisos.gerenciar`; transformar em `posts`/`Aviso`/`AvisosScreen`/`avisos.publicar` tocou ~10 arquivos (incluindo os três testes gerados e o teste da tela) · Fiz à mão, com o typecheck guiando · **Sugestão (gerador):** opção `--entidade aviso` para já gerar com o nome do domínio, ou nomes do template marcados com um comentário "renomeie".

14. **Lendo o CONTRATO §4.1 sobre a rota raiz** · O texto fala da rota `'/'` respondendo em `/v1/<id>`, mas o template usa `.get('', ...)` · Mantive `''` do template · **Sugestão (CONTRATO):** usar o mesmo `''` no texto.

15. **"Ver funcionando" (guia §2) e prints** · Não subi API + app: exige `apps/api/.env` com Google OAuth e o banco `erre` migrado; nesta tarefa só havia o Postgres de teste. Sem isso, não há prints nas três plataformas nem conferência visual dos temas, e o checklist da §14 do DESIGN fica parcial · **Sugestão (guia/core):** um jeito de ver a tela de um módulo sem login real (ex.: a galeria `/dev/ui` aceitar telas de módulo com `fakeModuleHost`, ou um login de desenvolvimento).

16. **Decidindo o que a LGPD apaga** · `docs/lgpd.md` dá dois precedentes opostos: "eventos que a pessoa criou continuam (são da comunidade)" e "comentários escritos por ela são apagados". Um aviso é texto livre escrito pela pessoa, mas publicado para a comunidade · Decidi apagar (é texto de autoria, como comentário; explicado em `api/server/privacy.ts`). Não registrei em `PERGUNTAS.md` porque a tarefa limita os arquivos alteráveis; **fica como pergunta para o humano** · **Sugestão (lgpd.md):** uma regra geral para "conteúdo publicado para a comunidade" (apagar, ou manter sem autor).

17. **Estado de erro da tela** · O `ErrorState` do template substitui a tela inteira, sem o cabeçalho e o "← Início" (só sobra o gesto de voltar). O estado "sem conexão" da §9.15 não aparece no template nem no guia · Mantive como o template · **Sugestão (template):** erro dentro do `Screen` com o cabeçalho; dizer no guia se "sem conexão" é tratado pelo core.

18. **Listando sem limite** · O guia não fala de paginação; a lista traz todos os avisos da comunidade · Deixei sem limite (comunidades têm até 300 membros e avisos são poucos) e registro como pendência · **Sugestão (guia):** um parágrafo sobre quando paginar (ou apontar `docs/desempenho.md`).

19. **Exportando lógica pura** · `package.json` do módulo exporta `./domain` só como `domain/schemas.ts`; criei `domain/push.ts`, usado por import relativo dentro do módulo · Sem problema na prática · **Sugestão (template):** `domain/index.ts` como entrada, para não precisar mexer no `exports` quando o domínio cresce.

## Decisões tomadas

- **Permissões:** `avisos.ver` para todos os papéis aprovados; `avisos.publicar` (publicar e apagar qualquer aviso) para `owner`, `admin` e `moderador`. Publicar manda push para a comunidade inteira, então fica com quem já cuida do tom da comunidade; `membro` fica de fora para o mural não virar chat nem spam de notificação.
- **Push:** tipo `avisos.novo` ("Aviso novo no mural", ligado por padrão), para todos os membros aprovados menos quem publicou; título "📌 Aviso novo em <comunidade>", corpo = título do aviso (até 100 caracteres, com "…"); o texto completo fica no app. Rota `/avisos?comunidade=<id>`. Apagar não notifica.
- **LGPD:** exporta e apaga os avisos escritos pela pessoa (título, texto e data). Avisos de quem só saiu da comunidade ficam, mostrados como "Ex-membro".

## Pendências

- Prints e conferência visual (web, Android, iOS; escuro e claro) e o checklist da §14 do DESIGN.
- Universal link `/avisos/*` (item 12) e pergunta da LGPD (item 16) para o humano.
- Paginação do mural, se crescer.
