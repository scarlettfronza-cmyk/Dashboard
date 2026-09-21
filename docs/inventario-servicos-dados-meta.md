# Inventário de Serviços Externos que Recebem Dados Originados da Meta

**Data da revisão:** 26/08/2026  
**Método:** leitura dos pontos de saída do código em `server/`, incluindo chamadas HTTP, persistência, storage, IA, alertas e envio de relatórios.

> Este documento descreve o que o código evidencia. Ele não define, por si só, papéis jurídicos de controlador, operador ou suboperador. A entidade controladora e os nomes jurídicos dos fornecedores devem ser confirmados com contador ou advogado antes da declaração à Meta.

## Serviços que recebem dados originados da Meta

| Serviço externo | Dados recebidos | Como o dado chega ao serviço | Finalidade técnica | Evidência no código |
|---|---|---|---|---|
| **Manus WebDev, hospedagem e banco de dados gerenciado** | Tokens de acesso Meta e Instagram, IDs de conta de anúncio, IDs e nomes de perfil Instagram, métricas de anúncios, insights, campanhas, criativos, snapshots e textos de relatório que usam essas métricas | O backend persiste integrações e dados comerciais no banco configurado pelo ambiente Manus; o app e suas rotas rodam na hospedagem Manus | Executar o dashboard, guardar integrações, consultar a Meta e servir relatórios | `server/db.ts`, `drizzle/schema.ts`, `server/metaApi.ts` e variáveis gerenciadas do projeto |
| **Manus Forge, gateway de IA** | Métricas agregadas de campanhas, como investimento, leads, CPL, ROAS, alcance e consultas; dados e textos de criativos, como copy, CTA, hook, ângulo, CTR, CPL e desempenho; textos de relatórios personalizados | As rotas de relatório, análise de criativos e briefs chamam `invokeLLM`, que envia prompts para o endpoint Forge | Gerar relatórios, análises, classificações de criativos e briefs | `server/_core/llm.ts`, `server/routers/ai.ts`, `server/routers/managers.ts` e `server/routers/public.ts` |
| **Telegram Bot API** | Nome da clínica e saldo de conta pré-paga obtido da Meta; em alerta de acesso cruzado, IDs internos de gestor e cliente, que não são dados Meta | O cron de orçamento envia alertas com saldo e nome da clínica; o roteador público envia alertas de segurança | Alertas operacionais de saldo e segurança para a gestora | `server/budgetCron.ts` e `server/routers/public.ts` |
| **Z-API, envio de WhatsApp** | Texto de relatório que pode conter investimento, leads, CPL, ROAS, alcance e outros indicadores Meta; nome da clínica; período; URL do relatório público e seu token no link | A função `sendReport` ou `sendReportAsManager` monta a mensagem e `sendGroupMessage` a envia à Z-API | Entregar relatórios a grupos de WhatsApp | `server/routers.ts` linhas 2085 a 2162 e `server/zapApi.ts` |
| **Meta Graph API** | Tokens, IDs de conta de anúncio, ID de Instagram e parâmetros de período retornam à própria Meta em cada chamada de API | O backend consulta métricas de anúncios e Instagram e pode enviar eventos CAPI à própria Meta | Ler dados da plataforma e enviar eventos de conversão configurados | `server/metaApi.ts`, `server/routers/crm.ts`, `server/routers/managers.ts` e `server/routers/leadTracking.ts` |

## Infraestrutura que existe no projeto, mas não recebe dados Meta de forma comprovada pelo código atual

| Serviço ou camada | Conclusão técnica | Dado que o código mostra receber |
|---|---|---|
| **Manus Forge Storage, storage de arquivos** | O helper de storage usa o proxy da Manus. No fluxo atual revisado, ele armazena imagens geradas e pares de fotos antes e depois enviados pela usuária. Não há chamada que envie tokens, IDs de conta, métricas, insights ou criativos extraídos da Meta diretamente para storage. | Fotos antes e depois, imagens geradas e composições estáticas, não dados Meta comprovados |
| **Monday.com** | O código chama a API do Monday para buscar CRM e vendas para dentro do dashboard. Não há chamada identificada que envie dados Meta, tokens ou métricas ao Monday. | Recebe consultas do dashboard, mas não dados Meta enviados pelo projeto |
| **Anthropic** | Não há chamada direta à Anthropic no código. A IA usa o gateway Forge da Manus. Uma eventual subcontratação do provedor de IA deve ser confirmada nos termos da Manus, não inferida do projeto. | Nenhum envio direto identificado |
| **Cloudflare** | Não há endpoint, SDK ou chamada direta a Cloudflare no projeto. Uma eventual camada de CDN ou proxy depende da configuração de hospedagem, fora do código revisado. | Nenhum envio direto identificado |

## Resposta prática para a declaração da Meta

Para a pergunta sobre provedores que recebem Dados da Plataforma, a lista que o código sustenta diretamente é: **Manus**, **Telegram** e **Z-API**. A descrição da Manus deve cobrir hospedagem, banco, gateway de IA e, caso o fornecedor trate tudo como uma única plataforma contratada, seu storage gerenciado.

**Não incluir Monday.com, Anthropic ou Cloudflare como receptores de dados Meta com base apenas no código atual.** Eles só devem entrar se contratos, configurações de hospedagem ou fluxos externos não presentes no repositório demonstrarem esse compartilhamento.

## Pontos que exigem confirmação humana antes do envio

1. A razão social, CNPJ ou equivalente e o país da entidade que atua como controladora.
2. Se a Z-API recebe regularmente relatórios com métricas Meta, pois isso depende da opção de envio usada pela gestora.
3. Se dados recebidos da Meta foram compartilhados com alguma autoridade pública nos últimos 12 meses.
4. O nome jurídico e o papel contratual de Manus, Z-API e Telegram na declaração solicitada pela Meta.
