# Transferência Segura de Dados e Credenciais

## O que não está no arquivo ZIP

O arquivo de código foi montado sem banco de produção, tokens Meta, chaves do Monday, Telegram, Z-API, Resend, segredos JWT, arquivos `.env`, arquivos de log, `node_modules` e backup SQL existente. Essa exclusão é intencional.

## Como transferir os dados ao TI

O banco contém credenciais e dados comerciais. Faça a transferência somente por um destes métodos:

| Método | Uso recomendado |
|---|---|
| Acesso temporário e individual ao banco | Melhor opção para migração acompanhada |
| Backup cifrado entregue em link protegido por senha diferente | Opção para migração externa |
| Gerenciador de senhas com cofres separados | Para variáveis de ambiente e logins de serviços |

Não envie tokens ou backup por WhatsApp, e-mail comum, repositório Git público ou arquivo ZIP sem cifra.

## Checklist de migração

1. Criar banco MySQL/TiDB de destino com TLS.
2. Aplicar schema e migrations na ordem do repositório.
3. Importar dados de produção em canal seguro.
4. Preencher todas as variáveis de ambiente por secret manager.
5. Rodar `pnpm check`, `pnpm test` e `pnpm build`.
6. Validar uma conta administrativa, uma conta de gestor e um relatório público por token.
7. Testar uma clínica Meta antes de trocar domínio ou abrir acesso a gestores.

## Acesso externo que o TI precisará solicitar

- DNS de `escarlatedigital.com`.
- App Meta `962808522986694` e Business Manager correspondente.
- Conta/board e token Monday.
- Conta Z-API, bot Telegram e storage.
- Conta Resend após a configuração do subdomínio de envio.

