# Plano de Lançamento Controlado do Escarlate Dashboard

> **Nota de escopo:** este é um plano operacional e técnico, não aconselhamento jurídico, tributário ou contábil. Antes de comercializar o produto, um advogado com experiência em LGPD e contratos SaaS deve revisar os documentos e a definição dos papéis de cada parte.

## Decisão recomendada

A landing pode ser construída como ativo comercial, mas **não deve abrir venda pública, assinatura automática ou teste autônomo ainda**. A versão inicial deve convidar apenas para um **piloto fechado**, com dois ou três gestores conhecidos, por convite e com acompanhamento próximo. A página pode usar um CTA como “Quero participar do piloto” ou “Agendar demonstração”, sem preços públicos e sem promessa de onboarding em prazo fixo.

Essa sequência protege o produto e a agenda da operação. O objetivo do piloto não é maximizar receita no primeiro mês. É descobrir, em ambiente controlado, os problemas de isolamento de dados, onboarding, cobrança, suporte e uso real antes de assumir obrigações com dezenas de contas.

## Por que a mudança de modelo exige preparação

A LGPD trata como **controlador** quem toma decisões sobre o tratamento de dados pessoais e como **operador** quem trata dados em nome do controlador. A lei também exige medidas técnicas e administrativas de segurança, prevenção e prestação de contas. O papel exato do Escarlate, do gestor pagante e da clínica dependerá do contrato, dos fluxos e de quem decide finalidades e meios do tratamento. [1]

| Tema | Situação que deve estar resolvida antes da venda pública | Decisão operacional proposta |
|---|---|---|
| Acesso público a relatórios | Um link não pode depender de um slug previsível nem permanecer válido sem possibilidade de revogação. | Usar token aleatório por relatório, sem consulta pública por slug; permitir regenerar e invalidar o link em um clique. |
| Segredos de integração | Tokens de Meta, Monday e demais integrações não devem ficar disponíveis em texto simples no banco. | Implementar criptografia de aplicação para segredos, chaves fora do banco e rotação documentada. |
| Autenticação | Não pode existir segredo de fallback, sessão longa sem revogação ou ausência de recuperação de senha. | Falhar a inicialização sem segredo válido, reduzir e revogar sessões quando necessário, criar recuperação por e-mail com token de uso único. |
| Dados de pacientes | Os gestores passam a colocar no sistema dados de clínicas de terceiros. | Criar isolamento por gestor, logs de acesso, mínimo de dados no relatório público e contrato de tratamento de dados revisado por advogado. |
| Incidentes | É preciso saber quem detecta, comunica, investiga e corrige uma exposição. | Definir playbook de incidente, responsável, canal de contato, registro de eventos e prazo interno de triagem. |
| Pagamento e inadimplência | A suspensão não pode apagar dados de forma improvisada nem surpreender a operação da clínica. | Definir cobrança recorrente, prazo de aviso, modo somente leitura, exportação e política de retenção antes de desligar uma conta. |
| Suporte | Cliente pagante cria expectativa de resposta e disponibilidade. | Declarar horário, canal, tempo-alvo de resposta e o que é suporte de produto versus consultoria de tráfego. |

## Ordem de execução recomendada

### Fase A: Bloquear riscos críticos

Primeiro, resolver quatro itens que não devem coexistir com contas externas: acesso público baseado em slug, tokens em texto simples, `fallback-secret` e recuperação de senha inexistente. Esta fase também deve incluir revisão de autorização em cada rota para garantir que um gestor nunca consulte, altere ou gere link de outro gestor.

O critério de saída é simples: nenhum relatório público é acessível por identificador previsível, todo segredo de integração está protegido em repouso, o servidor não inicia sem chave válida e toda conta pode redefinir senha por um link temporário e revogável.

### Fase B: Formalizar a operação de dados e cobrança

Antes de cobrar, preparar um pacote mínimo de operação: contrato de serviço, anexo de tratamento de dados, política de privacidade, termos de uso, lista de subprocessadores, fluxo de exclusão e atendimento a solicitações de titulares. A LGPD define tratamento de forma ampla, incluindo coleta, armazenamento, acesso, transmissão, uso e eliminação, e exige transparência sobre finalidade, agentes e contato do controlador quando aplicável. [1]

Na mesma fase, decidir a regra de cobrança. A recomendação é usar cobrança recorrente com aviso automático, período de tolerância, bloqueio progressivo e modo somente leitura antes de qualquer exclusão. A nota fiscal, o enquadramento tributário e os textos contratuais precisam de validação de contador e advogado, pois dependem da estrutura empresarial que será usada.

### Fase C: Piloto fechado

Convidar dois ou três gestores conhecidos que aceitem testar com dados reais e dar feedback semanal. O piloto deve ter um canal de suporte próprio, sem depender do WhatsApp pessoal da Scarlett, e uma reunião curta de onboarding por gestor. Cada conta piloto precisa passar por uma checagem de onboarding: criação de gestor, conexão de Meta, conexão comercial, criação de cliente, geração de relatório público, revogação de link e recuperação de senha.

| Métrica do piloto | Meta para liberar a venda pública |
|---|---|
| Isolamento de dados | Zero acesso cruzado entre gestores e clientes durante 30 dias. |
| Confiabilidade de onboarding | Gestor consegue configurar o primeiro cliente com roteiro documentado e sem intervenção técnica extraordinária. |
| Segurança | Sem risco crítico aberto em link público, segredo, sessão ou autorização. |
| Suporte | Perguntas recorrentes viraram base de ajuda e fluxo do produto, não atendimento manual infinito. |
| Cobrança | Assinatura, aviso de falha, suspensão e reativação definidos e testados em ambiente controlado. |
| Contratos e privacidade | Documentos revisados e aceitos no onboarding. |

### Fase D: Venda pública gradual

Somente depois do piloto, ativar a landing comercial em duas etapas. Primeiro, uma lista de espera ou demonstração. Depois, um plano pago com limite de vagas, por exemplo cinco novas contas por mês. Essa limitação protege a qualidade do suporte e impede que uma campanha bem-sucedida transforme um produto ainda em validação em uma emergência operacional.

## Posição sobre a landing page

A página deve ficar pronta, mas não precisa prometer planos, preços, teste autônomo ou resposta imediata no WhatsApp. A primeira versão pode focar em prova de problema e pedido de acesso ao piloto. O CTA recomendado é:

> **“Quero testar com um cliente”**  
> *Piloto fechado para gestores de tráfego que atendem clínicas. Vagas limitadas e onboarding acompanhado.*

Assim, a landing começa a validar demanda sem criar obrigação comercial ou jurídica antes da estrutura estar pronta.

## Próximo passo recomendado

O próximo trabalho técnico deve ser a **Fase A**, nesta ordem: corrigir acesso público por slug, proteger tokens em repouso, remover segredo de fallback e concluir recuperação de senha por e-mail. Em paralelo, organizar uma conversa com advogado e contador para validar contrato, tratamento de dados, cobrança e nota fiscal. Só depois selecionar os primeiros dois ou três gestores piloto.

## Referências

[1] [Lei nº 13.709/2018, LGPD, Presidência da República](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)  
[2] [Guia orientativo sobre agentes de tratamento e encarregado, ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado)
