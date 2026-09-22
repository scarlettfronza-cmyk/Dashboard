# Colocar o sistema no ar

Guia para quem não programa. São cerca de 20 minutos, e nenhum passo exige
escrever código.

## Antes de começar

Você vai precisar de:

- a conta do GitHub onde está este repositório;
- o arquivo `backup.sql` (está dentro do zip `ads-dashboard_3.zip`);
- um cartão de crédito — a hospedagem custa por volta de US$ 5 por mês;
- o arquivo de segredos que foi gerado para você.

### Por que uma hospedagem, e não o GitHub

O GitHub **guarda** o código, como um Google Drive. Ele não executa nada. Para
o site existir num endereço, alguém precisa rodar o código num servidor ligado
o tempo todo — era isso que a plataforma anterior fazia.

Este sistema tem três rotinas automáticas (sincronização do Monday, alerta de
saldo e renovação de token do Instagram). Elas só funcionam com o servidor
sempre ligado, então serviços que "dormem" quando ninguém acessa não servem.

## 1. Criar a conta

Entre em <https://railway.app> e escolha **Login with GitHub**. Autorize o
acesso. Não é preciso instalar nada.

## 2. Criar o projeto a partir do repositório

1. **New Project**
2. **Deploy from GitHub repo**
3. escolha o repositório **Dashboard**
4. na tela de branch, escolha **`claude/projeto-ctg-krgqj5`**

A Railway lê o arquivo `railway.json` deste repositório e já sabe como montar
o sistema. A primeira tentativa vai falhar, porque ainda não existe banco — é
esperado, siga em frente.

## 3. Criar o banco de dados

1. dentro do mesmo projeto, **New** → **Database** → **Add MySQL**
2. espere ficar verde

**A hospedagem não liga o banco ao sistema sozinha.** É preciso dizer onde ele
está: no serviço do sistema, aba **Variables**, acrescente

```
DATABASE_URL=${{MySQL.MYSQL_URL}}
```

Isso é uma referência, não um endereço: a hospedagem substitui pelo valor real.
Troque `MySQL` pelo nome exato do card do banco, se for diferente. Sem essa
variável o sistema sobe, mas nenhuma tela com dados funciona.

## 4. Preencher as variáveis

Abra o serviço do sistema (não o do banco) → aba **Variables** → **Raw Editor**.
Cole o conteúdo do arquivo de segredos e some a estas duas:

```
PUBLIC_BASE_URL=https://SEU-ENDERECO.up.railway.app
META_APP_ID=seu app do Meta
META_APP_SECRET=segredo do seu app do Meta
```

O endereço aparece na aba **Settings** → **Domains**. Se ainda não houver um,
clique em **Generate Domain**. Copie sem a barra no final.

> As quatro chaves do arquivo de segredos são a fechadura do sistema. Se
> trocá-las depois que houver integrações salvas, os tokens guardados deixam de
> ser legíveis e as integrações precisam ser reconectadas.

## 5. Carregar seus dados

O banco nasce vazio. A importação é feita pelo navegador, sem instalar nada.

1. no serviço do sistema, aba **Variables**, acrescente uma senha longa:

```
RESTORE_TOKEN=escolha-uma-senha-de-no-minimo-16-caracteres
```

2. aguarde o serviço reiniciar
3. abra `SEU-ENDERECO/importar`
4. escolha o arquivo `backup.sql`, informe a mesma senha e clique em importar

A tela mostra quantos registros entraram em cada tabela.

**Ao terminar, remova a variável `RESTORE_TOKEN`.** Sem ela a rota deixa de
existir — é assim que a porta se fecha.

A importação é recusada quando o banco já tem registros, para não sobrescrever
dados. Com a variável ausente, a rota responde como se não existisse, de modo
que ninguém de fora descobre se ela está disponível.

> Quem preferir a linha de comando pode usar, com Node instalado:
> `DATABASE_URL="..." pnpm restaurar-backup ./backup.sql`

## 5b. Se não souber a senha do gestor

O acesso administrativo dependia do login da plataforma antiga e não existe
mais. Criar uma conta nova não resolve: as atribuições de clientes apontam
para o cadastro original, e a conta nova nasceria sem nenhuma clínica.

Para redefinir a senha de um gestor já cadastrado:

1. em **Variables**, acrescente `RECOVERY_TOKEN` com uma senha de ao menos
   16 caracteres, e aguarde o serviço reiniciar;
2. abra `SEU-ENDERECO/recuperar`;
3. informe essa senha, escolha o gestor na lista e defina a nova senha;
4. **remova `RECOVERY_TOKEN`** — sem ela a rota deixa de existir.

