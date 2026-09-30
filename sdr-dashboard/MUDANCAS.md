# Mudanças aplicadas — segurança e correção de dados

## ⚠️ Fazer antes de qualquer deploy

**1. Revogar o token do Monday.com.**
O arquivo `client/src/hooks/useMondayData.ts` continha um token pessoal da API do
Monday escrito direto no código, com escopo `me:write`. Como esse arquivo é
compilado no bundle JavaScript entregue ao navegador, o token estava público
para qualquer pessoa que abrisse o dashboard e olhasse o código-fonte da página.
Com ele é possível ler e **escrever** em toda a conta do Monday da agência.

Trocar o token de lugar no código não resolve: ele já circulou. É preciso:

1. Monday → avatar → **Developers** → **My access tokens** → revogar o token atual.
2. Gerar um novo.
3. Cadastrar como variável de ambiente `MONDAY_API_TOKEN` no servidor (nunca no
   `.env` versionado, nunca em documento, nunca em conversa).
4. Se o projeto tiver histórico Git, o token continua nos commits antigos mesmo
   depois desta mudança — mais um motivo para a revogação ser obrigatória.

**2. Configurar `PUBLIC_APP_URL`.** Sem ela o botão "Link do cliente" não aparece.
O link antes era montado com `window.location.origin`, então um acesso pelo
domínio de preview gerava links de portal que o médico não conseguia abrir.

Veja `.env.example`.

**3. Rodar a migração** `drizzle/migrations/0001_report_status_and_ownership.sql`.
Ela apaga relatórios com `clientId = 0` — leia a seção correspondente antes.

---

## Bugs corrigidos

### O portal do cliente nunca funcionou

`AnaliseIA.tsx` enviava `clientId: 0` fixo em toda geração de relatório. O portal
busca relatórios por `clientId`, então nenhum relatório jamais apareceu para
nenhum médico. Todos os relatórios já gerados estão gravados com cliente 0 e não
têm como ser reatribuídos — a migração os remove.

### Qualquer usuário logado podia ler dados de qualquer cliente

`generateAnalysis` recebia `clientId` do frontend e, na prática, nem o usava para
autorizar. `reports` e `chatHistory` filtravam por SDR mas aceitavam `clientId`
arbitrário. Agora todo acesso passa por `requireClient()`, que confere a posse
antes de qualquer leitura, com admin como exceção explícita.

### O servidor confiava nos números enviados pelo navegador

O relatório era gerado a partir de `leadsData: string`, um JSON de métricas
calculado no frontend. Qualquer pessoa podia mandar números inventados e o
servidor os gravava como relatório oficial do cliente. Agora o servidor busca os
leads no Monday e calcula tudo com `shared/metrics.ts`; o frontend envia apenas
cliente e período.

### O médico via rascunhos

O portal listava todos os relatórios do cliente assim que gerados, incluindo cada
versão intermediária produzida durante os ajustes. Agora existe `status`
(`draft` / `published`) e o portal só devolve publicados. Revisar um relatório
publicado o devolve para rascunho.

### O filtro "Hoje" quebrava à noite

Os atalhos usavam `new Date().toISOString()`, que devolve a data em UTC. No
horário de Brasília (UTC-3), a partir das 21h o filtro passava a buscar o dia
seguinte e vinha vazio. Todo cálculo de data agora passa por `todayInTz()`, com
`America/Sao_Paulo` explícito.

### Os mesmos KPIs mostravam valores diferentes por tela

As métricas eram calculadas em três lugares com fórmulas divergentes:
`useMondayData.computeStats`, `Home.filteredStats` e `Overview.filteredStats`.
Duas diferenças concretas:

- **Receita**: sem filtro, somava só negócios fechados; com filtro ativo, somava
  o valor de *todos* os leads. O card mudava de valor ao clicar num cliente.
- **Agendamentos**: em `Home` era "leads com qualquer status preenchido", no hook
  era "leads com data de consulta".

Agora existe um cálculo só, em `shared/metrics.ts`, usado pelo servidor e pelo
frontend.

### Cada métrica agora usa a sua própria data

