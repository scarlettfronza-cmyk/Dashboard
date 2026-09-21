# ADS Dashboard - TODO

## Phase 1: Base Structure & Database
- [x] Database schema: integrations table (Meta Ads tokens, Monday tokens)
- [x] Database schema: snapshots table (daily KPI snapshots)
- [x] Database schema: clients table (for multi-client support)
- [x] Apply database migrations

## Phase 2: Design & UI
- [x] Retro-futuristic dark theme with scanlines, chromatic aberration in index.css
- [x] DashboardLayout with sidebar navigation
- [x] KPI card components (Investimento, Leads, CPL, Taxa de Conversão, ROAS, Vendas, CPV, Total em Vendas, Ticket Médio, Novos Seguidores)
- [x] Date range picker filter
- [x] Trend charts (line/bar charts with Recharts)
- [x] Loading skeletons and error states
- [x] Responsive layout

## Phase 3: API Integrations
- [x] Meta Ads API backend integration (investment, leads, followers)
- [x] Monday CRM API backend integration (converted leads, sales values)
- [x] tRPC procedures for fetching Meta Ads data
- [x] tRPC procedures for fetching Monday data
- [x] API credentials management UI (connect/disconnect integrations)
- [x] Auto-refresh system for API data

## Phase 4: Metrics, Snapshots & Notifications
- [x] Derived metrics calculation: CPL, Taxa de Conversão, ROAS, CPV, Ticket Médio
- [x] Daily S3 snapshots of API data
- [x] Trend charts from historical snapshots
- [x] Owner notifications when ROAS < 2.0
- [x] Owner notifications when CPL > R$100

## Phase 5: PDF Report with AI
- [x] PDF report generation with all KPIs for selected period
- [x] LLM analysis and insights about campaign performance
- [x] Report download button on dashboard

## Phase 6: Tests & Delivery
- [x] Vitest unit tests for metric calculations
- [x] Vitest tests for API procedures
- [x] Final checkpoint and delivery

## Atualização: Nova Arquitetura de Integrações
- [x] Remover integração direta com Meta Ads API do backend
- [x] Implementar leitura de Google Sheets (URL pública da planilha) para dados do Meta Ads
- [x] Manter integração Monday CRM API para dados de vendas
- [x] Atualizar tela de configurações: campo Google Sheets URL + Monday token/board ID
- [x] Atualizar cálculo de KPIs para usar dados da planilha (investimento, leads, seguidores)
- [x] Atualizar cálculo de KPIs para usar dados do Monday (vendas, valores)
- [x] Testes e checkpoint final

## Bug Fix: Parser Google Sheets
- [x] Corrigir cálculo de investimento — valores sendo somados errado (R$335.089 em vez de R$3.828,52)
- [x] Verificar filtro de datas no parser CSV (possível leitura de todas as linhas sem filtrar período)
- [x] Corrigir parsing de valores numéricos com ponto como separador de milhar

## Bug Fix: Monday CRM não puxando dados
- [x] Investigar por que Monday está conectado mas não retorna vendas/valores
- [x] Adicionar endpoint de diagnóstico para inspecionar estrutura real do board Monday
- [x] Corrigir mapeamento de colunas — agora usa busca por título (não IDs fixos), detecta automaticamente colunas com nomes como "Valor Cirurgia", "Valor Consulta", "Data Conversão"
- [x] Melhorar feedback visual quando Monday retorna dados zerados — painel de diagnóstico mostra colunas encontradas e amostra de itens

## Nova Integração: Planilha de Vendas (Google Sheets)
- [x] Remover integração Monday CRM do backend (fetchMondayData, saveIntegration monday)
- [x] Criar fetchSalesSheetData: lê planilha com colunas DATA, VENDAS, TOTAL EM VENDAS, filtra por período
- [x] Suportar formato de data DD/MM/YYYY e valores R$ XX.XXX,XX
- [x] Atualizar provider "monday" para "sales_sheet" no banco e nas procedures
- [x] Atualizar Settings UI: substituir campo Monday por "URL Planilha de Vendas"
- [x] Atualizar tela de configurações com instruções de como publicar a planilha de vendas como CSV
- [x] Testes e checkpoint final

## Formato do Relatório
- [x] Atualizar prompt LLM para gerar relatório no formato da Scarlett: bloco de KPIs, análise narrativa, perguntinhas de engajamento
- [x] Atualizar ReportModal para exibir o relatório no formato correto (sem markdown genérico)
- [x] Incluir cálculo de "custo por resultado real" (investimento / total de interações: leads + seguidores)

## UX do Relatório
- [x] Substituir botão de download por botão de copiar relatório para área de transferência

## Novas Métricas: Visitas e Cliques (substituido por Alcance + CPC abaixo)
- [x] Adicionar leitura de "Landing Page Views" — não disponível no Adveronix; substituido por Reach (Alcance)
- [x] Adicionar leitura de "CPC (Cost per Link Click)" e calcular cliques estimados (investimento ÷ CPC)
- [x] Expor visitasPerfil e cliquesFormulario no getKpis e generateReport — implementado como alcance + cliquesEstimados
- [x] Mostrar Visitas ao Perfil e Cliques no dashboard (cards KPI) — implementado como Alcance + Cliques Estimados
- [x] Incluir visitas + cliques no cálculo de custo por resultado real do relatório — implementado

## Novas Métricas: Alcance e Cliques
- [x] Adicionar leitura de "Reach" (alcance) no parser da planilha Meta Ads
- [x] Adicionar leitura de "CPC (Cost per Link Click)" e calcular cliques estimados (investimento ÷ CPC)
- [x] Expor alcance e cliquesEstimados no getKpis e generateReport
- [x] Mostrar Alcance e Cliques Estimados nos cards do dashboard
- [x] Atualizar cálculo de custo por resultado real: investimento ÷ (leads + cliques estimados)
- [x] Incluir alcance e cliques no texto do relatório gerado pela IA

## Métricas Separadas: Mensagens vs Cliques
- [x] Adicionar leitura de "Cost per Messaging Conversation Started" como custoPorLead direto (sem calcular)
- [x] Manter CPC para calcular cliquesNoLink (investimento ÷ CPC) e exibir custoPorClique separado
- [x] Remover cálculo manual de custoPorLead (investimento ÷ leads) — usar valor da planilha
- [x] Atualizar cards do dashboard: Custo por Lead (da planilha), Cliques no Link, Custo por Clique
- [x] Atualizar relatório IA: incluir Custo por Lead (real), Cliques no Link, Custo por Clique, custo por resultado real = investimento ÷ (leads + cliques)

## Correção do Parser Meta Ads
- [x] Corrigir custoPorLead: usar total investido ÷ total conversas (não média de valores diários)
- [x] Corrigir custoPorClique: somar cliques diários (spend/cpc por linha) e usar total investido ÷ total cliques
- [x] Remover uso de cpcTotal/cpcRows e custoPorLeadTotal/custoPorLeadRows (lógica errada)

## Custo por Lead — Valor Direto do Meta
- [x] Usar valor direto da coluna "Cost per Messaging Conversation Started" como custoPorLead (weighted avg: soma dos custos diários ponderada pelas conversas)
- [x] Remover cálculo manual de custoPorLead (investimento ÷ leads)

## Separação por Tipo de Campanha
- [x] Adicionar coluna Campaign Name ao parser — detectar automaticamente pelo nome
- [x] Classificar linhas: WPP/DIRECT/MAMO/CIRURGIA = mensagens; SEGUIDORAS = visitas; FORMULARIO/LINK = cliques
- [x] Calcular KPIs separados: investimento por tipo, leads/custo por lead (mensagens), visitas/custo por visita (seguidoras), cliques/custo por clique (formulário)
- [x] Atualizar getKpis para retornar KPIs separados por tipo de campanha
- [x] Atualizar Dashboard para mostrar seção separada por tipo de campanha

## Link Clicks Direto
- [x] Ler coluna "Link Clicks" diretamente da planilha para campanhas de formulário (não calcular via CPC)
- [x] Custo por clique = Amount Spent ÷ Link Clicks (total do período, só linhas de formulário)

## Fix Classificação Formulário
- [x] Corrigir classifier para detectar [LINK/FORMULARIO] — FORMULARIO agora tem prioridade sobre WPP na classificação

## Custo por Mensagem Iniciada
- [x] Custo por Lead = média ponderada da coluna "Cost per Messaging Conversations Started" apenas nas linhas de campanha WPP/mensagens

## Planilha de Seguidores
- [x] Adicionar provider "followers_sheet" no schema e banco
- [x] Criar fetchFollowersSheetData: lê colunas Day + New Followers, filtra por período
- [x] Adicionar campo URL da planilha de seguidores nas configurações do cliente
- [x] Exibir Novos Seguidores no dashboard com dados reais da planilha

