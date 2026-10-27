# Sprint 19 — Segurança, LGPD, deploy e paridade final

## O que foi feito

- **Segurança:** limites de requisição no runtime de módulos (por pessoa, emissão de token, rota anônima por comunidade, nunca por IP), headers de segurança, teste do cookie em HTTPS. Revisão rota a rota em `docs/seguranca.md`.
- **LGPD:** `data.export`/`data.delete` no contrato, implementados no core, no Errômetro e em Eventos; `GET /v1/me/export` ("Baixar meus dados" no perfil) e exclusão por quem opera (`ADMIN_SECRET`). `docs/lgpd.md`.
- **Desempenho** (`docs/desempenho.md`): typecheck e latência medidos. A emissão de token levava ~350 ms de CPU por pedido e travava o event loop; passou para ~1 ms no OpenSSL, com saída idêntica (testado contra a biblioteca e a RFC 9474). Índices auditados no banco inteiro; dois corrigidos.
- **Deploy** (`docs/deploy.md`): `apps/api/Dockerfile` (turbo prune; imagens só com o bundle, sem root), imagem de migrations separada, workflow que constrói e testa as imagens só quando a API ou suas dependências mudam, perfis EAS. Nada publicado: espera P-010.
- **Paridade:** legado confirmado em `7c5c5bf`. Fechados os dois itens que faltavam: entrar colando o convite (CORE-07) e páginas de erro (CORE-23).
- **Plano de dados:** `MAPEAMENTO-DADOS.md` revisado contra o schema inteiro. O ETL pode **preservar os ids de usuário**, então não precisa reescrever ids nos snapshots (testado: login Google cai no mesmo id e vincula usuário criado só com e-mail).

## Testes

Rate limit, headers, cookie, exportação e exclusão de ponta a ponta, auditoria de índices, equivalência da assinatura cega, login de usuários migrados, colar convite e 404 (jest e e2e), smoke das imagens (local e CI). `pnpm check` e e2e verdes.

## Prints (DESIGN §14)

`sprint-19/convite-{dark,light}.png`, `nao-encontrada-{dark,light}.png`. Android e iOS: pendente de aparelho.

## Decidido

D-050 (`[contrato]`: limites, LGPD), D-051 (assinatura cega nativa, imagem da API).

## Para a revisão final de paridade (gate humano)

- **Concluído só na web, aparelho pendente:** todas as telas dos Sprints 14 a 19 (lista em `PARIDADE.md`, status "aparelho pendente").
- **Provisórios a confirmar:** P-003 A (sem demo: ERR-10, ERR-22, OUT-02), P-007 A, P-008 A, P-014 B, P-017, P-018 A.
- **Fora da v1:** OUT-01 (mural, backlog); CORE-03, OUT-03, OUT-04 descartados.

## Pendente

- P-010 (hospedagem): registro de imagens, passo de deploy, web hospedada, staging com dados falsos.
- Valores de produção: domínio, credenciais Google, VAPID, projeto EAS, Apple Team ID, certificado Android.

## Perguntas novas

P-020 (contas só com usuário + chave), P-021 (mesma pessoa com duas contas). Também entrou na tabela a P-019, que faltava.

## Contrato

- `[contrato]` `data.export`/`data.delete` saíram simples de implementar porque cada módulo já recebe `tx` e `communityId`. O que doeu: o módulo precisa saber quais tabelas citam a pessoa; o template do hackathon deve gerar esse arquivo junto com o schema.