O filtro antigo escolhia uma data por lead (`dataConversao || dataConsulta`),
filtrava tudo por ela e contava em cima do resultado. Consequência: uma cirurgia
fechada em agosto, de um lead que entrou em julho, sumia do relatório de agosto.
Agora leads recebidos contam por data de conversão, agendamentos por data de
consulta, e fechamentos por data de fechamento. As regras estão em
`METRIC_DEFINITIONS`, no topo de `shared/metrics.ts` — vale revisar com a Luana e
a Bruna, porque é aí que SDR e médico precisam concordar.

### "SDR não encontrado"

Cada procedure repetia a busca do perfil e três delas lançavam esse erro. Agora
`sdrProcedure` faz o upsert idempotente uma vez, para todas. O índice único em
`sdrs.userId` impede que duas requisições simultâneas criem dois perfis.

`sdrs.email` deixou de ser único: vinha do OAuth e podia repetir, derrubando o
cadastro do segundo usuário com "Duplicate entry".

---

## Mudanças estruturais

**Monday no backend** (`server/monday.ts`). Busca, paginação e normalização
saíram do navegador. Ganhos além da segurança: cache de 5 minutos, tratamento de
rate limit (429), e um board com problema não derruba mais o dashboard inteiro —
serve o cache anterior ou devolve vazio.

**Perfis de coluna nomeados.** O `if (format === "A") ... else ...` virou
`COLUMN_PROFILES`, com `agendamento_v1` e `ellora`. Ainda é código, mas agora é
uma estrutura de dados: mover para uma tabela `board_column_mappings` é o próximo
passo, e é o que vai permitir cadastrar cliente novo sem deploy.

**Cliente identificado por ID.** `Home.tsx` guardava o *nome* do cliente ativo e
procurava o token do portal casando strings. A sidebar vinha de `ALL_BOARDS`, uma
constante do frontend que podia divergir da tabela `clients` — daí clientes
aparecerem sem token. Agora a sidebar vem do banco e o estado guarda o registro.

**Suporte a múltiplos boards por cliente.** `clients.boardId` aceita
`"id1,id2"`, então o board de agendamentos e o de atendimento diário do mesmo
médico entram como um cliente só.

**Mini-chat que edita de verdade.** Antes ele conversava e o relatório ficava
intocado. `reviseReport` devolve o texto revisado, substitui o conteúdo e recebe
o snapshot de métricas no prompt para não inventar números.

**Comparativo de período.** Todo relatório agora inclui os números do período
anterior de mesma duração, o que dá ao texto o "melhoramos X% em relação ao mês
passado" sem que a IA precise calcular nada.

**Rotação de token do portal** (`rotateClientToken`), para o caso de um link
vazar.

## Arquivos removidos

`ChatIA.tsx`, `Clientes.tsx` e `AIChatBox.tsx` não eram importados por lugar
nenhum — restos das iterações que o handoff pede para não reintroduzir.
`check_db.mjs` era um script solto de depuração.

---

## O que ainda falta

1. **Rodar `pnpm install`, `pnpm check` e `pnpm test`.** Não tive rede nem
   `node_modules` no ambiente, então validei sintaxe e a lógica de
   `shared/metrics.ts` isoladamente, mas o projeto não foi compilado. Espere
   ajustes de tipo, principalmente nas props de `Overview` e `GestaoVendas`.
2. **Migrar as páginas para `Metrics`.** `toDashboardStats()` em
   `useMondayData.ts` é um adaptador temporário para não mexer em quatro telas de
   uma vez. `Overview` e `GestaoVendas` ainda têm recálculo interno morto, agora
   inalcançável porque `meses={[]}`.
3. **Mapeamento de colunas no banco**, com passo de mapeamento no cadastro de
   cliente. Enquanto isso não existir, board novo com layout diferente entra
   silenciosamente vazio.
4. **Sync histórico.** Os boards do Monday são mutáveis: mudar o status de um
   lead hoje altera o relatório de junho. Relatórios já publicados guardam
   `metricsSnapshot`, então esses estão preservados — mas o dashboard ao vivo
   continua reescrevendo o passado. Um job que grave snapshots diários resolve.