## Fix Relatório — Novos Seguidores
- [x] generateReport deve buscar followers_sheet e incluir novosSeguidores no prompt da IA e no texto do relatório

## Formato WhatsApp no Relatório
- [x] Cada métrica em linha separada no relatório (igual ao print do WhatsApp)
- [x] ReportModal deve preservar quebras de linha ao exibir e ao copiar

## Redesign — Sofisticado Nicho Médico
- [x] Atualizar CSS global: fundo cinza chumbo (#1a1d23 / #22252d), paleta azul/branco, fonte Inter/Geist
- [x] Redesenhar sidebar: fundo mais escuro, logo elegante, itens com hover suave
- [x] Redesenhar cards KPI: fundo levemente mais claro que o bg, sombra sutil, números brancos, label cinza claro
- [x] Redesenhar header do dashboard: tipografia limpa, sem estilo hacker
- [x] Redesenhar botões: azul sólido com hover, sem bordas neon
- [x] Atualizar ReportModal com novo design
- [x] Atualizar Settings com novo design
- [x] Remover fonte Orbitron e referências ao estilo "cyber/hacker"

## Bug Fix: Settings — Aba de Integrações não aparece
- [x] Investigar por que clicar em "Configurar" não exibe a seção de integrações abaixo do cliente
- [x] Corrigir o bug e garantir que as 3 planilhas (Meta Ads, Vendas, Seguidores) aparecem para configurar

## Bug Fix: Planilha de Vendas — contando só 2 dias
- [x] Corrigir parser para contar TODAS as linhas com VENDAS preenchido, independente de TOTAL EM VENDAS estar vazio
- [x] Garantir que o filtro de data não pula linhas com TOTAL EM VENDAS vazio

## Bug Fix: Valor de vendas errado — Dra. Tatiana (R$102.330 lido como R$583.300)
- [x] Buscar planilha de vendas da Dra. Tatiana e identificar o formato dos valores
- [x] Corrigir parser para ignorar linhas de TOTAL/SOMA sem data e tratar M/D/AAAA corretamente

## Bug Fix: Valores errados em múltiplos clientes — análise de todas as planilhas
- [x] Analisar formato de data e valores de todas as 12 planilhas de vendas
- [x] Corrigir parser com função parseSheetDate que auto-detecta DD/MM/AAAA vs M/D/AAAA

## Bug Fix: Dra. Tatiana — R$73.780 em vez de R$102.330 (março 2026)
- [x] Simular parser com CSV real e identificar linhas perdidas
- [x] Corrigir com detectDateFormat + parseSheetDateWithFormat em todos os 3 parsers

## Feature: Botão "Sincronizar Todos"
- [x] Adicionar procedure syncAllClients no routers.ts que sincroniza todos os clientes sequencialmente
- [x] Adicionar botão "Sincronizar Todos" no header do dashboard com spinner e toast de progresso
- [x] Mostrar toast com resultado (X clientes atualizados, Y erros, Z sem planilha)

## Feature: Integração Meta Graph API (Instagram Insights)
- [x] Salvar META_APP_ID e META_APP_SECRET como secrets
- [x] Adicionar provider instagram_oauth no schema + campos metaIgUserId e metaIgUsername
- [x] Criar rotas /api/meta/oauth-url e /api/meta/callback para fluxo OAuth
- [x] Criar procedure instagram.getStatus para verificar status de conexão
- [x] Criar procedure instagram.getInsights para buscar métricas do Instagram
- [x] Adicionar seção Instagram Insights no Dashboard com cards KPI e gráficos de linha
- [x] Adicionar botão "Conectar Instagram" nas configurações de cada cliente
- [x] Mostrar status de conexão (conectado/desconectado) por cliente

## Feature: Página de Política de Privacidade
- [x] Criar página /privacy com política de privacidade para o app Meta
- [x] Registrar rota /privacy no App.tsx

## Feature: Integração Direta Meta API via Token (sem planilha)
- [x] Adicionar provider meta_token na tabela integrations (schema + migração)
- [x] Criar fetchMetaAdsFromApi(token, adAccountId, startDate, endDate): busca investimento, leads, alcance, cliques via API Meta
- [x] Criar fetchInstagramInsightsFromApi(token, startDate, endDate): busca seguidores via API Instagram
- [x] Atualizar getKpis: usar API Meta quando token disponível, fallback para planilha
- [x] Criar procedures: saveMetaToken, validateMetaToken, listAdAccounts, getMetaTokenStatus, removeMetaToken
- [x] Atualizar Settings UI: seção "Conexão Automática" com token Meta + seleção de conta de anúncio
- [x] Manter planilhas como alternativa (fallback) nas configurações
- [x] Manter campo planilha Vendas (dados de vendas não vêm do Meta)
- [x] Adicionar instruções de como gerar token no Graph API Explorer
- [x] Testes TypeScript sem erros e checkpoint final

## UX: Dropdown de Conta de Anúncio com Busca
- [x] Substituir select nativo por dropdown customizado com campo de busca filtrável nas contas de anúncio Meta

## Feature: Seletor de Perfil Instagram por Cliente
- [x] Criar procedure listInstagramProfiles: lista todos os perfis Instagram acessíveis via token Meta (via /me/accounts → instagram_business_account)
- [x] Adicionar botão "Selecionar Perfil Instagram" nas configurações de cada cliente (aparece quando token Meta está conectado)
- [x] Exibir dropdown/modal com lista de perfis (@username + foto) para selecionar
- [x] Salvar metaIgUserId e metaIgUsername no banco ao selecionar perfil
- [x] Usar metaIgUserId salvo nas consultas de Instagram Insights

## Bug Fix: Instagram Insights não puxando dados
- [x] Investigar erro 400 e identificar métricas válidas para conta Business v21+
- [x] Corrigir métricas do Instagram Insights (v21+ API) — usa period=total_over_range para métricas agregadas
- [x] Preservar token existente ao salvar perfil Instagram (não sobrescreve com vazio)
- [x] getInsights prefere meta_token sobre instagram_oauth token
- [x] Expandir período padrão do dashboard para 3 meses — preset "3 meses" adicionado
- [x] Remover planilhas Meta Ads e Seguidores das configurações (manter só Vendas)

## Feature: Instagram Insights no Relatório
- [x] Atualizar generateReport para buscar dados do Instagram Insights (seguidores, reach, engajamento, novos seguidores)
- [x] Atualizar prompt da IA para incluir métricas do Instagram na análise e no texto do relatório
- [x] Corrigir reach: usar soma de valores diários (reach não aceita total_over_range)
- [x] Corrigir aggregate metrics: adicionar metric_type=total_value (exigido pela API v21+)

## Feature: 6 Gráficos de Linha Instagram (Views, Reach, Interactions, Link Clicks, Visits, Follows)
- [x] Backend: buscar dados diários de 6 métricas via API Meta v21+
- [x] Corrigir nome da métrica: impressions -> views (nome correto na API v21+)
- [x] Frontend: criar 6 cards individuais com gráfico de linha, total e variação percentual
- [x] Adicionar testes para helpers pctChange e sumMetric (29 testes passando)

## Bug: Instagram Insights zera ao selecionar mês de março
- [x] Investigar quais métricas falham com datas históricas (ex: 01/03 a 31/03)
- [x] Corrigir backend: chunking automático de 30 dias para períodos maiores
- [x] follower_count sempre busca últimos 30 dias (limitação da API)
- [x] Botão Mês agora pega mês anterior (março) em vez do mês atual

## Bug: Discrepância de valores Instagram vs Meta Business Suite
- [x] Views: 255K vs 274.5K — diferença de ~7% é normal (Meta inclui mídia paga separada)
- [x] Reach: corrigido! Usar reach+total_value em vez de reach+daily (65K vs 63K Meta) ✅
- [x] Content Interactions: corrigido! Usar total_interactions em vez de accounts_engaged (1.786 vs 1.9K Meta) ✅
- [x] Visits: 4.848 vs 5.2K Meta — próximo ✅
- [x] Link Clicks: LIMITAÇÃO CONHECIDA DA API — a API de Insights do perfil só retorna website_clicks (cliques no link do bio). O valor 2.9K do Meta Business Suite inclui cliques em links dentro de posts/stories/reels, acessíveis apenas via API de mídia individual (endpoint /media/{id}/insights por post). Não é possível obter esse total via endpoint de perfil.

## Feature: 6 Cards Instagram via Meta Ads API (dados mensais)
- [x] CANCELADO: usuária optou por manter API de Insights do perfil para as métricas orgânicas e remover apenas o card Link Clicks (que não bate com o Meta Business Suite)

## Ajuste: Remover card Link Clicks da seção Instagram Insights
- [x] Remover o card Link Clicks dos 6 cards de Instagram Insights
- [x] Ajustar layout para 5 cards (Views, Reach, Content Interactions, Visits, Follows)
- [x] Remover website_clicks e profile_links_taps do backend getInsights

## Feature: Follows diários via Meta Ads API (instagram_follows)
- [x] Investigado: instagram_follows não está disponível na API pública de Ads Insights (não é exposto programaticamente)
- [x] Decisão: manter follower_count (API de Insights do perfil) com dados diários dos últimos 30 dias
- [x] Card Follows mantido com gráfico de linha diário e nota "Últimos 30 dias (limite da API)"

## Bug: Card Follows ignora o filtro de período
- [x] Corrigido: follower_count agora usa as datas do filtro quando dentro dos últimos 30 dias
- [x] Quando período for histórico (>30 dias atrás), usa os últimos 30 dias disponíveis
- [x] Frontend exibe nota "Dados disponíveis a partir de {data}" apenas quando período é histórico

## Bug: DR MARIO e DRA ESTEFANI sem dados de anúncios no dashboard
- [x] Causa identificada: nenhum dos dois tem meta_token com adAccountId no banco
- [x] Cadastrar meta_token para DR MARIO (id=1): act_1625411728898223 — token do Instagram dele tem acesso ✅
- [x] Cadastrar meta_token para DRA ESTEFANI (id=90001): act_2715839921936357 — novo token fornecido ✅
- [x] DR MARIO: Investimento R$373,78, Leads 8, Alcance 21.581 ✅
- [x] DRA ESTEFANI: Investimento R$144,78, Leads 1, Alcance 5.077 ✅

## Feature: Cadastrar contas de anúncios DRA NATHALIA, DR FAVARO, DRA VANESSA
- [x] Testar token da DRA ESTEFANI nas contas: act_628165873065276, act_1064554205892155, act_1311035516882528
- [x] Cadastrar DRA NATHALIA (id=90004): act_628165873065276 — spend R$2.743, impressions 131K ✅
- [x] Cadastrar DR FAVARO (id=120001): act_1064554205892155 — spend R$1.395, impressions 236K ✅
- [x] Cadastrar DRA VANESSA (id=120002): act_1311035516882528 — spend R$5.426, impressions 234K ✅

## Bug: "Token Meta não configurado" ao selecionar perfil Instagram
- [x] Investigar: token da Dra. Tefi havia expirado (60 dias) — afetava DRA ESTEFANI, DRA HELOISA, DRA NATHALIA, DRA VANESSA, DR FAVARO
- [x] Token renovado e atualizado em todos os 5 registros meta_token + 1 instagram_oauth afetado
- [x] DR FAVARO reinserido (registro havia sumido por rollback do banco)
- [x] Todos os 5 clientes testados e confirmados ✅

## Ajuste: Relatório gerado pela IA
- [x] Tom sempre positivo e motivador, mesmo quando dados são baixos ou zerados
- [x] Dados do Instagram integrados no texto narrativo (sem bloco separado)
- [x] Métricas Instagram zeradas omitidas automaticamente do relatório

## Feature: Seletor de Conta de Anúncio nas Configurações do Cliente
- [x] Procedure listAdAccountsForClient: buscar contas acessíveis pelo token do cliente via API Meta
- [x] Procedure updateClientAdAccount: salvar adAccountId selecionado no banco
- [x] UI: adicionar seletor de conta de anúncio nas configurações do cliente (igual ao seletor de Instagram)
- [x] Mostrar nome e status da conta atual selecionada
- [x] Testar troca de conta no dashboard

## Feature: Sistema de Acesso Multi-Perfil

- [x] Schema: tabela `managers` (id, name, email, passwordHash, createdAt)
- [x] Schema: tabela `manager_clients` (managerId, clientId) — atribuição de clientes a gestores
- [x] Schema: coluna `publicToken` na tabela `clients` — token único para link público
- [x] Backend: procedure `managers.create` (admin only) — criar gestor com senha
- [x] Backend: procedure `managers.list` (admin only) — listar gestores
- [x] Backend: procedure `managers.delete` (admin only) — remover gestor
- [x] Backend: procedure `managers.assignClients` (admin only) — atribuir clientes a gestor
- [x] Backend: procedure `managers.login` (public) — autenticar gestor com e-mail+senha, retornar JWT
- [x] Backend: procedure `public.getClientByToken` (public, por token) — dados do cliente para link público
- [x] Backend: gerar publicToken automático ao criar cliente e para clientes existentes
- [x] Frontend: tela de login para gestores (/manager/login)
- [x] Frontend: dashboard do gestor — só vê clientes atribuídos a ele
- [x] Frontend: seção de Gestores nas Configurações (admin): criar, listar, deletar, atribuir clientes
- [x] Frontend: botão "Copiar link do cliente" nas configurações
- [x] Frontend: página pública do cliente (/r/:token) — relatório sem login, visual limpo
- [x] Frontend: rota protegida para gestores (redirect para /manager/login se não autenticado)

## Feature: Gestor pode criar e configurar clientes próprios
- [x] Backend: procedure clients.create acessível para gestores autenticados (managers.createClientAsManager)
- [x] Backend: ao criar cliente como gestor, vincular automaticamente na tabela manager_clients
- [x] Backend: procedure clients.delete para remover cliente (managers.deleteClientAsManager)
- [x] Frontend: botão "Excluir cliente" nas configurações com confirmação
- [x] Frontend: gestor logado via JWT vê Settings com permissão de criar/editar clientes próprios

## Bug Fix: Gestor redirecionado para página inicial ao configurar cliente
- [x] Causa: ManagerClientSettings usava procedures protectedProcedure (OAuth) que gestores não têm
- [x] Correção: novas procedures no managers router que aceitam JWT do gestor (sem OAuth)
- [x] Procedures criadas: getClientMetaStatus, getClientInstagramProfile, listAdAccountsAsManager, saveClientMetaToken, saveClientInstagram, listClientInstagramProfiles
- [x] ManagerClientSettings atualizado para usar managers.* em vez de dashboard.*

## Feature: Botão Análise IA
- [x] Botão ✨ Gerar Análise IA na página pública (/r/:token)
- [x] Botão ✨ Análise IA no ManagerDashboard (modal com seletor de período)

## Bug Fix: Instagram Insights ausente na página pública (/r/:token)
- [x] Criar procedure public.getPublicInstagramInsights (usa igUserId salvo, sem OAuth)
- [x] Adicionar seção Instagram Insights na página pública (Views, Reach, Interações, Visitas, Seguidores)
- [x] Criar função fetchInstagramInsightsByIgId no metaApi.ts (usa igUserId diretamente)

## UX: Seletor automático de perfil Instagram no ManagerClientSettings
- [x] Substituir campos manuais (username + ID) por botão "Detectar perfis" que usa listClientInstagramProfiles
- [x] Exibir dropdown com lista de perfis (@username + nome + seguidores) para selecionar
- [x] Salvar igUserId e igUsername ao selecionar perfil (botão Salvar aparece após seleção)

## Bug Fix: Card Seguidores mostrando total acumulado em vez de novos seguidores do período
- [x] Corrigir PublicClientReport para exibir novosSeguidores (ganhos no período) em vez de totalSeguidores
- [x] Renomear label do card para "Novos Seguidores" para ficar claro

## Feature: Upload de Planilha Monday.com (XLSX) para Dados de Vendas
- [x] Schema: tabela `sales_records` (id, clientId, patientName, consultDate, surgeryValue, closed, lastUpdated, uploadedAt)
- [x] Backend: endpoint POST /api/upload-sales para receber XLSX e parsear dados
- [x] Backend: getSalesForPeriod em db.ts — retorna vendas/receita por período (filtra por Data da Consulta)
- [x] Backend: getSalesUploadInfo em db.ts — retorna info do último upload (data, qtd registros)
- [x] Backend: procedures sales.getSalesDataAsManager e sales.getUploadInfoAsManager
- [x] Frontend: seção de upload de XLSX nas configurações do cliente (ManagerClientSettings)
- [x] Frontend: mostrar data do último upload e quantidade de registros
- [x] Frontend: cards Vendas e Total Vendas usam dados do XLSX quando disponível (getKpis integrado)
- [x] Frontend: página pública também usa dados do XLSX para Vendas e Total Vendas (publicRouter integrado)

## Feature: Upload XLSX no painel admin (ClientSettings)
- [x] Adicionar seção "Dados de Vendas (Monday.com)" no Settings.tsx (ClientRow)
- [x] Usar session cookie do admin para autenticar o upload (já suportado no endpoint)
- [x] Adicionar procedure sales.getUploadInfoAsAdmin no backend

## Fix: Custo por Venda -> Custo por Consulta
- [x] Substituir card "Custo por Venda" por "Custo por Consulta" (investimento / consultas) quando há dados Monday
- [x] Manter "Custo por Venda" (investimento / fechamentos) apenas quando não há dados de consultas
- [x] Atualizar no Dashboard.tsx e PublicClientReport.tsx

## Fix: Custo por Venda -> Custo por Consulta
- [x] Substituir card "Custo por Venda" por "Custo por Consulta" (investimento / consultas) quando há dados Monday
- [x] Manter "Custo por Venda" (investimento / fechamentos) apenas quando não há dados de consultas
- [x] Atualizar no Dashboard.tsx e PublicClientReport.tsx

## Feature: Métricas Combinadas Instagram Insights + Meta Ads
- [x] Backend: retornar igReach, igEngaged, igLinkTaps, igFollows, igFollowers no getKpis (via instagram.getInsights separado)
- [x] Backend: novosSeguidores usa Meta Ads follow como primário + Instagram follower_count como fallback
- [x] Dashboard: seção "Instagram Business" com cards Contas Engajadas, Visitas ao Perfil, Seguidores Novos, Total Seguidores
- [x] Relatório público: página pública já tem seção separada de Instagram Insights (views, reach, interactions, profileVisits, novosSeguidores)
- [x] public.ts: getPublicInstagramInsights retorna igReach, igEngaged, igLinkTaps, igFollows via endpoint separado

## Fix: Relatório IA mostrando Vendas=0 mesmo com dados Monday importados
- [x] Backend (generateReport): adicionar chamada ao getSalesForPeriod para buscar dados do Monday XLSX
- [x] Backend (generatePublicReport): idem para o relatório público
- [x] Backend: prompt da IA atualizado para incluir Consultas, Fechamentos, Custo por Consulta, Total em Consultas, Total em Cirurgias quando hasMondayData=true
- [x] Frontend (ReportModal): modal agora mostra cards corretos quando hasMondayData=true
- [x] Frontend (Dashboard): cards Instagram Business adicionados na seção principal de KPIs

## Feature: Suporte ao Formato B de XLSX (Dra. Heloisa Barbieri)
- [x] Analisar planilha da Dra. Heloisa: colunas "Valor do procedimento", "Valor consulta", "Compareceu", "Fechou", "Total de Vendas"
- [x] Atualizar salesUpload.ts para detectar automaticamente o formato (A ou B) pela presença das colunas
- [x] Formato B: Valor consulta→consultValue, Valor do procedimento→surgeryValue, Fechou=Sim→closed
- [x] Fallback: quando consultValue e surgeryValue são nulos, usa Total de Vendas como surgeryValue
- [x] Resposta da API inclui format (A/B), closed count, totalConsultas e totalCirurgias para debug

## Bug Fix: Formato B — Valor errado e label incorreto
- [x] Corrigir parseCurrency no salesUpload.ts: raw:true preserva valores numéricos como float, evitando que 4.972,45 seja lido como 497.245
- [x] Renomear label "Total em Cirurgias" para "Total em Fechamentos" no Dashboard, ReportModal, PublicClientReport e prompts da IA

## Fix: Formato B — Fechamento por Valor Procedimento preenchido
- [x] Ajustar lógica: no formato B, se Valor Procedimento tem valor > 0, contar como fechamento mesmo sem Fechou=Sim (fechouByValue)

## Fix: ROAS usando todos os dados de vendas importados (sem filtro de data)
- [x] getSalesForPeriod: removido filtro de data — usa todos os registros importados para o cliente
- [x] ROAS = totalCirurgias (total de fechamentos importados) / investimento do período

## Fix: Relatório usando ROAS e Ticket Médio corretos
- [x] generateReport: usar totalCirurgias para ROAS e ticketMedio quando disponível (roasBase = totalCirurgias > 0 ? totalCirurgias : totalEmVendas)
- [x] ReportModal: dados são buscados ao clicar em Gerar Relatório (procedure generateReport já busca dados frescos)

## Auditoria: KPIs derivados (taxa de conversão, custo por venda, ticket médio)
- [x] Auditado todos os pontos: getKpis snapshot path, live path, generateReport, Dashboard.tsx useMemo
- [x] fetchClientKpis: XLSX sempre sobrescreve quando hasData (não depende mais de consultas > 0)
- [x] getKpis live path: retorna taxaConversao, custoPorVenda, custoPorConsulta, ticketMedio calculados com roasBase correto
- [x] getKpis snapshot path: já estava correto (xlsxSales sobrescreve agg.vendas)
- [x] Dashboard.tsx: usa valores do backend quando disponíveis, calcula localmente apenas como fallback

## Fix: Taxa de Conversão = Fechamentos / Consultas agendadas
- [x] Corrigir taxaConversao em getKpis snapshot path: consultas > 0 ? (vendas / consultas) * 100 : 0
- [x] Corrigir taxaConversao em getKpis live path: (result.consultas ?? 0) > 0 ? (result.vendas / result.consultas) * 100 : 0
- [x] Corrigir taxaConversao em generateReport: consultas > 0 ? (vendas / consultas) * 100 : 0
- [x] Corrigir taxaConversao em Dashboard.tsx useMemo: usa valor do backend, fallback com consultas como denominador
- [x] Atualizar label no dashboard de "Taxa de Conversão" com subtítulo "Leads →" (já implementado no checkpoint 0a1bc21b)

## Fix: Parser XLSX — Suporte a todos os formatos de planilha
- [x] Formato A (Tatiana, Estefani, Jonas): fechamento = Valor da cirurgia > 0 (já coberto pelo parser Formato A)
- [x] Formato B (Mario Bongiolo, Heloisa, Nathalia): fechamento = Valor Cirurgia/Procedimento > 0
- [x] Mario Bongiolo: adicionado "Valor Cirurgia" como variante no Formato B (parser agora encontra a coluna)
- [x] Confirmado: Jonas, Estefani e Mario têm 0 fechamentos reais neste período (dados corretos)

## Fix: ROAS usando totalConsultas quando totalCirurgias = 0
- [x] roasBase = totalConsultas + totalCirurgias (implementado na seção abaixo)
- [x] Atualizado em: getKpis snapshot path, getKpis live path, generateReport, Dashboard.tsx (PublicClientReport usa endpoint separado)

## Fix: ROAS = (Total Consultas + Total Fechamentos) / Investimento
- [x] roasBase = totalConsultas + totalCirurgias (receita total = consultas pagas + procedimentos fechados)
- [x] Atualizado em: getKpis snapshot path, getKpis live path, generateReport, Dashboard.tsx
- [x] ticketMedio = roasBase / consultas (ticket médio por consulta sobre toda a receita)
- [x] totalConsultas adicionado ao tipo KpiData e ao retorno de fetchClientKpis e getSalesForPeriod

## Fix: Taxa de Conversão = Consultas / Leads (não Fechamentos / Consultas)
- [x] Corrigir taxaConversao em getKpis snapshot path: leads > 0 ? (consultas / leads) * 100 : 0
- [x] Corrigir taxaConversao em getKpis live path: mesma fórmula
- [x] Corrigir taxaConversao em generateReport: mesma fórmula
- [x] Corrigir taxaConversao em Dashboard.tsx useMemo: mesma fórmula
- [x] Corrigir label do card: "Taxa de Conversão" com subtítulo "Leads → Consultas"
- [x] Corrigir no relatório público (public.ts: taxaConversao = consultas/leads, roasBase = totalEmVendas + totalCirurgias)

## Feature: Suporte ao Formato Majestic (Formato C)
- [x] Detectar formato Majestic (Formato C): coluna "Valor fechado" presente
- [x] Fechamento = Valor fechado > 0 ou Status do Lead = "Negócio Fechado"
- [x] surgeryValue = Valor fechado; consultValue = null
- [x] Testado: 28 pacientes, 7 fechamentos, R$93.400 em fechamentos

## Feature: Integração Monday.com API — Sincronização Direta
- [x] Adicionar campo mondayBoardId na tabela clients (drizzle schema + migration)
- [x] Criar procedure monday.syncBoard no routers.ts que busca dados via Monday API
- [x] Implementar parser de dados do Monday: mapear colunas para salesRecord (consultValue, surgeryValue, closed, consultDate)
- [x] Sincronização via MCP CLI (child_process) sem necessidade de API key separada
- [x] Adicionar campo "Board ID Monday" nas configurações do cliente no frontend (ManagerClientSettings + Settings)
- [x] Adicionar botão "Sincronizar Monday" nas configurações do cliente
- [x] Mostrar data/hora da última sincronização nas configurações
- [x] Testado com board do Dr. Mario (ID: 7171531533) — formato B detectado, parser OK

## Fix: Monday.com Sync — usar API REST direta (não manus-mcp-cli)
- [x] Obter token Monday.com da tabela integrations (provider = "monday")
- [x] Reescrever mondaySync.ts para usar API GraphQL do Monday.com via fetch/axios
- [x] Remover dependência do manus-mcp-cli (não disponível em produção)
- [x] Testado com board do Dr. Mario via API REST: formato B, 10 itens OK, R$3.800 consultas, R$23.000 cirurgias

## Feature: Filtro de Período na Sincronização Monday.com
- [x] Backend: adicionar params startDate/endDate no syncMondayBoard — filtrar itens por data da consulta
- [x] Backend: atualizar procedures monday.syncBoard e monday.syncBoardAsManager para aceitar startDate/endDate
- [x] UI ManagerClientSettings: date pickers (data início / data fim) + botão dinâmico
- [x] UI Settings (admin): idem no ClientRow
- [x] Comportamento: sem datas = sincroniza tudo; com datas = apenas registros no período

## Feature: Auto-sync Monday + Sincronizar Todos
- [x] Backend: procedure monday.autoSync — verifica se cliente tem token+boardId e sincroniza (chamado ao abrir relatório)
- [x] Backend: procedure monday.syncAll — sincroniza todos os clientes com token+boardId configurados (admin only)
- [x] Frontend: ao abrir relatório do cliente, disparar autoSync se Monday configurado (sem bloquear a UI)
- [x] Frontend: botão "🟣 Monday" no header do Dashboard admin (sincroniza todos de uma vez)
- [x] Indicador visual "Atualizando Monday..." no header do relatório público durante o sync
- [x] Fix: mondaySync.ts queries reescritas como array de strings (sem template literal com chaves GraphQL)

## Feature: Envio WhatsApp do Relatório
- [x] Banco: adicionar campo whatsappNumber na tabela clients (migration)
- [x] Backend: expor whatsappNumber nas queries getClients, getClientByToken, myClients
- [x] Backend: procedure updateWhatsapp para salvar o número
- [x] Frontend Settings (admin): campo "Número WhatsApp do Grupo" por cliente
- [x] Frontend ManagerClientSettings: idem
- [x] Frontend: botões "Copiar" e "Enviar no WhatsApp" após gerar análise IA (ManagerDashboard + PublicClientReport)
- [x] Mensagem WhatsApp: análise formatada + link do relatório público

## Bug Fix: Auto-sync Monday disparando erro em clientes sem token Monday
- [x] Banco: limpar mondayBoardId da Dra. Tatiana (tinha ID salvo por engano, sem token)
- [x] Backend: syncBoardAsManager verifica token antes de chamar syncMondayBoard (mensagem amigável)
- [x] Backend: getStatusAsManager agora retorna hasToken para o frontend saber se há integração
- [x] Frontend: exibe aviso amarelo "Integração Monday.com não configurada" quando hasToken=false
- [x] Frontend: botão Sincronizar oculto quando hasToken=false (evita erro)

## Feature: Sync Monday automático ao mudar período no dashboard
- [x] Remover campos de data (início/fim) da seção Monday nas configurações (ManagerClientSettings)
- [x] PublicClientReport: ao mudar dateRange, dispara syncBoardAsManager com startDate/endDate do período
- [x] Dashboard admin: ao mudar activeClient ou dateRange, dispara syncBoard com o período selecionado
- [x] Indicador "Atualizando Monday..." em roxo ao lado do badge AO VIVO durante o sync
- [x] getClientByToken agora retorna mondayBoardId para o frontend usar no sync automático

## Bug Fix: Auto-sync Monday disparando erro na Dra. Tatiana (sem token)
- [x] Dashboard admin: verificar se cliente tem mondayBoardId E token antes de disparar auto-sync
- [x] Backend syncBoard: retorna silenciosamente quando não há token (usa token global)
- [x] Frontend: não mostra toast de erro quando sync retorna "no_token"

## Feature: Token Monday.com Global
- [x] Banco: criar tabela system_settings (key, value) para armazenar token Monday global
- [x] Backend: procedures getMondayToken, setMondayToken, removeMondayToken no systemRouter
- [x] Frontend Settings: seção "Integração Monday.com" com campo API Token global (mascarado)
- [x] Backend syncBoard/syncBoardAsManager: usa token global primeiro, fallback para token por cliente
- [x] mondaySync.ts: importa getSystemSetting do systemRouter para buscar token global
- [x] Fix: auto-sync não dispara mais erro para clientes sem token (usa token global)

## Feature: Remover Cliente
- [x] Adicionar botão "Remover cliente" nas configurações com modal de confirmação
- [x] Criar procedure deleteClient no servidor (remove cliente + integrações + dados)
- [x] Após remoção, redirecionar para o primeiro cliente da lista
- [x] Remover seção WhatsApp das configurações do cliente

## Feature: Alerta de Saldo Pré-Pago via Telegram
- [x] Salvar TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID como secrets (bot @escarlatesaldobot, chat_id 5976404996)
- [x] Implementar fetchAdAccountBudget no metaApi.ts para buscar saldo da conta (balance, spend_cap, amount_spent)
- [x] Criar procedures setPrePaid, getAdAccountBudget, checkAllBudgets no dashboardRouter
- [x] Criar endpoint POST /api/scheduled/check-budget (scheduledRoutes.ts) para a scheduled task usar
- [x] Criar scheduled task 2x por dia (9h e 18h) que verifica saldo e envia alerta no Telegram quando <= R$100
- [x] Adicionar campo isPrePaid (tinyint) na tabela clients para identificar contas pré-pagas
- [x] Toggle "Conta Pré-paga" nas configurações do cliente (Settings.tsx)

## Fix: Filtro de fechamentos Monday - Data Procedimento Fechado
- [x] Corrigir filtro de fechamentos para usar coluna "Data Procedimento Fechado" (date_mm1hc7mc) em vez de data da consulta
- [x] Clientes fecham cirurgia em mês diferente da consulta — filtrar pelo mês do fechamento, não da consulta
## Feature: Auto-sync Monday a cada hora
- [x] Implementar cron job no servidor que roda sync do Monday a cada hora para todos os clientes
- [x] Salvar timestamp da última sincronização no banco (tabela system_settings)
- [x] Adicionar indicador "Última sincronização: há X minutos" no header do dashboard

## Feature: Planilha Google Sheets Luxos Jalecos
- [x] Adaptar parser de planilha para formato e-commerce (Número Pedido, Data, Status Pagamento, Total)
- [x] Filtrar apenas pedidos com Status do Pagamento = "Confirmado"
- [x] Usar coluna C (Data) e coluna K (Total) para alimentar vendas/fechamentos

## Feature: Campo Slug no ManagerClientSettings
- [x] Adicionar procedure updateClientSlugAsManager no managers.ts (com verificação de unicidade)
- [x] Adicionar campo de URL do Relatório Público (slug) no ManagerClientSettings.tsx

## Feature: Chat IA para Customização do Relatório

- [x] Criar tabela `report_config` no banco para salvar preferências de formato por cliente (intro, tom, ordem das seções, campos exibidos, etc.)
- [x] Criar procedure tRPC `ai.chatReportFormat` que recebe mensagem + config atual e retorna nova config + resposta da IA
- [x] Criar componente `ReportChatPanel.tsx` — painel de chat flutuante no dashboard (botão "Personalizar Relatório" abre o chat)
- [x] Chat deve mostrar preview das mudanças antes de aplicar
- [x] Salvar configurações de formato no banco e aplicar no relatório público do cliente
- [x] Histórico de mensagens do chat salvo por sessão (tabela `report_chat_history`)

## Fix: Alerta de Saldo Baixo não disparando (servidor hibernado)
- [x] Adicionar cron interno no servidor para check-budget rodar a cada 2 horas
- [x] Configurar agendamento externo via Manus para chamar o endpoint a cada 2 horas (independente de hibernação)
- [x] Adicionar anti-spam: não enviar alerta repetido para o mesmo cliente dentro de 4 horas
- [x] Adicionar notificação de "saldo crítico" (< R$50) separada da notificação de "saldo baixo"

## Feature: Botão IA no Modal de Relatório
- [x] Adicionar campo de instrução e botão "Ajustar com IA" no ReportModal
- [x] Criar procedure tRPC refineReport que recebe texto atual + instrução e retorna texto refinado
- [x] Mostrar spinner durante regeneração e atualizar o texto no modal

## Fix: Fechamentos Monday - Contar apenas etiqueta verde
- [x] Corrigir filtro Monday para contar apenas status "Negócio Fechado" (etiqueta verde) como fechamento
- [x] Ignorar "Em Negociação" e "Negócio Perdido" na contagem de vendas/fechamentos

## Fix: Data de Fechamento como Critério de Período
- [x] Corrigir filtro de vendas para usar data de fechamento (conversionDate) como critério de período
- [x] Registros com data de fechamento em junho devem aparecer em junho mesmo que data de conversão seja outro mês

## Fix: Critério de Fechamento por Data
- [x] Corrigir lógica: se "Data de fechamento" preenchida = fechado (independente do status do lead)
- [x] Dr. Mario: 6 fechamentos em junho com R$ 139.000 agora reconhecidos corretamente

## Feature: Relatório Visual Público por Cliente (estilo Dr. Jonas)
- [x] Criar rota pública /r/:slug com página de relatório visual completo
- [x] Abas: Visão Geral, Meta Ads, CRM & Vendas, Funil
- [x] Cards KPI grandes com valores reais do período
- [x] Gráficos de barras: receita por canal, evolução mensal
- [x] Seção Meta Ads: investimento, leads, CPL, alcance, seguidores
- [x] Seção CRM & Vendas: fechamentos, total em vendas, ticket médio, funil
- [x] Seletor de período no relatório público
- [x] Adicionar botão "Ver Relatório" no dashboard interno que abre o link público em nova aba
- [x] Gestora pode editar título e observações do relatório público

## Reorganização: Abas no Dashboard do Cliente
- [x] Adicionar sistema de abas (Dashboard, CRM, Conteúdos) na área principal do cliente
- [x] Integrar CRM (leads Monday) como aba dentro do Dashboard — remover navegação separada para /crm
- [x] Integrar Top Conteúdos Instagram como aba dentro do Dashboard
- [x] Remover botão CRM do header (substituído pelas abas)
- [x] Filtros do CRM resetam ao trocar de cliente
- [x] Queries CRM/Conteúdos só carregam quando a aba correspondente está ativa

## Feature: Filtro de período no CRM
- [x] Adicionar parâmetros dateFrom/dateTo e dateField no getLeads do crmRouter
- [x] Filtrar leads por data de consulta ou data de conversão no período selecionado
- [x] Adicionar seletor de mês/período na aba CRM do Dashboard
- [x] Mostrar contadores separados: leads com consulta no período e leads com conversão no período

## Feature: CRM e Conteúdos na área pública do cliente
- [x] Criar procedure pública getPublicLeads no publicRouter (usa token, chama fetchMondayLeads + filtro de período)
- [x] Criar procedure pública getPublicTopPosts no publicRouter (usa token, chama fetchIgMediaInsights)
- [x] Adicionar aba CRM no PublicClientReport com filtro de período, cards de resumo e tabela de leads
- [x] Adicionar aba Conteúdos no PublicClientReport com top posts do Instagram

## Feature: Criativos Ativos das Campanhas
- [x] Helper fetchActiveCreatives na metaApi.ts (busca anúncios com thumbnail + métricas)
- [x] Procedure getCreatives no dashboardRouter
- [x] Procedure getPublicCreatives no publicRouter
- [x] Aba Criativos no Dashboard da gestora com grid de anúncios
- [x] Aba Criativos no relatório público do cliente

## Redesign Visual — Light Theme com Gradientes
- [x] Novo tema claro (light) com paleta moderna e tokens CSS no index.css
- [x] Sidebar reformulada com gradiente e navegação elegante
- [x] Header reformulado com gradiente e período destacado
- [x] Cards de KPI com gradientes coloridos e ícones
- [x] Gráfico de evolução de leads por dia (linha)
- [x] Gráfico de CPL ao longo do mês (linha)
- [x] Gráfico de funil de conversão (barras horizontais)

## Redesign: Light Theme + KPI Cards Coloridos
- [x] Reescrever Dashboard.tsx com tema claro, KPI cards com gradientes coloridos
- [x] Atualizar App.tsx: ThemeProvider defaultTheme="light", Toaster light
- [x] Corrigir erros de TypeScript (tRPC inference limit) com (trpc as any) em CRM.tsx, Dashboard.tsx, PublicClientReport.tsx

## Redesign: PublicClientReport — Light Theme
- [x] Reescrever PublicClientReport.tsx com tema claro, KPI cards coloridos e visual moderno

## Mobile Responsivo
- [x] PublicClientReport.tsx: light theme + totalmente responsivo para celular
- [x] Dashboard.tsx: sidebar colápsável no mobile, header compacto, cards empilhados
- [x] DashboardLayout.tsx: menu hamburguer no mobile (já suportado pelo shadcn/ui Sidebar)

## Bug: Instagram cruzado entre clientes
- [x] Investigado: metaIgUserId da Dra Tatiana e Dr Mario apontam para mesma conta Meta Business (conta correta, não é bug de código) — requer reconexão do OAuth da Dra Tatiana para corrigir o metaIgUserId

## Bug: Notificações indevidas ao abrir o app
- [x] Corrigir disparo de email e notificação push toda vez que o app é aberto

## Feature: Rastreamento de Campanha por Lead
- [x] Buscar leads do Meta Lead Ads (formulário nativo) via API do Meta
- [x] Cruzar leads do Monday com leads do Meta pelo telefone para identificar campanha de origem
- [x] Exibir campanha/anúncio de origem no CRM ao lado de cada lead
- [x] Implementar envio de conversões para Conversions API do Meta (CAPI) quando lead fechar no Monday
- [x] Campo de configuração do Pixel ID e Token CAPI nas configurações do cliente

## Redesign: Tema Escarlate Digital (Preto + Vermelho)
- [x] Atualizar index.css: fundo preto, vermelho escarlate #E63946, tipografia bold, fonte Playfair Display + Inter
- [x] Redesenhar Dashboard.tsx: KPI cards dark com borda vermelha sutil, números grandes e bold
- [x] Redesenhar DashboardLayout sidebar: fundo preto profundo, logo Escarlate, itens com hover vermelho
- [x] Redesenhar PublicClientReport.tsx com o tema Escarlate

## Melhoria: Instagram Insights — Cards com Barra de Progresso
- [x] Substituir gráficos de ponto único (Views, Reach, Interactions, Visits) por cards com número grande + barra de progresso visual

## Feature: SaaS Multi-Tenant — Escarlate Dashboard
- [x] Landing page Escarlate com hero, features, CTA de cadastro e login
- [x] Procedure de registro de gestor (auto-signup com JWT)
- [x] Tela de login/cadastro com visual Escarlate (abas Entrar / Criar conta)
- [x] Painel de admin (Scarlett) já existente para ver todos os gestores e seus clientes
- [x] Rota /manager/login com tela personalizada Escarlate

## Feature: Tema do Relatório Público por Cliente
- [x] Adicionar campo reportTheme (light/dark) na tabela clients no schema
- [x] Migrar banco com nova coluna
- [x] Seletor de tema nas configurações do cliente (ManagerClientSettings)
- [x] PublicClientReport.tsx renderiza no tema correto (claro ou Escarlate preto+vermelho)

## Bug Fix: Fechamentos ausentes no painel manager
- [x] Investigar e corrigir por que /manager/dashboard não exibe os fechamentos importados/sincronizados do cliente no período selecionado

## Bug Fix: Consultas do Dr. Mario no painel manager
- [x] Corrigir a contagem de consultas para priorizar a Data de Conversão quando ela estiver disponível

## Bug Fix: ID manual de conta no painel manager
- [x] Exibir sempre a opção de inserir manualmente o ID da conta de anúncios nas configurações Meta Ads do manager

## Melhoria: Conta pré-paga no painel manager
- [x] Adicionar o seletor Conta Pré-paga (PIX/boleto) nas configurações Meta Ads do manager

## Teste: Alerta pré-pago no Telegram
- [x] Enviar alerta de teste ao Telegram para validar a configuração de conta pré-paga

## Planejamento: Continuidade da IA Meta Ads
- [x] Revisar briefing enviado e organizar os próximos ajustes prioritários da IA no dashboard

## IA Meta Ads: Mapeamento Mestre e Ranking Diário
- [x] Definir os campos e aproveitar os dados já existentes para o Mapeamento Mestre por cliente
- [x] Criar estrutura de dados e tela de Mapeamento Mestre
- [x] Criar a base do Ranking Diário de Oportunidades com evidências e prioridades
- [x] Validar o fluxo e documentar as ações pendentes da Scarlett

## Melhoria: Exclusão de clientes no painel manager
- [x] Adicionar opção segura para excluir clientes, com confirmação explícita antes da remoção definitiva

## IA Meta Ads: Ranking Diário de Oportunidades
- [x] Analisar os clientes confirmados e suas metas comerciais
- [x] Implementar cálculo de prioridade com métricas reais, metas e evidências
- [x] Criar interface de ranking diário e recomendações por cliente
- [x] Validar a classificação dos primeiros clientes mapeados

## Melhoria: Período personalizado no Ranking Diário
- [x] Substituir os filtros fixos de 7 e 30 dias por seleção de data inicial e final com calendário

## IA Meta Ads: Creative Analyst
- [x] Mapear os dados de anúncios e criativos já disponíveis na integração Meta
- [x] Criar estrutura de classificação de criativos por hook, ângulo e formato
- [x] Implementar tela de Creative Analyst com desempenho e hipóteses de testes
- [x] Validar o fluxo técnico e documentar a classificação que Scarlett precisa revisar

## Análise Criativa: Neo Hair
- [x] Consolidar os padrões de performance dos 15 criativos analisados e recomendar testes prioritários

## Melhoria: Diagnóstico comparativo de criativos
- [x] Comparar cada criativo com a média dos criativos do período e com as metas do cliente
- [x] Exibir diagnóstico objetivo e decisão recomendada, em vez de somente repetir métricas

## IA Meta Ads: Creative Agent
- [x] Definir o formato de brief e plano de teste a partir dos criativos de referência
- [x] Criar estrutura de dados e geração de briefs aprováveis
- [x] Implementar tela de Creative Agent com revisão e organização dos testes
- [x] Validar o fluxo técnico e orientar a aprovação da Scarlett

## IA Meta Ads: Geração Visual de Criativos
- [x] Criar geração de imagens a partir de briefs aprovados, com revisão humana antes de qualquer uso
- [x] Exibir e organizar os criativos visuais gerados dentro do Creative Agent

## IA Meta Ads: Banco de Antes e Depois
- [x] Criar upload seguro de fotos autorizadas de antes e depois por cliente
- [x] Vincular pares de fotos a briefs aprovados para gerar estáticos de tráfego
- [x] Exibir, aprovar ou descartar os criativos estáticos gerados

## Correção: Estáticos de Antes e Depois
- [x] Substituir a imagem generativa por uma composição que preserve exatamente as fotos originais enviadas

## Correção: Galeria de Estáticos
- [x] Exibir imediatamente na galeria o estático fiel salvo após a composição de antes e depois

## Melhoria: Template Visual de Antes e Depois
- [x] Melhorar o enquadramento, eliminar faixas pretas e aplicar hierarquia visual profissional nos estáticos reais

## Pesquisa: Layouts Premium de Tráfego Pago
- [x] Pesquisar referências de layouts premium para criativos de saúde, estética e antes e depois antes de definir o novo template

## Acabamento: Template de Antes e Depois
- [x] Remover CTA técnico, ajustar o cabeçalho e aplicar copy final adequada para tráfego

## Rebuild: Template Premium de Antes e Depois
- [x] Recriar o estático com estrutura editorial premium: título, subtítulo, fotos maiores, benefícios e CTA no padrão da referência

## Melhoria: Gestão de Estáticos
- [x] Remover da galeria os estáticos descartados
- [x] Adicionar botão para baixar os estáticos aprovados em PNG

## IA Meta Ads: Campaign Agent
- [x] Mapear os dados de campanhas, conjuntos e métricas disponíveis para recomendações
- [x] Criar planos de teste e recomendações de campanha com revisão humana
- [x] Implementar a tela Campaign Agent sem execução automática na Meta
- [x] Validar o fluxo técnico e documentar a revisão humana da Scarlett

## Ajuste de Escopo: Ideias de Tráfego
- [x] Ocultar os módulos de geração de imagens, estáticos e antes e depois do menu principal
- [x] Manter Creative Analyst e Creative Agent focados em diagnóstico, ideias e briefs de teste

## Exportação: Backup do Banco de Dados
- [x] Gerar backup.sql com estrutura e dados das 12 tabelas solicitadas, incluindo a contagem de linhas

## Diagnóstico: Leads de Formulário Meta
- [x] Consultar em modo leitura os três clientes selecionados e contar leads Meta com telefone

## Redesign: Dashboard Executivo
- [x] Reorganizar o dashboard com resumo executivo, alerta de dependência de receita e funil comercial
- [x] Adicionar seções de custos de aquisição, receita e presença no Instagram ao novo layout
- [x] Preservar todas as ações atuais de sincronização, relatório e WhatsApp

## Revisão: Dashboard Executivo com Linhagem de Dados
- [x] Exibir mensagens iniciadas e custo de mensagens no resumo executivo quando disponível
- [x] Declarar a origem de receita e a fórmula de ROAS na visão da gestora
- [x] Remover dados de CRM e alertas internos da visão pública da clínica

## Revisão: Proposta de Conteúdos da Clínica
- [x] Avaliar a proposta de conteúdos e recomendar a integração segura na visão pública

## Redesign: Relatório Público da Clínica
- [x] Reduzir a navegação pública para as abas Resultados e Conteúdos
- [x] Reunir indicadores comerciais auditáveis, funil e anúncios ativos em Resultados
- [x] Manter o ranking de posts de Instagram em Conteúdos sem expor CRM ou dados pessoais
- [x] Atualizar e executar testes da estrutura do relatório público

## Correção Crítica: Privacidade de Instagram e Leitura Pública
- [x] Anular o vínculo `metaIgUserId` incorreto do cliente 30001 na integração Meta Ads
- [x] Padronizar a precedência de Instagram OAuth sobre Meta Token em consultas públicas
- [x] Auditar os vínculos de Instagram dos demais clientes para identificar possíveis cruzamentos
- [x] Restaurar a leitura visual do funil e simplificar o topo de Resultados sem fórmula interna de ROAS
- [x] Validar a correção de privacidade por testes e publicar a atualização

## Revisão da Integração Meta e Lead Ads
- [x] Comparar os arquivos enviados com os módulos atuais de Meta Ads, OAuth e CRM
- [x] Validar a versão da Graph API, escopos OAuth e caminho de Lead Ads contra a documentação oficial
- [x] Recomendar as correções e o plano seguro de teste e reconexão

## Revisão Atualizada: OAuth Meta Seguro
- [x] Comparar o state OAuth assinado e a validação de origem com o fluxo atual
- [x] Confirmar a versão da Marketing API e os escopos que dependem de App Review
- [x] Consolidar uma recomendação de implantação faseada para uma clínica piloto

## Revisão: OAuth Meta com Autorização por Gestor
- [x] Revisar a autorização de gestor para geração do link OAuth por cliente
- [x] Validar state de uso único e as referências de interface que chamam o novo procedimento
- [x] Recomendar os testes mínimos antes da aplicação em uma clínica piloto

## Revisão: State OAuth Persistente
- [x] Revisar migração, schema e persistência de states OAuth
- [x] Validar consumo atômico, expiração e autorização de gestor e admin
- [x] Consolidar o parecer e os testes de piloto necessários

## Revisão Final: OAuth Meta Persistente
- [x] Verificar a ordem definitiva da migração e o schema de states OAuth
- [x] Validar chave de assinatura dedicada e consumo atômico com expiração
- [x] Consolidar o parecer final para o piloto de reconexão

## Implementação: OAuth Meta Seguro
- [x] Configurar `OAUTH_STATE_SECRET` e `PUBLIC_BASE_URL` no ambiente
- [x] Adicionar tabela persistente de states OAuth por migração Drizzle
- [x] Implementar procedures autorizadas para gestor e admin e remover a rota OAuth pública
- [x] Atualizar Settings e ManagerClientSettings para o novo contrato de OAuth
- [ ] Testar autorização, expiração, replay e reconexão da clínica piloto

## Piloto de Reconexão Meta: Dr. Mario
- [x] Gerar o link OAuth seguro no painel do Dr. Mario
- [x] Concluir a autorização Meta sem reconectar outras clínicas
- [x] Confirmar investimento, criativos e identidade do Instagram do Dr. Mario

## Bloqueio do Piloto: Configuração do App Meta
- [x] Adicionar o domínio do dashboard e a URL exata de callback nas configurações do App Meta
- [x] Solicitar acesso avançado ao `public_profile` para Facebook Login for Business
- [ ] Reexecutar a autorização OAuth do Dr. Mario após a configuração

## Retomada do Piloto Meta Após App Review
- [x] Confirmar o status da solicitação de acesso avançado
- [ ] Reexecutar e validar a autorização OAuth do Dr. Mario

## Diagnóstico do Callback OAuth do Piloto
- [x] Confirmar por que o state OAuth do Dr. Mario não foi consumido no callback
- [ ] Concluir a autorização Meta até o redirecionamento ao dashboard

## Correção de Retorno OAuth Meta
- [x] Rastrear a URL de retorno efetivamente usada pela Meta no piloto
- [ ] Corrigir o callback e o redirecionamento ao cliente Dr. Mario
- [ ] Validar o consumo do state e a atualização da integração OAuth

## Contenção: Perfil Instagram Cruzado no Piloto
- [x] Remover a integração OAuth de @drjonaslenzi do cliente Dr. Mario
- [x] Confirmar que o cliente Dr. Mario não exibe nenhum conteúdo de perfil externo
- [x] Preparar uma reconexão somente com a conta Meta correta do Dr. Mario

## Correção: Seleção Explícita de Instagram no OAuth
- [x] Salvar a autorização OAuth como pendente sem escolher automaticamente a primeira Página ou Instagram
- [x] Exibir os perfis disponíveis e exigir que admin ou gestor confirme o perfil correto
- [x] Ativar a integração somente após a seleção explícita e registrar a identidade escolhida

## Questionário de Tratamento de Dados da Meta
- [ ] Mapear cada pergunta de tratamento de dados exibida pela Meta
- [ ] Orientar respostas fiéis ao funcionamento atual do dashboard
- [ ] Aguardar confirmação da Scarlett antes de enviar a declaração

## Auditoria de Operadores de Dados Meta
- [x] Identificar serviços externos que recebem tokens, identificadores ou métricas originados da Meta
- [x] Classificar a finalidade e o tipo de dado compartilhado com cada serviço
- [x] Preparar a lista de operadores e pendências para revisão jurídica e envio à Meta

## Inventário Completo de Serviços Externos Meta
- [x] Rastrear no código todos os serviços externos que recebem dados originados da Meta
- [x] Especificar para cada serviço o dado recebido e a finalidade técnica
- [x] Entregar a lista consolidada com limitações contratuais explícitas

## Reconexão Meta em Lotes Controlados
- [ ] Corrigir a referência histórica do piloto para Dra. Tatiana e registrar o ID validado do Dr. Mario
- [ ] Criar checklist por cliente com perfil selecionado, investimento e criativos validados
- [ ] Preparar o primeiro lote de três ou quatro clínicas sem executar reconexões em massa

## Recuperação Crítica: Login e Dados do Dashboard
- [x] Diagnosticar a invalidação de sessão e a falha de carregamento de dados
- [x] Restaurar uma sessão de gestor compatível e segura
- [x] Corrigir os erros que impedem o dashboard de carregar dados dos clientes
- [x] Validar login e dados em uma conta gestora antes de retomar o OAuth

## Diagnóstico Rápido Baseado no Dashboard
- [x] Extrair as perguntas do diagnóstico enviado
- [x] Cruzar cada pergunta com dados reais do dashboard
- [x] Entregar respostas fundamentadas e sinalizar dados ausentes

## Recuperação de Senha por E-mail
- [ ] Mapear o login de gestores e a integração disponível para envio de e-mail
- [ ] Verificar se `envio.escarlatedigital.com` já está configurado no Resend
- [ ] Validar domínio, remetente e `RESEND_API_KEY` antes de habilitar o envio
- [ ] Criar token temporário, uso único e expiração para redefinição de senha
- [ ] Adicionar telas de solicitação e criação de nova senha
- [ ] Testar o fluxo de recuperação e publicar

## Acesso ao Piloto Meta: Dr. Mario
- [x] Identificar a conta de gestor vinculada ao Dr. Mario
- [x] Redefinir a senha do gestor de modo seguro para o piloto

## Correção: Segredo de Sessão de Gestores
- [x] Diagnosticar por que o `JWT_SECRET` não está disponível no ambiente publicado
- [x] Configurar `MANAGER_JWT_SECRET` exclusivo para sessões de gestores
- [x] Atualizar o login para exigir o segredo exclusivo e validar o fluxo publicado

## Regressão Crítica: Entrada e Estabilidade do Manager
- [x] Corrigir a rota `/manager` que retorna erro 404 em vez de abrir o painel de gestores
- [x] Investigar e eliminar as quedas recorrentes de sessão reportadas no painel manager
- [x] Validar a permanência da sessão e o envio de relatório antes de sexta-feira

## Regressão Crítica: Carregamento de Clientes do Manager
- [x] Diagnosticar o carregamento inicial que exibe KPIs vazios enquanto a consulta ainda está em andamento
- [x] Confirmar que o painel conclui o carregamento sem intervenção quando a API responde
- [x] Validar clientes e KPIs no ambiente publicado

## Múltiplas Contas de Anúncios: Dr. Mario
- [x] Avaliar o modelo atual de conexão Meta e a seleção de contas do cliente
- [x] Permitir adicionar e remover múltiplas contas de anúncios sem substituir as existentes
- [x] Agregar dados das contas selecionadas no dashboard e validar com o Dr. Mario

## Bloqueio Meta: Verificação por SMS
- [ ] Confirmar os métodos de recuperação disponíveis para a autenticação Meta bloqueada por SMS
- [ ] Orientar a recuperação segura para voltar a atribuir a conta adicional ao perfil conectado
- [ ] Revalidar e adicionar a conta `act_769963708331464` após a liberação na Meta

## Importação Manual Meta: Conta Adicional do Dr. Mario
- [ ] Definir o formato de exportação e as colunas necessárias da conta `act_769963708331464`
- [ ] Criar uma importação isolada de métricas Meta para o cliente Dr. Mario
- [ ] Importar o arquivo enviado e validar o reflexo exclusivo no relatório do Dr. Mario

## Histórico Trimestral Meta: Dr. Mario
- [ ] Obter exportação por dia ou trimestre da conta histórica desde janeiro de 2025
- [ ] Importar métricas históricas isoladas por período para o Dr. Mario
- [ ] Validar os relatórios trimestrais sem misturar dados de outras contas ou clientes

## Histórico Trimestral Meta: Dr. Mario
- [ ] Obter exportação por dia ou trimestre da conta histórica desde janeiro de 2025
- [ ] Importar métricas históricas isoladas por período para o Dr. Mario
- [ ] Validar os relatórios trimestrais sem misturar dados de outras contas ou clientes

## Histórico Simplificado: Dr. Mario
- [x] Usar a planilha diária para calcular somente investimento, leads e CPL por trimestre
- [x] Criar importação histórica isolada para o cliente Dr. Mario
- [ ] Exibir e validar os três indicadores no relatório trimestral do Dr. Mario

## Correção: Divergência de Valor no Histórico do Dr. Mario
- [x] Comparar o valor de agosto informado pela Scarlett com cada fonte de mídia e comercial
- [x] Identificar e eliminar qualquer dupla contagem entre histórico, Meta e Monday
- [ ] Validar o período corrigido antes de apresentar o relatório ao cliente

## Proposta de Landing Page
- [x] Avaliar a estrutura e a mensagem da proposta enviada
- [x] Recomendar uma adaptação comercial coerente com o ADS Dashboard

## Lançamento Controlado do Produto
- [x] Definir roteiro de segurança, operação e piloto fechado antes da venda pública
- [x] Corrigir o controle de acesso do relatório público por slug e token
- [x] Auditar as consultas públicas existentes e remover qualquer busca por slug previsível
- [x] Registrar acessos públicos e alertar sobre padrão incompatível com o isolamento esperado
- [x] Proteger tokens de integração e eliminar segredos de fallback inseguros
- [x] Mapear tokens persistidos e os pontos de leitura e escrita no servidor
- [x] Criptografar tokens de integração antes da gravação e descriptografar somente no servidor
- [x] Remover fallback inseguro de JWT e exigir configuração de segredo válida
- [x] Migrar tokens existentes sem interromper as integrações dos clientes
- [ ] Definir o pacote operacional de privacidade, cobrança, inadimplência e suporte
- [ ] Conduzir piloto com 2 ou 3 gestores antes de abrir vendas públicas

## Pacote de Transferência para TI
- [x] Documentar arquitetura, funcionalidades, integrações, segurança e pendências
- [x] Criar guia de instalação, variáveis de ambiente e migração de banco sem expor segredos
- [x] Gerar arquivo de código sanitizado para compartilhamento seguro

## Contas Pré-pagas: Aviso de PIX
- [x] Conferir saldos das contas pré-pagas e identificar quais atingiram o critério de alerta
- [x] Preparar a lista de clientes e o texto de aviso para PIX
- [x] Enviar o aviso no Telegram somente após confirmação explícita da Scarlett

## Dra. Eva Hoffman: Dados Comerciais Ausentes
- [x] Conferir conexão Monday, configuração comercial e registros de consultas e procedimentos da Dra. Eva
- [x] Corrigir o motivo identificado sem alterar registros comerciais existentes
- [x] Validar no dashboard que consultas e procedimentos aparecem no período correto

## Consulta de Campanhas: Curitiba
- [ ] Identificar as campanhas de criolipólise e glúteo do cliente de Curitiba
- [ ] Apurar investimento, resultados e custo por resultado no período solicitado
- [ ] Entregar o resumo em formato pronto para a Scarlett usar
- [ ] Confirmar os dados de 1º a 12 de setembro de 2026 antes do envio

## Correção: Estilos não carregam no domínio publicado
- [x] Diagnosticar o carregamento sem CSS no dashboard publicado
- [x] Restaurar a publicação e o acesso autenticado aos assets do painel
- [x] Confirmar no navegador pessoal que CSS, JavaScript e dados carregam corretamente no domínio personalizado
