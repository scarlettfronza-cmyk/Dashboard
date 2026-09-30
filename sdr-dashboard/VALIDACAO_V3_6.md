# Validação da versão 3.6

## Recuperação de limite do Monday

Em 28 de agosto de 2026, o painel da gestora foi capturado durante um limite ativo da API do Monday. A tela permaneceu em carregamento enquanto a fila global executava retentativas com base no cabeçalho `Retry-After`, confirmando que a interface não descartou os dados nem retornou uma mensagem enganosa sobre token durante as tentativas.

Os testes automatizados cobrem três cenários: nova tentativa após HTTP 429, carregamento sequencial de múltiplos boards e uso do cache existente quando uma atualização recebe 429. A interface também possui uma mensagem específica e o botão **Tentar de novo** para o estado de erro final.

> A captura não alcançou o estado de erro final porque o Monday continuou devolvendo `Retry-After: 30`. A mensagem e o botão foram cobertos por teste unitário da mesma função usada pela tela administrativa.