5. **LGPD.** O sistema trata dados de pacientes e procedimentos, que são dados
   sensíveis de saúde. O portal hoje expõe apenas texto agregado, o que está
   certo — vale manter essa regra explícita e decidir formalmente o que pode ser
   enviado ao LLM.
6. **Permissões de admin.** `requireClient` já trata `role === "admin"`, mas
   ninguém recebe esse papel automaticamente exceto o `OWNER_OPEN_ID`.

---

# Segunda rodada — login próprio, painel da gestora e tema claro

## Login com e-mail e senha

Qualquer pessoa com o endereço do site cria uma conta em `/entrar`, como você
pediu. **Conta nova nasce sem nenhum cliente vinculado**: quem entra sem ter
sido convidado vê uma tela vazia com uma mensagem pedindo para avisar a gestora.
Nenhum board, dado de paciente ou relatório fica acessível antes de você
vincular os clientes. Na prática o cadastro é aberto e os dados continuam
fechados — o portão é o painel, não a porta de entrada.

Detalhes:

- Senha guardada com **scrypt** (função nativa do Node, sem dependência nova),
  salt aleatório por senha. A senha em si nunca é gravada nem vai para log.
- Mínimo de 8 caracteres, sem exigir símbolo ou maiúscula. Regra complicada
  empurra as pessoas para "Senha@123" e para o post-it na mesa; o que protege de
  verdade é o limite de tentativas.
- **8 tentativas erradas por e-mail + IP a cada 15 minutos.** Depois disso, o
  login trava.
- E-mail errado e senha errada devolvem a mesma mensagem, senão dá para
  descobrir quais e-mails têm conta no sistema testando um por um.
- Sessão de 30 dias em cookie assinado, `httpOnly` (o JavaScript da página não
  consegue ler).
- **A primeira conta criada vira administradora automaticamente** — a sua.
  Crie a sua conta antes de mandar o link para as SDRs. Se alguém se cadastrar
  antes, você pode promover a si mesma direto no banco:
  `UPDATE users SET role = 'admin' WHERE email = 'seuemail@...';`

O login Manus continua funcionando para as contas que já existiam; os dois
convivem.

## Painel da gestora (`/admin`)

Aparece um botão "Painel" na barra superior para quem é admin.

- **Coluna esquerda**: as SDRs cadastradas, quantos clientes cada uma tem, as
  contas novas que ainda não foram ativadas, e a lista de todos os clientes
  vinculados com a SDR responsável.
- **Coluna direita**: busca em todos os boards da conta do Monday. A busca
  ignora acento e maiúscula, então "estefani" acha "Dra Estéfani". Cada board
  mostra o workspace, a quantidade de itens e o ID; os já vinculados aparecem
  esmaecidos com o nome do cliente e da SDR.

Fluxo: clica na SDR → busca o board → marca um ou mais → digita o nome do
cliente → "Vincular à SDR". Nenhum ID de board precisa ser digitado à mão.
Marcar dois boards de uma vez cria um cliente só, que é o caso do médico com
board de agendamentos e board de atendimento diário.

Um board não pode pertencer a dois clientes ao mesmo tempo — senão os mesmos
números apareceriam em dois dashboards.

Remover um cliente **desativa** em vez de apagar: o portal para de responder,
mas os relatórios já enviados continuam salvos.

## Tema claro

Fundo quase branco, cartões brancos, texto escuro. A escala usa um cinza
levemente azulado em vez de cinza puro, para não ficar com cara de planilha. O
texto principal ficou em contraste ~13:1 e o secundário ~5:1, ambos acima do
mínimo de acessibilidade.

Todos os textos de 11–12px subiram para 14px. Os números dos KPIs usam dígitos
de largura fixa, então não "dançam" quando o valor atualiza.

`Login.tsx` foi removido — era a tela antiga do Manus e não estava mais sendo
importada.

## Ainda pendente nesta rodada

- **Recuperação de senha por e-mail** não existe. Se uma SDR esquecer, hoje só
  dá para resolver criando outra conta ou mexendo no banco. Precisa de um
  serviço de envio de e-mail configurado.
