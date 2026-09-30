# Colocar o Dashboard SDR no ar

Guia para quem não programa, no mesmo caminho usado para o dashboard de
tráfego. São cerca de 20 minutos, e nenhum passo exige escrever código.

O Dashboard SDR é um **segundo serviço** no mesmo projeto da Railway, com
banco e endereço próprios. O dashboard de tráfego não é afetado.

## Antes de começar

Você vai precisar de:

- o backup do banco do SDR Dashboard no Manus (um arquivo `.sql`);
- um token novo da API do Monday (o antigo precisa ser revogado, veja o passo 3);
- se quiser envio automático no grupo: os dados da Z-API (instância, token e
  client token). Pode ser a mesma instância do dashboard de tráfego; nesse
  caso as mensagens saem do mesmo número.

## 1. Criar o serviço

1. abra o projeto do dashboard de tráfego na Railway (ou crie um novo)
2. **New** → **GitHub Repo** → escolha o repositório **Dashboard**
3. no serviço novo, aba **Settings**:
   - **Source** → **Root Directory**: `/sdr-dashboard`
   - **Branch**: a mesma branch em que este código está
   - **Config-as-code** → **Railway Config File**: `/sdr-dashboard/railway.json`
     (a Railway não procura este arquivo dentro da Root Directory sozinha)
   - **Watch Paths**: `/sdr-dashboard/**` (assim, mudanças no dashboard de
     tráfego não reconstroem este)
4. renomeie o serviço para algo como **sdr-dashboard**

Com isso a Railway já sabe como montar o sistema. A
primeira tentativa pode falhar por falta de banco. Isso é esperado.

## 2. Criar o banco

1. no projeto, **New** → **Database** → **Add MySQL**
2. renomeie o card do banco para **MySQL-SDR** (para não confundir com o do tráfego)
3. no serviço **sdr-dashboard**, aba **Variables**, acrescente:

```
DATABASE_URL=${{MySQL-SDR.MYSQL_URL}}
```

Troque `MySQL-SDR` pelo nome exato do card, se for diferente. Ao subir, o
sistema cria sozinho as tabelas que faltarem.

## 3. Preencher as variáveis

No serviço **sdr-dashboard** → **Variables** → **Raw Editor**, acrescente:

```
JWT_SECRET=uma-frase-longa-e-aleatoria-com-mais-de-32-caracteres
MONDAY_API_TOKEN=o-token-novo-do-monday
```

**Token do Monday:** o token usado no Manus apareceu no código que ia para o
navegador e deve ser tratado como vazado. No Monday: avatar → **Developers** →
**My access tokens** → gere um novo e revogue o antigo.

Opcionais:

```
PUBLIC_APP_URL=https://SEU-ENDERECO
ZAPI_INSTANCE_ID=...
ZAPI_TOKEN=...
ZAPI_CLIENT_TOKEN=...
```

- `PUBLIC_APP_URL` é o endereço que vai no link enviado às clínicas. Sem ele,
  o link usa o endereço aberto no navegador da SDR, que é o mesmo. O endereço
  aparece em **Settings** → **Networking** → **Generate Domain**. Copie sem a
  barra no final.
- Sem as três da Z-API, a SDR entrega pelo botão **Abrir no WhatsApp**, que
  abre o WhatsApp com a mensagem pronta para ela escolher o grupo.

## 4. Carregar os dados do Manus

1. em **Variables**, acrescente uma senha longa:

```
RESTORE_TOKEN=escolha-uma-senha-de-no-minimo-16-caracteres
```

2. aguarde o serviço reiniciar
3. abra `SEU-ENDERECO/importar`
4. escolha o arquivo `.sql`, informe a mesma senha e clique em importar

A tela mostra quantos registros entraram em cada tabela (usuários, SDRs,
clientes e relatórios). A importação é recusada se o banco já tiver dados.

**Ao terminar, remova `RESTORE_TOKEN`.** Sem ela a rota deixa de existir.

Os dados do Monday não precisam de backup: o sistema copia de novo sozinho,
alguns boards a cada 5 minutos. Na primeira meia hora, algumas clínicas podem
mostrar o aviso de dados sendo copiados, ou a SDR pode clicar em
**Atualizar dados**.

## 5. Entrar pela primeira vez

No Manus, a gestora entrava pelo login do Manus, que não existe fora dele.
Por isso a conta dela provavelmente ainda não tem senha.

1. em **Variables**, acrescente `RECOVERY_TOKEN` com outra senha de ao menos
   16 caracteres, e aguarde reiniciar
2. abra `SEU-ENDERECO/recuperar`
3. informe essa senha, escolha a conta da gestora (aparece como "gestora") e
   defina a nova senha. Se a conta não tiver e-mail, a tela pede um
4. **remova `RECOVERY_TOKEN`**
5. entre em `SEU-ENDERECO/entrar` com o e-mail e a senha nova

Criar uma conta nova não resolve: clientes e relatórios apontam para o
cadastro original.

## 6. Login da SDR

Em `SEU-ENDERECO/admin`, quadro **Logins**:

- **SDR que já existia no Manus** (ex.: Luana): se aparecer "sem senha",
  clique em **Definir senha** e passe a senha para ela. A carteira dela
  continua a mesma.
- **SDR nova:** preencha nome, e-mail e senha inicial em **Criar login de
  SDR**. Depois vincule os clientes dela na coluna ao lado, como antes.

Ela entra em `SEU-ENDERECO/entrar`. Pode trocar a senha depois.

## 7. Grupo do WhatsApp de cada clínica

Só com a Z-API configurada. A SDR, na aba **Relatório** da clínica, escolhe o
grupo em **Grupo do WhatsApp da clínica**. Aparecem os grupos de que o
número da Z-API participa: se faltar um, adicione esse número ao grupo.

## Como a SDR entrega o relatório

1. escolhe a clínica e o período no topo
2. abre a aba **Relatório**: o texto já vem pronto com os números do Monday
3. ajusta o texto se quiser
4. clica em **Enviar no grupo**: confere a mensagem e confirma

O relatório é publicado no portal da clínica e a mensagem sai com o link.
Sem Z-API, **Abrir no WhatsApp** faz o mesmo, só que ela escolhe a conversa.

## Depois de no ar

- desligue o SDR Dashboard no Manus só depois de conferir que tudo abre aqui
- confira os números de agosto da Luana contra a tabela oficial da gestora
  (seção 8 do handoff em `docs/`)
