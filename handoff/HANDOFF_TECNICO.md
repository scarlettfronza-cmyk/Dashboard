# ADS Dashboard | Handoff Técnico

**Projeto:** ADS Dashboard, Escarlate Digital  
**Produto:** Plataforma multi-cliente para operação e relatórios de Meta Ads, vendas e conteúdo orgânico.  
**Domínio publicado:** `https://dashboard.escarlatedigital.com`  
**Estado de referência:** checkpoint Manus `ef918246`  
**Stack:** React 19, TypeScript, Vite, Tailwind 4, Express 4, tRPC 11, Drizzle ORM, MySQL/TiDB, Vitest e pnpm.

> Este pacote contém código e documentação, mas **não contém** banco de dados, tokens, chaves, senhas, arquivos `.env` ou backup SQL. Esses itens devem ser transferidos separadamente por um canal seguro.

## 1. Objetivo do sistema

O dashboard permite que a agência Escarlate Digital gerencie múltiplas clínicas e clientes. Ele reúne dados de Meta Ads, Meta/Instagram, Monday.com, planilhas de vendas e CRM para apresentar investimento, leads, consultas, fechamentos, receita, ROAS, criativos e conteúdos. Também gera relatórios com IA e pode enviá-los por WhatsApp.

O produto possui três experiências principais:

| Experiência | Rota | Público |
|---|---|---|
| Painel administrativo | `/dashboard`, `/settings` | Proprietária da agência autenticada por Manus OAuth |
| Painel de gestor | `/manager/*` | Gestores internos autenticados por senha e JWT próprio |
| Relatório público da clínica | `/r/:token` | Cliente final, sem login e apenas por token imprevisível |

## 2. Estrutura do repositório

| Diretório | Conteúdo principal |
|---|---|
| `client/src/pages` | Telas React. Os pontos mais importantes são `Dashboard.tsx`, `Settings.tsx`, `ManagerDashboard.tsx`, `ManagerClientSettings.tsx`, `ManagerLogin.tsx` e `PublicClientReport.tsx`. |
| `server/routers.ts` | Router tRPC administrativo e rotinas principais de clientes, relatórios e Meta. |
| `server/routers/managers.ts` | Router tRPC do painel de gestores e validação por carteira de clientes. |
| `server/routers/public.ts` | Dados expostos ao relatório público, sempre por token de relatório. |
| `server/metaApi.ts` | Chamadas à Graph API para anúncios, criativos, leads e Instagram. |
| `server/metaOAuth.ts` | Fluxo OAuth Meta, state assinado e callback. |
| `server/managerAuth.ts` e `server/managerAuthSecret.ts` | Validação de JWT de gestores e segredo dedicado. |
| `server/secretCipher.ts` | Cifra de integração em repouso. |
| `server/mondaySync.ts` | Sincronização de dados comerciais no Monday. |
| `server/zapApi.ts` | Envio de relatórios pelo Z-API. |
| `drizzle/schema.ts` | Fonte de verdade do schema Drizzle. |
| `drizzle/*.sql` | Migrações numeradas de `0000` a `0029`. |
| `server/*.test.ts` | Cobertura Vitest de regras de negócio e segurança. |

## 3. Domínio de dados

As tabelas mais relevantes são `clients`, `integrations`, `snapshots`, `managers`, `manager_clients`, `sales_records`, `system_settings`, `report_config`, `report_chat_history`, `lead_ad_matches`, `capi_events`, `creativeAnalyses`, `creativeBriefs`, `creativeAssets`, `beforeAfterPairs` e `beforeAfterCreatives`.

`clients` contém parâmetros comerciais e identidade de cada clínica. `integrations` concentra credenciais por cliente, por exemplo `meta_token`, `meta_ads`, `instagram_oauth` e `monday`. A coluna `publicToken` em `clients` alimenta o acesso público. O banco deve ser tratado como dado sensível, pois pode conter dados comerciais, registros de vendas e identificadores ligados a pacientes.

## 4. Integrações externas

| Serviço | Finalidade no projeto | Ponto de código |
|---|---|---|
| Meta Graph API | Meta Ads, contas, criativos, leads, Instagram e OAuth | `server/metaApi.ts`, `server/metaOAuth.ts` |
| Monday.com | Consultas, fechamentos e receita | `server/mondaySync.ts`, `server/mondayCron.ts` |
| Z-API | Envio de relatório por WhatsApp | `server/zapApi.ts` |
| Telegram Bot API | Alertas de saldo, auditoria e operação | `server/budgetCron.ts`, rotas de auditoria |
| Manus Storage / S3 | Arquivos, imagens, uploads e assets | `server/storage.ts` |
| Manus LLM | Análises e relatórios de IA | `server/_core/llm.ts`, `server/routers/ai.ts` |
| Resend | **Ainda não ativado.** Planejado para recuperação de senha por e-mail. | Pendente |

## 5. Segurança já implementada