- O limite de tentativas fica na memória do servidor: reinicia junto com ele, e
  se um dia o app rodar em mais de uma instância, cada uma conta separado.
- Continua valendo tudo da primeira rodada: **revogar o token do Monday**,
  configurar `MONDAY_API_TOKEN` e `PUBLIC_APP_URL`, rodar a migração e executar
  `pnpm install && pnpm check && pnpm test`.

---

# Terceira rodada — relatório visual para o cliente e para a SDR

## O portal do médico virou um relatório de verdade

Antes era só o texto corrido. Agora, ao abrir o link, o médico vê:

- **Leads, agendamentos, procedimentos fechados e taxa de conversão** em
  cartões grandes, cada um com a variação contra o período anterior (seta verde
  ou vermelha e o valor de comparação).
- **Receita do período** em destaque próprio, em número grande — é o dado que
  ele procura primeiro.
- **Quatro gráficos**: pizza de canal de aquisição, pizza de procedimentos mais
  procurados, pizza de situação dos leads e barras de evolução por mês.
- **A análise escrita** logo abaixo dos números.

Cada relatório publicado vira um bloco que abre e fecha; o mais recente já vem
aberto.

## Os gráficos vêm do snapshot, não de consulta ao vivo

Essa é a decisão mais importante desta rodada, e vale entender o porquê.

Os boards do Monday mudam o tempo todo. Se os gráficos do portal buscassem os
dados ao vivo, um lead alterado semana que vem faria o gráfico de agosto passar
a mostrar um número diferente do que está escrito no texto de agosto que você já
mandou. O médico abriria o link e veria o relatório se contradizendo.

Então cada relatório guarda a fotografia dos números do momento em que foi
gerado, e é dela que os gráficos são desenhados. Número e texto nunca divergem,
e o histórico fica preservado mesmo quando o board muda.

Tem um ganho de segurança junto: o portal é público e sem login. Se cada visita
disparasse uma consulta ao Monday, bastaria alguém ficar recarregando a página
para estourar o limite da API e derrubar a integração de todo mundo. Servindo do
snapshot, recarregar não custa nada.

## A SDR vê exatamente o que o cliente vai ver

Na aba Análise com IA aparece agora uma **prévia do que o cliente vê**, acima do
texto — os mesmos cartões e os mesmos gráficos, montados pelo mesmo componente.
Serve para conferir os números antes de publicar.

A Visão Geral também passou a usar esse componente. Ela antes recalculava as
métricas por conta própria, com fórmulas diferentes das do resto do sistema;
agora só desenha o que recebe, então não há mais como um número divergir entre a
tela da SDR e o portal do médico.

## Detalhes de legibilidade

- Pizzas com muitas fatias viravam confete ilegível. Canal e situação mostram no
  máximo 6 fatias, procedimentos 8, e o resto é agrupado em "Outros" — a soma
  continua batendo com o total de leads.
- A legenda de cada pizza repete o número absoluto ao lado da porcentagem. Quem
  abre no celular não consegue passar o dedo em cima da fatia para ver o balão.
- Quando não há período anterior para comparar, aparece "sem comparativo" em vez
  de "+∞%", que é o que sairia de uma divisão por zero.
- O texto do relatório continua renderizado como texto puro, nunca como HTML ou
  markdown. É conteúdo em página pública e não vale o risco.

## O que continua pendente

Tudo das rodadas anteriores: **revogar o token do Monday**, configurar
`MONDAY_API_TOKEN` e `PUBLIC_APP_URL`, rodar a migração, criar a sua conta antes
das SDRs (a primeira vira admin), e rodar
`pnpm install && pnpm check && pnpm test`. Some a isso a recuperação de senha por
e-mail, que ainda não existe.

`GestaoVendas` é a última tela que ainda consome o formato antigo de stats pelo
adaptador `toDashboardStats`. Funciona e os números são os mesmos, mas é o
próximo pedaço a migrar.

---

# Correção — board duplicado entre SDRs

