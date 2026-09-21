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

A Railway cria a variável `DATABASE_URL` sozinha e liga no sistema.

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

O banco nasce vazio. Para trazer clientes, vendas e gestores do backup:

1. no serviço do **banco**, aba **Variables**, copie o valor de `DATABASE_URL`
2. no seu computador, na pasta do projeto, rode:

```bash
pnpm install
DATABASE_URL="cole-aqui" pnpm restaurar-backup ./backup.sql
```

O script mostra quantos registros entraram em cada tabela. Ele se recusa a
rodar se o banco já tiver dados, a não ser que você acrescente `--forcar`.

Se não quiser instalar nada no seu computador, peça a alguém para rodar esse
comando — é o único passo que sai do navegador, e leva menos de um minuto.

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
| `Invalid OAuth access token` | o token do Meta expirou ou está sem escopo |