1. **Relatório público por token:** o acesso público usa `/r/:token`. Slugs previsíveis não devem voltar a ser aceitos como acesso público.
2. **Auditoria pública:** há registro de acessos aos relatórios e alerta para padrão incompatível com o isolamento esperado.
3. **Tokens de integração cifrados:** credenciais persistidas são tratadas por `server/secretCipher.ts`. Não substituir helpers centrais por leitura de texto simples.
4. **JWT de gestores:** gestores usam `MANAGER_JWT_SECRET`, separado dos demais segredos. O código não deve voltar a usar segredo de fallback.
5. **OAuth Meta:** o state é assinado e armazenado em banco com expiração e consumo único. As migrações `0028_high_king_bedlam.sql` e `0029_clumsy_zarda.sql` são parte desse fluxo.
6. **Seleção explícita de Instagram:** após OAuth, o sistema não pode escolher automaticamente a primeira Página ou perfil retornado pela Meta. A pessoa responsável deve escolher o perfil correto antes de ativar `instagram_oauth`.

## 6. Fluxo Meta e Instagram

O App Meta usa `https://dashboard.escarlatedigital.com/api/meta/callback` como callback. O domínio `dashboard.escarlatedigital.com` precisa estar configurado no App Meta e a URL deve ser cadastrada exatamente em Login do Facebook para Empresas.

O fluxo esperado é: gestor ou admin autorizado gera o link OAuth, a Meta retorna `code` e `state`, o callback consome o state uma única vez, grava uma autorização pendente e exibe os perfis Instagram disponíveis. Só após a seleção explícita o perfil é associado ao cliente.

**Piloto validado:** Dr. Mario Bongiolo, cliente `30001`, conta de anúncios `act_1625411728898223`, Instagram correto `@drmariobongiolo`, ID `17841402950971975`. O ID histórico incorreto associado a conteúdo da Dra. Tatiana era `17841400156606538`; ele não deve voltar a ser associado ao Dr. Mario.

## 7. Execução local

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm dev
```

Para produção:

```bash
pnpm build
pnpm start
```

Para migrations, mantenha schema e banco sincronizados:

```bash
pnpm drizzle-kit generate
# revisar o SQL gerado
pnpm drizzle-kit migrate
```

Nunca aplique migrations não revisadas diretamente em produção. Sempre faça backup seguro antes de alterar schema ou dados.

## 8. Variáveis de ambiente

Consulte `handoff/.env.example`. As credenciais reais devem ser entregues apenas pelo proprietário, via gerenciador de senhas ou secret manager. Nunca devem constar em chat, Git, ZIP ou ticket público.

## 9. Situação atual e prioridades

### Funcionalidades principais concluídas

O produto possui dashboards por cliente, painéis de gestor, relatório público, Meta Ads, Instagram, Monday, upload XLSX, análise de IA, relatório WhatsApp, Creative Analyst, Creative Agent, Campaign Agent, ranking de oportunidades e mapeamento comercial.

### Pendências prioritárias

| Prioridade | Pendência | Observação |
|---|---|---|
| Crítica | Estabilizar login e carregamento no painel de gestores | Após a introdução do segredo dedicado de gestores, houve relatos de sessão expirada e dashboards sem dados. Diagnosticar antes de ampliar OAuth. |
| Alta | Recuperação de senha por e-mail | Depende de domínio verificado e chave do Resend. |
| Alta | Reconexão Meta em lotes | Fazer no máximo 3 ou 4 clínicas por lote e registrar o perfil escolhido. |
| Alta | Monday rate limit e permissões | Logs recentes mostram respostas 403 e 429 em sincronização automática. Rever cron, token e intervalo antes de novas expansões. |
| Média | Política, termos, contrato de tratamento e cobrança | Pré-requisitos antes de venda pública para gestores externos. |
| Média | Histórico de planos aprovados do Campaign Agent | Ainda não persistido. |

## 10. Procedimento operacional recomendado

1. Corrigir e validar login de gestores antes de abrir qualquer nova conexão Meta.
2. Configurar Resend no subdomínio `envio.escarlatedigital.com`, verificar DNS e implementar recuperação de senha por token de uso único.
3. Para Meta, selecionar três clínicas conhecidas por lote. Para cada uma, registrar cliente, conta de anúncio, perfil `@`, ID do perfil, investimento visível, criativos visíveis e confirmação visual do relatório público.
4. Interromper o lote se uma clínica receber perfil, investimento ou criativos incorretos.
5. Não copiar dados de produção para repositórios públicos. Não incluir tokens, dados de pacientes ou backup SQL em canais informais.

## 11. Transferência de banco e dados

O arquivo de código sanitizado não inclui dados de produção. O proprietário deve entregar ao TI, por canal seguro e com acesso restrito:

1. Export seguro do banco MySQL/TiDB.
2. Lista de credenciais em gerenciador de senhas.
3. Acesso ao DNS de `escarlatedigital.com` e ao App Meta.
4. Acesso à conta Monday, Z-API, Telegram e storage.
5. Registro de quais clínicas receberam reconexão Meta e qual perfil foi confirmado.

O TI deve executar a restauração em ambiente isolado, migrar o banco, testar `pnpm check` e `pnpm test`, validar o login de gestor e só então apontar domínio ou alterar produção.