Encontrado ao preparar o primeiro vínculo real pelo painel.

**O problema.** Um mesmo board do Monday podia acabar vinculado a duas pessoas
ao mesmo tempo, por dois caminhos:

1. O cadastro automático por nome que sobrou da primeira rodada. Quem entrasse
   com o nome "Luana" ganhava 5 clientes prontos, sem verificar se aqueles
   boards já pertenciam a alguém. Se a gestora vinculasse esses boards a si
   mesma para testar e a Luana se cadastrasse depois, os mesmos boards seriam
   criados de novo debaixo dela.
2. O botão "+" da própria SDR (`addClient`) checava duplicidade só entre os
   clientes dela, não no sistema inteiro.

Nos dois casos o mesmo board apareceria em dois dashboards, cada SDR achando que
o resultado era dela, e os números do relatório sairiam contados em dobro.

**A correção.**

- O cadastro automático foi removido. Conta nova nasce sem cliente nenhum e todo
  vínculo passa pelo painel da gestora, que é o único caminho com a verificação
  correta. O painel já existe, então o atalho por nome só atrapalhava.
- O `addClient` agora faz a checagem global. Quando o board pertence a outra
  SDR, a mensagem orienta a pedir a transferência para a gestora, em vez de
  falar o nome de um cliente que não é dela.

Para mover um cliente entre SDRs existe `reassignClient` no painel: os
relatórios e o link do portal acompanham o cliente, então nada se perde.

---

# Versão 3.2 — quatro correções vindas do teste no painel

## 1. O vínculo falhava com muitos boards (o erro da captura)

`clients.boardId` guarda os IDs separados por vírgula e estava limitado a 64
caracteres. Seis IDs do Monday somam 69, então o insert era rejeitado com
"Data too long for column" e nada era salvo — apesar de a interface parecer que
tinha funcionado. Com um ou dois boards passava; com cinco ou seis, não.

A coluna foi para 512 caracteres. **Rode
`drizzle/migrations/0002_widen_board_ids.sql`** antes de tentar de novo.

## 2. O tema claro não estava aplicando

O `index.css` tinha **dois** blocos `:root`. O da paleta clara foi escrito em
cima do primeiro, mas o bloco escuro original ("Midnight Operations") vinha
depois no arquivo e sobrescrevia tudo pelo cascade do CSS. Por isso o painel
continuava escuro mesmo com o tema claro configurado. O bloco escuro foi
removido.

## 3. Duas caixas de texto lado a lado

A segunda caixa não era outra busca — era o nome que o cliente veria no
relatório. Ficava vazia e sem rótulo, encostada na busca, então parecia um
segundo campo de pesquisa que travava o botão.

Agora ela **se preenche sozinha** a partir dos boards marcados: selecionar
"Agendamentos Ellora- Dra Tatiana Patruni" e "Atendimento - Dra Tatiana Patruni"
já escreve "Dra Tatiana Patruni". O campo ganhou rótulo e continua editável.

Também recebeu `autoComplete="off"`. Na captura ele aparece preenchido com
"Scarlett Fronza" — era o navegador achando que se tratava de um campo de nome
de pessoa e completando com o do usuário logado. Se aquele vínculo tivesse
passado, o médico teria recebido um relatório com o nome errado no título.

## 4. Boards de subitens poluindo a busca

O Monday cria um board espelho para os subitens de cada board real
("Subelementos de Atendimento - ..."). Eles nunca têm dados próprios e não
servem para vincular, mas ocupavam metade dos resultados — na busca por "tati",
3 dos 6 resultados eram espelhos. Agora são filtrados do catálogo.

Como efeito colateral, o total de boards da conta vai cair bastante em relação
aos 338 mostrados antes. É esperado.

---

# Versão 3.3 — correções vindas das telas da Dra Estéfani

## 1. "De onde vieram os leads" estava vazio (o problema de fundo)

O gráfico de canal aparecia com "Sem dados neste período" e a coluna CANAL da
tabela mostrava "—" em todas as 214 linhas, mesmo com o board preenchido.

