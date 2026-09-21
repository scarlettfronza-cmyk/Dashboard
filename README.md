# ADS Dashboard — Escarlate Digital

Plataforma multi-cliente para operação e relatórios de Meta Ads, vendas e conteúdo orgânico.

**Stack:** React 19 · TypeScript · Vite · Tailwind 4 · Express 4 · tRPC 11 · Drizzle ORM · MySQL/TiDB · Vitest · pnpm

**Para colocar no ar, sem programar, veja [`DEPLOY.md`](DEPLOY.md).**
**Para rodar na sua máquina, veja [`SETUP.md`](SETUP.md)** — banco, variáveis de
ambiente, restauração do backup e reconexão do Meta fora da plataforma Manus.

A documentação técnica completa está em [`handoff/HANDOFF_TECNICO.md`](handoff/HANDOFF_TECNICO.md).

## Experiências

| Experiência | Rota | Público |
|---|---|---|
| Painel administrativo | `/dashboard`, `/settings` | Proprietária da agência |
| Painel de gestor | `/manager/*` | Gestores internos (senha + JWT) |
| Relatório público | `/r/:token` | Cliente final, sem login |

## Como rodar

```bash
docker compose up -d   # MySQL 8 local
cp .env.example .env   # preencha os segredos (veja SETUP.md)
pnpm install
pnpm db:push           # aplica as migrações Drizzle
pnpm dev               # http://localhost:3000
```

`pnpm test` roda a suíte Vitest, `pnpm check` o typecheck e `pnpm build` o build
de produção.

## Origem deste repositório

Este código veio de um export da plataforma Manus (`ads-dashboard_3.zip`).
Na importação foram **deliberadamente excluídos**:

- `.manus/` — dumps de consultas ao banco de produção, contendo tokens de acesso Meta/Instagram e Monday **em texto plano**;
- `backup.sql` — dump do banco de produção, com dados de clientes, registros de vendas e hashes de senha de gestores;
- `dist/` — artefato de build.

Esses arquivos **nunca devem ser versionados**. O `.gitignore` já bloqueia os três.
Se precisar dos dados, transfira-os por canal seguro, fora do repositório.

## Segurança

Antes de qualquer deploy, confira `handoff/HANDOFF_TECNICO.md`, seção "Segurança já implementada".
Pontos que não podem regredir:

- tokens de integração cifrados em repouso (`server/secretCipher.ts`);
- `MANAGER_JWT_SECRET` separado de `JWT_SECRET` e de `OAUTH_STATE_SECRET`, sem fallback;
- acesso público apenas por token imprevisível em `/r/:token`, nunca por slug;
- state do OAuth Meta assinado, com expiração e consumo único;
- seleção explícita do perfil Instagram após o OAuth.
