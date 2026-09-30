/**
 * Chave de deduplicação dos registros do Monday.
 *
 * O mesmo paciente aparece mais de uma vez no quadro com frequência (linha
 * duplicada, cadastro repetido pela vendedora). Com data de fechamento:
 * uma venda por paciente por mês, ficando a de maior valor. Sem data de
 * fechamento: uma consulta por paciente por dia — duas linhas da mesma
 * pessoa na mesma data são a mesma consulta, mesmo que uma esteja mais
 * preenchida que a outra (fica a mais completa/recente). Sem data nenhuma,
 * só linhas idênticas se juntam.
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
  if (r.consultDate) {
    return `${nome(r.patientName)}__consulta__${dia(r.consultDate)}`;
  }
  return [nome(r.patientName), "sem-data", r.consultValue ?? "", r.surgeryValue ?? "", r.closedValue ?? "", r.closed ? 1 : 0].join("__");
}
