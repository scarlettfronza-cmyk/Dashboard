# Validação de Segurança do Link Público

## Rota legada por slug

Foi aberta a rota pública legada `/r/dra-tatiana` na prévia de desenvolvimento após a remoção da aceitação de slugs no servidor. Após o ciclo de consulta, a página exibiu “Link inválido. Este link não existe ou expirou.”, sem carregar identificação, métricas ou conteúdo da clínica.

## Rota por token seguro

A rota do Dr. Mario com token hexadecimal de 48 caracteres carregou o relatório público normalmente, exibindo apenas as abas Resultados e Conteúdos. Isso confirma que o acesso continua funcional somente com o token forte.

## Controles implementados

O servidor passou a aceitar somente tokens hexadecimais fortes de 48 a 64 caracteres. Slugs deixam de ser aceitos em todas as consultas públicas de cliente, KPIs, conteúdos, criativos e geração de relatório. Os links podem ser regenerados por administradora ou gestora responsável, invalidando o token anterior.

O acesso autenticado de uma gestora a relatório fora da própria carteira passa a ser bloqueado, registrado na tabela `public_report_access_logs` e enviado ao Telegram configurado para a operação. O token é registrado apenas por impressão SHA-256, nunca em texto puro.
