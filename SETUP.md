# Como rodar fora do Manus

O sistema não depende da plataforma Manus para funcionar. Só os recursos de IA e
de storage usam serviços dela; o resto — dashboard, painel de gestor, relatório
público, Meta, Monday e WhatsApp — roda em qualquer lugar com Node e MySQL.

## 1. Requisitos

Node 20 ou superior, pnpm 10 e Docker (ou um MySQL 8 próprio).

## 2. Banco

```bash
docker compose up -d          # sobe MySQL 8 em localhost:3306
```

### Restaurar o backup de produção

O `backup.sql` **não está neste repositório** — ele contém dados de pacientes,
faturamento e hashes de senha. Mantenha-o fora do git, num local seguro.

```bash
docker exec -i ads-dashboard-db \
  mysql -uroot -pdev ads_dashboard < /caminho/para/backup.sql
```

Para começar com o banco vazio, pule o comando acima e use as migrações:

```bash
pnpm db:push
```

## 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Gere cada segredo separadamente — nunca reutilize o mesmo valor entre eles:

```bash
openssl rand -hex 32        # uma vez para cada um dos quatro
```

`JWT_SECRET`, `MANAGER_JWT_SECRET`, `OAUTH_STATE_SECRET` e
`INTEGRATION_ENCRYPTION_KEY` são obrigatórios. Trocar
`INTEGRATION_ENCRYPTION_KEY` depois de já ter tokens salvos torna esses tokens
ilegíveis: se isso acontecer, reconecte as integrações.

## 4. Subir

```bash
pnpm install
pnpm dev                    # http://localhost:3000
```

Verificações rápidas: `pnpm check` (typecheck) e `pnpm test` (Vitest).

## 5. Reconectar o Meta

O login administrativo (`/dashboard`, `/settings`) usa OAuth do Manus e não
funciona fora dela. O **painel de gestor não** — ele tem autenticação própria por
senha e JWT.

Então, para reconectar o Meta sem depender do Manus:

1. entre em `/manager/login`;
2. abra a configuração do cliente;
3. cole um token do Meta no campo próprio — o sistema valida e lista as contas
   de anúncio (`server/routers/managers.ts:326`).

Escopos que o token precisa ter:

| Escopo | Para quê |
|---|---|
| `ads_read`, `business_management` | investimento, CPL, ROAS |
| `instagram_basic`, `instagram_manage_insights` | seguidores e conteúdo |
| `pages_show_list`, `pages_read_engagement` | páginas ligadas ao Instagram |

> **Atenção à versão da API.** `server/metaApi.ts` usa a Graph API **v19.0**,
> de janeiro de 2024. O Meta aposenta versões em cerca de dois anos. Se as
> chamadas falharem com erro de versão, atualize a constante nesse arquivo —
> o token não será o problema.

## 6. Dados históricos de investimento

A tabela `snapshots` veio vazia no backup, então investimento, CPL e ROAS de
meses passados não estão na base. A API do Meta guarda histórico de campanha
por cerca de 37 meses, então esses números podem ser repuxados depois que a
integração estiver ativa.
