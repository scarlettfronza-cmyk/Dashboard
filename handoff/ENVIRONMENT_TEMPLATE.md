# Modelo de Variáveis de Ambiente

> Copie esta lista para o secret manager do ambiente de destino. Não converta este documento em `.env` no repositório e não preencha valores em arquivos versionados.

| Variável | Obrigatória | Finalidade |
|---|---|---|
| `DATABASE_URL` | Sim | Conexão MySQL ou TiDB com TLS. |
| `JWT_SECRET` | Sim | Sessão administrativa da plataforma. |
| `MANAGER_JWT_SECRET` | Sim | Sessões de gestores. Deve ser diferente de `JWT_SECRET`. |
| `OAUTH_STATE_SECRET` | Sim | Assinatura do state OAuth Meta. Deve ser diferente dos JWTs. |
| `PUBLIC_BASE_URL` | Sim | `https://dashboard.escarlatedigital.com`, sem barra no final. |
| `META_APP_ID` | Sim para Meta | App Meta atual. |
| `META_APP_SECRET` | Sim para Meta | Segredo do App Meta. |
| `INTEGRATION_ENCRYPTION_KEY` | Sim | Cifra de tokens e credenciais persistidas. |
| `MONDAY_API_TOKEN` | Sim para Monday | Leitura e sincronização de dados comerciais. |
| `ZAPI_INSTANCE_ID` | Sim para WhatsApp | Instância Z-API. |
| `ZAPI_TOKEN` | Sim para WhatsApp | Token de autenticação Z-API. |
| `ZAPI_CLIENT_TOKEN` | Sim para WhatsApp | Token de cliente Z-API. |
| `TELEGRAM_BOT_TOKEN` | Sim para alertas | Bot operacional. |
| `TELEGRAM_CHAT_ID` | Sim para alertas | Destino de alertas operacionais. |
| `RESEND_API_KEY` | Pendente | Envio de e-mails de recuperação de senha. |
| `RESEND_FROM_EMAIL` | Pendente | Remetente esperado: `Escarlate Dashboard <acesso@envio.escarlatedigital.com>`. |
| `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY` | Se mantiver Manus | Serviços de IA e storage da plataforma. |
| `VITE_FRONTEND_FORGE_API_URL` e `VITE_FRONTEND_FORGE_API_KEY` | Se mantiver Manus | Recursos Forge consumidos pelo frontend. |

## Regras de geração e rotação

Cada segredo de sessão deve ter ao menos 32 bytes aleatórios. Não reutilize a mesma chave entre JWT administrativo, JWT de gestor, OAuth state e cifra de integrações. Ao trocar qualquer uma dessas chaves, planeje a invalidação de sessão e teste o login antes de colocar em produção.

