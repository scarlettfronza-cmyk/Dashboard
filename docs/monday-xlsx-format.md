# Formato da Planilha Monday.com - Agendamentos

## Estrutura das Linhas
- Linha 1: Título do board (ex: "Agendamentos Ellora- Dra Tatiana Patruni")
- Linha 2: Subtítulo/grupo (ex: "Agendamento")
- Linha 3: Cabeçalhos das colunas (começa com "Name")
- Linhas 4+: Dados dos pacientes
- Última linha: Linha de totais/resumo (coluna A vazia, coluna F = "YYYY-MM-DD to YYYY-MM-DD", coluna G = total)

## Colunas Identificadas (nesta versão do board)
| Coluna | Nome | Descrição |
|--------|------|-----------|
| A | Name | Nome do paciente |
| B | Pessoa | Responsável pelo atendimento |
| C | Status do lead | Status: "Negócio fechado", "Em negociação", "Faltam 7 dias", "Faltam 20 dias", "Faltam 30 dias", "Remarcar" |
| D | Canal de Aquisição | Origem: "Whats/META", "Google", "Social Selling/DIRECT", "Indicação" |
| E | Procedimento | Tipo: "Rinoplastia", "Blefaroplastia", "Blefaro" |
| F | Data da consulta | Data no formato YYYY-MM-DD |
| G | Valor da Consulta | Valor numérico (ex: 75, 290) |
| H | Telefone | Número de telefone |
| I | Compareceu | "Sim", "Não", "Aguardando" |
| J | Valor da cirurgia | Valor numérico (ex: 14900) — preenchido apenas quando fechou |
| K | Data do Procedimento | Data da cirurgia agendada |
| L | OBS: | Observações |
| M | Última atualização | Texto com nome + data (ex: "Luana Priscila Apr 8, 2026 12:08 PM") |
| N | Data Consulta Fechada | Data de fechamento |
| O | Procedimento Fecha | Procedimento confirmado |
| P | UTM/Origem | Rastreamento de origem |

## Lógica de Negócio
- **Consultas**: total de linhas com nome válido (excluindo linha de totais)
- **Fechamentos**: linhas onde Status do lead = "Negócio fechado" (ou coluna "Fechou" = "Sim" em outros boards)
- **Total em Vendas**: soma da coluna "Valor da Consulta" de TODOS os agendamentos
- **Total Cirurgias**: soma da coluna "Valor da cirurgia" apenas dos fechamentos

## Variações de Nomes de Colunas Encontradas
- "Data da Consulta" / "Data da consulta" / "Data Consulta"
- "Valor Consulta" / "Valor da Consulta" / "Valor da consulta"
- "Valor Cirurgia" / "Valor da Cirurgia" / "Valor da cirurgia"
- "Fechou" (coluna explícita em alguns boards) / inferido do "Status do lead" em outros
- "Última atualização" / "Ultima atualizacao"

## Linha de Totais (ignorar no parser)
- Coluna A: vazia ou contém range de datas ("2026-04-02 to 2026-05-1")
- Coluna F: range de datas
- Coluna G: total de valores de consulta
- Coluna J: total de valores de cirurgia