A senha é guardada como hash, nunca em texto. Esta porta é separada da
importação: a senha de uma não abre a outra.

## 6. Reconectar o Meta

O login administrativo usava a autenticação da plataforma antiga e não
funciona mais. O **painel de gestor tem senha própria** e funciona normalmente:

1. abra `SEU-ENDERECO/manager/login`
2. entre com um gestor já cadastrado (veio no backup)
3. abra a configuração de um cliente
4. cole um token do Meta no campo indicado

O token precisa destes escopos: `ads_read`, `business_management`,
`instagram_basic`, `instagram_manage_insights`, `pages_show_list` e
`pages_read_engagement`.

> Se der erro de versão da API, não é o token: o código usa a Graph API v19.0,
> de janeiro de 2024, que pode ter saído de suporte. A correção é uma linha em
> `server/metaApi.ts`.

### Instagram das clínicas

O mesmo token da agência lê o Instagram. Na tela do cliente, seção
**Instagram Business** → **Detectar perfis Instagram** → escolha o perfil →
salvar. Só aparecem os perfis das Páginas do Facebook que o usuário do
sistema enxerga: se faltar um, no Gerenciador de Negócios adicione a
**Página** (e o Instagram vinculado a ela) aos ativos do usuário do sistema.
O botão "Conectar via OAuth" só aparece se o app do Meta estiver
configurado no servidor (`META_APP_ID` etc.); não é necessário.

## 6b. Quando os dados do Meta não aparecem

Na configuração de cada cliente há o botão **Diagnosticar**. Ele percorre as
camadas em ordem e para no primeiro impedimento:

1. de onde vem o token, da agência ou do cliente;
2. se o Meta aceita o token;
3. quantas contas de anúncio esse token alcança;
4. se a conta escolhida está entre elas;
5. se houve investimento no período.

Dois resultados costumam confundir:

- **"não está entre as visíveis"** — compartilhar a conta como parceiro não
  basta. Ela precisa ser atribuída ao usuário do sistema que gerou o token,
  dentro do portfólio da agência.
- **"sem investimento no período"** — a configuração está correta e a conta
  responde; simplesmente não houve gasto. As campanhas podem estar em outra
  conta da mesma clínica.

O token pode ser guardado uma vez só, em **Configurações** do painel de
gestor, e passa a valer para todas as clínicas. A conta de anúncio continua
sendo escolhida em cada uma.

## 6c. WhatsApp (Z-API)

O relatório sai pelo botão **💬 WhatsApp** do painel, no grupo de cada
clínica. Os grupos já vieram no backup (18 das 19 clínicas); o que falta é
ligar o servidor à sua conta do Z-API.

1. Entre em [app.z-api.io](https://app.z-api.io) e abra a sua instância.
   Se o celular da agência estiver despareado, escaneie o QR code ali.
2. Na instância, copie três valores: **ID da instância**, **Token** e, em
   *Segurança*, o **Client-Token** da conta.
3. No Railway, serviço do dashboard → **Variables** → **New Variable**,
   uma por vez:

   | Nome | Valor |
   |---|---|
   | `ZAPI_INSTANCE_ID` | o ID da instância |
   | `ZAPI_TOKEN` | o token da instância |
   | `ZAPI_CLIENT_TOKEN` | o Client-Token |

4. Espere o serviço reiniciar. Em **Configurações** do painel, o card
   *WhatsApp da agência* deve mostrar **conectado**. Se mostrar
   *despareado*, é o QR code do passo 1; se mostrar *pendente*, ele lista
   qual variável ainda falta.

Ao clicar em **💬 WhatsApp** no painel, abre uma prévia da mensagem — o
texto pode ser ajustado antes de enviar. O link já abre o relatório no
período que estava selecionado no painel.

## 7. Conferir

- `SEU-ENDERECO/manager/login` abre a tela de entrada
- `SEU-ENDERECO/r/TOKEN` abre o relatório de um cliente

Os tokens de relatório vieram no backup, na coluna `publicToken` da tabela
`clients`.

## Se algo falhar

A aba **Deployments** → **View Logs** mostra o motivo. Os mais comuns:

| Mensagem | O que é |
|---|---|
| `DATABASE_URL is required` | o banco não foi criado, ou não está ligado ao serviço |
| `ECONNREFUSED` | o banco ainda está subindo; espere e tente de novo |
| `Link inválido` no relatório de um cliente que existe | o servidor completa sozinho as tabelas que o backup não trazia ao subir; se persistir, veja o log por `[Schema]` e abra o link com a tela mostrando o motivo real |
| `Invalid OAuth access token` | o token do Meta expirou ou está sem escopo |
