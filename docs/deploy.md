# Deploy

O que já está pronto e não depende de onde vai ficar hospedado (P-010). Quem executa em produção é o humano (AGENTS.md, regra 1).

## API: imagens

`apps/api/Dockerfile`, com o contexto na raiz do repositório:

```sh
docker build -f apps/api/Dockerfile -t erre-api .                       # API (alvo padrão)
docker build -f apps/api/Dockerfile --target migrate -t erre-migrate .  # migrations
```

- Multi-stage com `turbo prune @erre/api`: mudanças fora da API e de suas dependências não invalidam o cache.
- As imagens finais têm só o Node e o JavaScript empacotado pelo esbuild (`apps/api/build.mjs`): sem `node_modules`, sem código-fonte. Rodam como `node`, não root. A da API tem `HEALTHCHECK` em `/v1/health`.
- A imagem `migrate` leva o CLI de migrations e os `.sql` de `packages/*/migrations` e `modules/*/db/migrations`.

## Ordem de uma publicação

1. **Uma vez por banco:** criar os papéis com `pnpm --filter @erre/db db:bootstrap` (superusuário, senhas `ERRE_*_PASSWORD` fortes). Manual, pelo humano.
2. **A cada versão, antes da API nova subir:** `docker run --rm -e DATABASE_MIGRATOR_URL=... erre-migrate`. Conecta como `erre_migrator`, aplica o que falta em transações separadas, com trava (`pg_advisory_lock`), e não faz nada se já estiver em dia. Nunca faz rollback em produção.
3. **API:** `erre-api` com as variáveis de `apps/api/.env.example`. `DATABASE_URL` é `erre_app` e `DATABASE_JOBS_URL` é `erre_jobs`. A API não recebe a URL do `erre_migrator` nem a do superusuário.
4. **Jobs:** o agendador roda dentro da API (`node-cron`). Com mais de uma instância, cada uma rodaria os jobs; na v1, use **uma instância** (os limites de requisição também são por instância, D-050).

## Só quando a API ou suas dependências mudarem

`.github/workflows/api-image.yml` compara com a base (PR) ou com o commit anterior (push) usando `turbo ls --filter=...[base]`. Se `@erre/api` não estiver entre os afetados, não faz nada. Se estiver, constrói as duas imagens e roda `apps/api/scripts/smoke-image.sh`: banco descartável, papéis, `migrate` duas vezes (a segunda tem de ser no-op), API de pé, `/v1/health` 200, rota de módulo 401, processo sem root. **Ainda não publica imagem nem faz deploy:** registro e servidor dependem de P-010.

O mesmo teste roda localmente:

```sh
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres apps/api/scripts/smoke-image.sh
```

## Web (PWA)

`pnpm --filter @erre/mobile build` gera `apps/mobile/dist`, um site estático. O servidor que hospedar precisa de:

- HTTPS;
- fallback de qualquer rota para `index.html` (SPA);
- `/.well-known/apple-app-site-association` com `Content-Type: application/json` (sem extensão) e `/.well-known/assetlinks.json`;
- variáveis de build `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_WEB_URL` (sem `EXPO_PUBLIC_DEV_GALLERY` em produção).

## App (EAS)

`apps/mobile/eas.json` tem três perfis, todos sem envio às lojas (backlog):

| Perfil | Para quê | Distribuição |
|---|---|---|
| `development` | testes em aparelho e simulador | interna, APK e simulador iOS |
| `preview` | testes com o grupo antes de publicar | interna (APK) |
| `production` | build de loja, número de build automático | — |

As variáveis (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`) ficam nos ambientes do EAS (`development`, `preview`, `production`), não no repositório.

### Build Android no CI (`.github/workflows/android.yml`)

Roda no EAS a cada push na `main` que mexe no app (perfil `preview`) ou à mão (Actions → Android build → Run workflow). Sem o segredo `EXPO_TOKEN`, só avisa e passa. Configuração, uma vez:

1. **Conta:** crie uma conta (ou organização) em expo.dev.
2. **Projeto:** na sua máquina, em `apps/mobile`: `npx eas-cli@latest login` e `npx eas-cli@latest init`. O `init` cria o projeto e grava `extra.eas.projectId` e `owner` no `app.json`: faça commit disso.
3. **Assinatura:** `npx eas-cli@latest credentials -p android` → perfil `preview` → gerar uma keystore nova (fica guardada no EAS). O build no CI não é interativo e não consegue criar a keystore sozinho. Antes, confirme o `android.package` (`com.erre.app`): ele não muda depois que o app for para a loja.
4. **Variáveis do app** por ambiente: `npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://... --visibility plaintext` (e `EXPO_PUBLIC_WEB_URL`). Nunca `EXPO_PUBLIC_DEV_GALLERY` em `production`.
5. **Token:** expo.dev → Account settings → Access tokens → criar (de preferência de um "robot user" da organização, com acesso só ao projeto). No GitHub: Settings → Secrets and variables → Actions → New repository secret, nome `EXPO_TOKEN`.
6. **Teste:** Actions → Android build → Run workflow (`preview`). O log traz o link do build; o APK sai em expo.dev → projeto → Builds, com QR code para instalar.

O plano gratuito do EAS tem fila e limite mensal de builds: por isso o automático é só na `main`, e o job não espera o build terminar (`--no-wait`). Um cliente de desenvolvimento (`expo-dev-client`) não foi adicionado: seria uma dependência nova a validar nas três plataformas.

## Pendente (P-010)

- Onde ficam a API, o banco e a web (mesmo servidor do legado? CDN?).
- Registro de imagens e o passo de deploy no workflow.
- Staging com dados falsos: o `seed:dev` do core recusa qualquer banco que não seja local. Para staging, falta decidir o banco e liberar o seed nele explicitamente.