A causa: os IDs de coluna do Monday são gerados por board. Duas clínicas com uma
coluna "Canal de Aquisição" têm IDs diferentes. Como o mapeamento era uma lista
fixa de IDs, o board da Dra Estéfani não batia com nenhum e o campo vinha vazio,
sem nenhum erro — só um gráfico sem dados.

**Correção estrutural:** as colunas passam a ser detectadas pelo **título**, com
o tipo da coluna desempatando (só uma coluna de data vira data, só uma numérica
vira valor). Os perfis por ID continuam como reserva para o que a detecção não
achar.

Isso resolve muito além deste caso: era o motivo pelo qual cada cliente novo
exigia um deploy. Agora um board com "Origem do lead", "Situação" e "Preço" é
lido sem nenhuma configuração.

Se algum campo continuar vazio depois desta versão, me diga o título exato da
coluna no Monday e eu incluo o padrão.

## 2. "Evolução por mês" mostrava "Agendamento" e "Agendamento- antigo"

Aqueles são nomes de grupo do Monday, não meses. O gráfico usava `l.group`, que
em alguns boards é mesmo um mês e em outros não tem relação com tempo.

Agora o mês é derivado da data real do lead e rotulado em português
("fev/26", "abr/26"), em ordem cronológica. Lead sem data nenhuma fica de fora
da linha do tempo em vez de criar uma barra "Sem mês".

## 3. Selos de status ilegíveis na tabela

Os selos tinham cores do tema escuro — texto claro sobre fundo escuro
translúcido. Sobre o branco, "Em negociação" virava laranja sobre laranja.
Refeitos com fundo bem claro e texto escuro, contraste acima de 4.5:1.

## 4. Cartões e gráficos ainda escuros

Já corrigido na v3.2, que aparentemente ainda não estava aplicada quando essas
telas foram tiradas — era o segundo bloco `:root` sobrescrevendo a paleta clara.
Os cartões de KPI e os gráficos vão clarear junto.

## 5. Campos de data em mm/dd/yyyy

O `index.html` declarava `lang="en"`, então o navegador desenhava os seletores
de data no formato americano. Passou para `pt-BR`.

## Uma observação sobre os números

"Leads recebidos" e "Agendamentos" aparecem os dois como 214. Não é erro de
cálculo: nesse board todo lead tem data de consulta, então as duas métricas
contam o mesmo conjunto. Vale decidir com a SDR se, para esse formato de board,
faz sentido mostrar os dois cartões ou trocar um deles por algo que diferencie —
por exemplo, consultas já realizadas contra consultas ainda por acontecer.

---

# Versão 3.4 — layout mais enxuto

Na rodada do "mais visível" eu aumentei tudo, e numa tela larga isso virou oito
cartões grandes mais um banner de receita de largura inteira antes de qualquer
gráfico aparecer. Apertado:

**Uma linha de números em vez de duas mais um banner.** Cinco cartões:
Leads, Agendamentos, Fechados, Conversão e Receita — a receita entrou na linha,
destacada em roxo, em vez de ocupar uma faixa própria. Cada cartão ficou mais
baixo e o número passou de 30px para 24px, ainda bem legível.

**Métricas de apoio viraram uma tira fina.** Compareceram, taxa de
comparecimento, em negociação, perdidos e ticket médio agora são uma linha de
texto num fundo cinza claro, não cinco cartões. Continuam à mão, param de
competir por atenção com os números principais.

**Largura máxima de 1400px.** Metade da sensação de "gigantesco" vinha do
conteúdo esticando de ponta a ponta num monitor largo. Agora ele centraliza.

**Gráficos menores.** As roscas passaram de 176px para 128px e a legenda de 16
para 14px; o gráfico de barras encolheu de 224px para 176px de altura. Cabem
dois lado a lado sem rolar tanto.

**Cabeçalho e barra de filtro mais finos**, ganhando altura útil no topo.

O resultado é que os quatro gráficos ficam visíveis com bem menos rolagem. Se
ainda parecer apertado ou frouxo demais, é fácil ajustar — os tamanhos estão
todos em `client/src/components/ReportVisuals.tsx`.
