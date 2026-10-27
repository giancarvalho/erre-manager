# LGPD: dados pessoais, exportação e exclusão

O que o app guarda sobre uma pessoa, como ela recebe uma cópia e como quem opera o sistema apaga tudo (Sprint 19, D-050).

## O que fica guardado

| Onde | O quê | Por quê |
|---|---|---|
| Conta (`auth_user`, `auth_account`) | e-mail e vínculo com o Google | entrar |
| Sessões (`auth_session`) | token de sessão; **sem IP e sem user agent** | manter a pessoa conectada |
| Perfil (`core_profiles`) | nome de exibição e cor do avatar | aparecer pra comunidade |
| Memberships | comunidade, papel, situação e datas | acesso |
| Notificações | preferências por tipo; aparelhos inscritos (token do serviço de push) | avisos |
| Errômetro | participação na votação, comentários escritos, troféus | o jogo |
| Eventos | inscrições, eventos criados, troféus | o jogo |

**Votos não são dados pessoais ligáveis:** a cédula chega por uma rota sem sessão, autorizada só pela assinatura cega, e é guardada com um código (`voter_tag`) derivado do token, que o servidor não consegue ligar a quem o pediu (R-ANON-01 a 03). A emissão do token guarda só "pessoa X retirou um token da rodada Y", sem horário. Por isso votos não entram na exportação e não há como apagar "os votos de alguém".

## Exportação

`GET /v1/me/export` (a própria pessoa, com sessão), também em **Perfil → Baixar meus dados**. Devolve um JSON com a conta, as preferências, os aparelhos (só tipo e data: o token de push é credencial do serviço, não dado sobre a pessoa) e, por comunidade, a membership e a parte de cada módulo (`data.export` do contrato).

## Exclusão (v1: feita por quem opera o sistema)

1. A pessoa pede a exclusão a quem administra o app (canal a definir na política de privacidade).
2. Quem opera chama, com o segredo de `ADMIN_SECRET`:
   ```
   curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" https://<api>/v1/internal/users/<id>/delete
   ```
3. Se a pessoa for a **única dona** de uma comunidade que ainda tem outros membros, a API recusa (`409 SOLE_OWNER`, com o nome das comunidades): primeiro outra pessoa vira dona.
4. Em cada comunidade, cada módulo apaga a sua parte (`data.delete`); depois saem a membership e a conta, que leva junto sessões, vínculo com o Google, perfil, aparelhos e preferências.

**O que fica:** votos anônimos e resultados já fechados que tinham a pessoa como alvo continuam, com um id que não aponta mais para ninguém (o perfil sumiu, então o nome não aparece). Eventos que a pessoa criou continuam (são da comunidade). Comentários escritos por ela **e** sobre ela são apagados.

O id interno da pessoa aparece em `GET /v1/communities/:id/members` (`userId`), visível a quem administra a comunidade.

## Para quem escreve um módulo

Declare `data: { export, delete }` em `defineModuleApi` se o módulo guarda algo ligado a uma pessoa (CONTRATO §4.6). Os dois rodam na transação da comunidade, sem sessão. `export` devolve JSON legível (ou `null`); `delete` apaga tudo o que é dela. Nunca exporte nem apague por pessoa algo que seja anônimo.
