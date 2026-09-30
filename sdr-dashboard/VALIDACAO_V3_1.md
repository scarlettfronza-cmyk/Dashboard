# Validação da versão 3.1

## Escopo validado

Esta validação foi executada em 28 de agosto de 2026, após a importação segura da versão 3.1, a aplicação da migração de relatórios e a configuração das variáveis necessárias ao Monday e aos links públicos.

| Área | Resultado observado | Situação |
|---|---|---|
| Dashboard autenticado (`/`) | A captura exibiu a visão geral da Dra Estéfani Molinar com dados normalizados do Monday, filtros de período e tabela de leads. | Captura revisada |
| Entrada (`/entrar`) | A captura exibiu as opções **Entrar** e **Criar conta**, campos de e-mail e senha, controle de visualização de senha e CTA de acesso. | Captura revisada |
| Painel da gestora (`/admin`) | A captura exibiu Scarlett Fronza, cliente vinculado, catálogo de boards e a marcação de posse do board da Dra Estéfani. | Captura revisada |
| Portal público (`/portal/:token`) | A captura exibiu um relatório publicado, com KPIs, receita, gráficos do snapshot e análise textual agregada. | Captura revisada |

## Fluxo de relatório e portal

Foi vinculado à conta de gestora o cliente **Dra Estéfani Molinar**, com os boards `18406699335` e `18406699304`. Em seguida, o fluxo autenticado executou a geração do relatório, salvou o snapshot de métricas, publicou o relatório e consultou o portal público pelo token exclusivo do cliente.

O teste confirmou que o relatório publicado retornou com conteúdo textual e snapshot de métricas. O portal retornou exatamente um relatório publicado. A captura do portal mostrou cartões de indicadores, receita, gráficos e texto do relatório usando o snapshot salvo. Isso confirma que o portal não depende de uma consulta ao Monday a cada acesso e que rascunhos permanecem fora da área pública.

## Validação administrativa

Além da revisão visual, as procedures do fluxo administrativo foram validadas com o contexto autenticado da gestora. A consulta de pessoas retornou a conta da Scarlett, a busca por `estefani` retornou três boards correspondentes, a reatribuição do cliente para a mesma SDR foi concluída sem alterar sua posse e a tentativa de vincular novamente o board `18406699335` foi bloqueada como duplicidade. O vínculo inicial foi realizado diretamente no banco após autorização da gestora, não por clique na interface.

> A interface do painel confirma visualmente a disponibilidade da busca e do vínculo. A proteção de duplicidade foi confirmada diretamente na procedure de administração, com a mesma autorização que a interface utiliza. Ainda é recomendável uma checagem manual de um vínculo novo pela interface antes de cadastrar todas as SDRs.

## Verificações automatizadas

| Verificação | Resultado |
|---|---|
| `pnpm check` | Concluído sem erros de TypeScript |
| `pnpm test` | 18 testes aprovados em 4 arquivos |
| `pnpm build` | Build de produção concluído |
| Autenticação do Monday | Teste aprovado com o token configurado no servidor |
| Métricas compartilhadas | 13 testes aprovados |
| Proteção contra boards duplicados | 3 testes aprovados |

## Observações

O build informa apenas um aviso de tamanho de bundle acima de 500 kB. Isso não bloqueia a publicação, mas poderá ser otimizado em uma etapa futura com carregamento sob demanda das páginas e gráficos.

O token do Monday deve continuar armazenado somente como segredo de ambiente. Caso o token enviado anteriormente no chat ainda não tenha sido revogado, ele deve ser substituído no Monday imediatamente.

## Checagem manual recomendada

Para confirmar a experiência de clique da administradora, entre em `/admin`, pesquise um board ainda não vinculado, selecione uma SDR, marque o board, informe o nome do cliente e conclua o vínculo. Em seguida, entre no dashboard dessa SDR para confirmar que o cliente aparece na sidebar. Essa checagem não foi automatizada porque exige criar ou alterar um vínculo de cliente real pela interface.

## Complemento: versão 3.4

Em 28 de agosto de 2026, a versão 3.4 foi importada preservando o vínculo da Dra Estéfani, a configuração segura do Monday e o campo de IDs de boards com capacidade de 1.024 caracteres. A atualização inclui o layout mais compacto, filtros de subitens na pesquisa de boards, detecção de colunas por título e preenchimento automático do nome do cliente no painel da gestora.

| Checagem | Evidência |
|---|---|
| Tipos | `pnpm check` concluído sem erros. |
| Testes | 26 testes aprovados, incluindo métricas, autenticação, posse de boards, ativação do vínculo e falha de carregamento do Monday. |
| Build | `pnpm build` concluído. O único aviso foi o tamanho do bundle JavaScript acima de 500 kB. |
| Telas | As rotas de dashboard, entrada, gestão e portal foram capturadas em revisão visual. A estrutura de indicadores, filtros, tabela, formulário de vínculo e portal de relatório foi renderizada. |
| Relatório com dados incompletos | A geração passou a recusar relatórios caso algum board esteja indisponível e não possua cache. |

> A revisão visual registra a renderização da versão 3.4. A confirmação de um vínculo novo pela interface continua pendente de uma ação manual da gestora, para não criar dados de teste no ambiente real.
