# Sprint 18 — Perfil, troféus, página de membro, preferências e PWA

## O que foi feito

- Perfil próprio: nome, cor do avatar, troféus da comunidade atual (seções dos módulos), notificações, aparência, instalar o app, sair. Entrada pelo avatar no canto do hub.
- Página de membro com as seções de perfil de todos os módulos ligados; links a partir da lista de membros, dos rankings (Errômetro e Eventos) e dos inscritos de um evento.
- Landing em `/entrar` com a marca, os limites reais e "Como funciona" (sem grupo demo).
- PWA: manifest, ícones estáticos (incluindo maskable e iOS), imagem de compartilhamento, meta tags; pós-build com URL absoluta da imagem e arquivos `.well-known` quando houver os valores de deploy.
- Core: `PATCH /v1/me/profile` com a cor do avatar.

## Testes

- Core: troca de cor sem confirmar o nome, cor inválida e corpo vazio recusados.
- App (jest): página de membro com os renderizadores reais do Errômetro e de Eventos; perfil pelo avatar do hub, validação do nome, troca de nome e de cor; manifest em dia com os tokens e ícones existentes; `.well-known` e URL absoluta.
- E2E: landing e arquivos do PWA (manifest, ícones, imagem); perfil (nome, cor) e página de membro pela lista. Suíte web com os fluxos principais: login, entrar por convite, votar, ver resultado, criar e votar em evento, perfil.
- `pnpm check` e e2e verdes.

## Prints (DESIGN §14)

`sprint-18/landing-dark.png`, `perfil-light.png`, `membro-dark.png`. Android e iOS: pendente de aparelho.

## Decidido

- D-049 (`[contrato]`). P-003 (A) e P-008 (ícones e OG estáticos) implementadas como provisórias. Pergunta nova: **P-019** (nome do app: "Erre" ou "Errômetro").

## Itens de `PARIDADE.md`

CORE-01, CORE-14, CORE-15, CORE-20, CORE-21, ERR-21 e EVT-12 concluídos na web; CORE-22 com o gerador pronto.

## Pendente

- Links universais de verdade: domínio de produção, Team ID da Apple, certificado do Android e `associatedDomains`/`intentFilters` no app (Sprint 19, com o deploy).
- Instalação testada em Android e iPhone reais.
- CORE-23 (páginas de erro): as telas usam `ErrorState`; um "erro inesperado" global fica para o Sprint 19.

## Riscos

- P-019: a web diz "Errômetro" e a loja diria "Erre".

## Contrato `[contrato]`

- Módulos precisavam abrir o perfil de alguém sem conhecer as rotas do core: `ModuleHost.openMember(userId)`.
