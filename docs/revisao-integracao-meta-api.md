# Revisão Técnica da Integração Meta API

## Decisão recomendada

O material enviado identifica problemas reais, mas **não deve ser copiado e publicado como está**. A atualização de `v19.0` é prioritária, porém o destino correto em agosto de 2026 é **Marketing API v26.0**, não `v21.0`. A Meta lista v26.0 como a versão atual e informa que v19.0 expirou em maio de 2026, enquanto v21.0 do Marketing API deixou de ser suportada em setembro de 2025.[1][2]

> A implementação deve ser dividida em dois blocos: estabilizar leitura de anúncios e Instagram primeiro; tratar Lead Ads em um fluxo separado, testado contra uma Página real antes de solicitar nova autorização às 19 clínicas.

| Tema | Estado atual | Material enviado | Decisão técnica |
|---|---|---|---|
| Versão da API de anúncios | `server/metaApi.ts` ainda usa `v19.0` | Troca para `v21.0` | Migrar todas as chamadas de Marketing API para `v26.0` após teste de regressão |
| Endpoints de posts Instagram no CRM | Duas URLs em `v19.0` | Troca para `v21.0` | Centralizar em uma constante `v26.0` e eliminar URLs hardcoded |
| OAuth de anúncios | Não solicita `ads_read` | Adiciona `ads_read` | Adicionar `ads_read`; é a permissão adequada para dashboards e relatórios de anúncios.[3] |
| Leitura de Lead Ads | Busca `act_{id}/leadgen_forms` e pode retornar zero silenciosamente | Troca para `/ads` e depois `/{ad-id}/leads` | Não publicar esse caminho sem teste. Implementar resultado estruturado, com sucesso, vazio, parcial ou erro, e validar o recurso por Página e formulário |
| Permissões de Lead Ads | Não solicita `leads_retrieval` | Adiciona `leads_retrieval` | Adicionar somente após validar o fluxo. A documentação também exige App Review e `pages_manage_ads` para recuperar dados de Lead Ads em produção.[4] |
| Estado OAuth | `state` contém clientId e origem em Base64, sem assinatura ou expiração | Mantém o mesmo padrão | Corrigir antes de ampliar permissões: state assinado, temporário e ligado ao gestor autenticado |

## O que o roteiro acertou

O diagnóstico da versão antiga é correto. O código em produção ainda usa `v19.0` no módulo de anúncios e há chamadas de mídia do Instagram em `v19.0` no CRM. Em Marketing API, versões expiram em ciclos curtos e uma chamada em versão expirada pode falhar ou ser atualizada automaticamente em determinados endpoints. Isso torna o comportamento inconsistente e dificulta a depuração.[2]

O roteiro também acerta ao apontar que `ads_read` deve ser pedido pelo OAuth. Essa permissão permite a leitura de insights e informações de contas de anúncios às quais o proprietário concedeu acesso, exatamente o caso do dashboard.[3]

Por fim, o erro não deve mais virar uma lista vazia. Se a API negar acesso, a interface precisa dizer que a sincronização falhou e mostrar uma orientação prática, sem apresentar "0 leads" como se fosse um resultado confirmado.

## O que precisa ser corrigido no próprio roteiro

O principal ajuste é a versão: **v21.0 não é o destino atual**. A documentação atual da Meta informa que v26.0 é a versão de Marketing API vigente. Portanto, trocar v19.0 por v21.0 resolve parte do atraso, mas mantém a integração em uma versão já expirada para Marketing API.[1][2]

Também não é seguro concluir que a aresta `/{ad-id}/leads` elimina a necessidade de Página. A documentação da Meta informa que os leads pertencem à Página, que um anúncio de Lead Ads precisa estar vinculado a uma Página e que a recuperação de dados requer acesso de Página ou permissões flexíveis. Para produção, a Meta exige App Review, `leads_retrieval` e `pages_manage_ads` para esse caso.[4] Assim, a rota por anúncio pode ser testada, mas precisa de um plano B explícito por Página e formulário, com `pageId` persistido e token de Página associado.

O código enviado também captura falha por anúncio e continua retornando uma lista. Isso ainda pode produzir um falso resultado vazio quando todas as requisições falham. O retorno deve separar `leads`, `failedAds`, `warning` e `errorCode`; quando nenhum anúncio foi consultado com sucesso, a mutation deve falhar claramente.

## Ordem segura de execução

| Etapa | Ação | Critério de saída |
|---|---|---|
| 1 | Criar um adaptador central de versão e atualizar v19.0 para v26.0 em anúncios, OAuth e CRM | Dashboard, criativos e Instagram de um cliente de teste carregam sem regressão |
| 2 | Tornar o state OAuth assinado, com expiração e autorização do cliente verificada no servidor | Não é possível iniciar OAuth para cliente fora da carteira do gestor |
| 3 | Solicitar `ads_read` e reconectar somente uma conta de teste | Insights e campanhas retornam pelo OAuth atualizado |
| 4 | No Graph API Explorer, testar a recuperação de Lead Ads para uma Página e formulário reais | Identificar se a conta usa formulário nativo, WhatsApp ou Direct |
| 5 | Só se o teste de formulário nativo funcionar, adicionar `leads_retrieval` e `pages_manage_ads`, exibir erros estruturados e testar a interface | A tela diferencia corretamente "sem leads" de "sem permissão" |
| 6 | Solicitar App Review antes de convidar as demais clínicas para reconectar | Escopos aprovados e uma reconexão única, documentada, para as contas necessárias |

## Mensagem operacional para as clínicas

Não avise as 19 clínicas agora. Primeiro valide uma clínica que usa formulário nativo. Se o teste confirmar o fluxo e a aprovação de permissões estiver disponível, a comunicação deve explicar que a reconexão autoriza a leitura de indicadores de anúncios e, quando aplicável, dos contatos preenchidos em formulários nativos. Campanhas que levam ao WhatsApp ou Direct não usam o mesmo caminho e não devem receber promessa de atribuição por formulário.

## Referências

[1] [Meta, versões da Graph API e Marketing API](https://developers.facebook.com/docs/graph-api/changelog/versions/)

[2] [Meta, versionamento da Marketing API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview/versioning)

[3] [Meta, referência da permissão `ads_read`](https://developers.facebook.com/docs/permissions/)

[4] [Meta, Lead Ads e requisitos para recuperar leads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads)
