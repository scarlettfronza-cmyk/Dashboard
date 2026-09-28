/**
 * Chave de deduplicação dos registros do Monday.
 *
 * O mesmo paciente aparece mais de uma vez no quadro com frequência (linha
 * duplicada, grupo repetido). Com data de conversão, vale a regra antiga:
 * um por paciente por mês, ficando o de maior valor. Sem data de conversão
 * a chave era aleatória — nada era deduplicado, e cópias idênticas entravam
 * no relatório (47 no backup). Agora, sem data de conversão, linhas
 * idênticas (paciente, data da consulta, valores, fechou) viram uma só.
 */
export type RegistroVenda = {
  patientName: string;
  consultDate: Date | null;
  conversionDate: Date | null;
  consultValue: string | null;
  surgeryValue: string | null;
  closedValue: string | null;
  closed: boolean;
};

const nome = (s: string) => s.toLowerCase().trim();
const dia = (d: Date | null) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : "sem-data");

export function chaveDeduplicacao(r: RegistroVenda): string {
  if (r.conversionDate) {
    return `${nome(r.patientName)}__${r.conversionDate.getFullYear()}-${r.conversionDate.getMonth()}`;
  }
  return [nome(r.patientName), dia(r.consultDate), r.consultValue ?? "", r.surgeryValue ?? "", r.closedValue ?? "", r.closed ? 1 : 0].join("__");
}
