# Auditoria de Operadores que Recebem Dados Originados da Meta

**Data da revisão:** 26/08/2026

## Critério

Esta auditoria considera apenas serviços externos que o código atual chama e que recebem dados obtidos da Meta, como tokens, identificadores, métricas de anúncios, dados de Instagram ou links de relatório que expõem esses dados. O resultado descreve o fluxo técnico e não substitui a classificação jurídica de controlador, operador ou suboperador.

## Serviços identificados

| Serviço | Recebe dados originados da Meta? | Dados observados no código | Finalidade técnica | Evidência |
|---|---|---|---|---|
| Manus, incluindo banco, hospedagem, storage e gateway de IA | **Sim** | Tokens de Meta, IDs de conta e Instagram, métricas, dados de criativos e textos de relatórios | Persistir integrações e dados do dashboard, hospedar o app e processar análises por IA via Forge | `server/db.ts`, `server/_core/llm.ts`, `server/storage.ts` e rotas de análise |
| Z-API | **Sim, quando há envio de relatório** | Texto do relatório, que pode incluir investimento, leads, CPL, ROAS e outros indicadores Meta, além do link público do relatório | Entregar mensagens de relatório a grupos de WhatsApp | `server/routers.ts` linhas 2085 a 2162 e `server/zapApi.ts` |
| Telegram | **Sim, de forma limitada** | Nome da clínica e saldo de conta pré-paga da Meta; em alertas de segurança, IDs internos de gestor e cliente | Alertas de saldo de campanhas e alertas internos de segurança | `server/budgetCron.ts` linhas 64 a 120 e `server/routers/public.ts` linhas 30 a 43 |
| Meta | Não é listado como operador externo para esta pergunta | Tokens, IDs, métricas e eventos CAPI retornam ou são enviados à própria plataforma Meta | Plataforma de origem dos dados e API de anúncios | `server/metaApi.ts` e `server/routers/leadTracking.ts` |

## Serviços que o código não mostra recebendo dados originados da Meta

| Serviço | Conclusão do código atual | Observação |
|---|---|---|
| Monday.com | **Não identificado como receptor** | O dashboard busca dados comerciais e de CRM na API do Monday. O código revisado não envia métricas, tokens ou dados Meta ao Monday. |
| Anthropic | **Não identificado como integração direta** | O código chama o gateway Forge da Manus para IA. Não há chamada direta para API da Anthropic no projeto. Se a Manus usar suboperadores de IA, isso deve ser confirmado na documentação contratual da Manus, não inferido pelo código. |
| Cloudflare | **Não identificado pelo código** | Não há endpoint ou SDK direto. Uma eventual camada de CDN ou proxy precisa ser confirmada pela configuração de hospedagem e pelo contrato do provedor. |

## Pendências para a declaração à Meta

1. Confirmar com contador ou advogado quem é a entidade controladora, sua razão social, CNPJ ou registro equivalente e o país da sede jurídica.
2. Confirmar nos contratos dos fornecedores se Manus, Z-API e Telegram devem ser listados pelos respectivos nomes comerciais ou por entidade jurídica específica.
3. Confirmar se os relatórios enviados por WhatsApp contêm métricas Meta. Quando o texto personalizado contém indicadores de campanha, a Z-API recebe esses dados.
4. Confirmar se a organização compartilhou dados pessoais recebidos da Meta com qualquer autoridade pública nos últimos 12 meses.
