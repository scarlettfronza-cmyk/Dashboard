/**
 * Chave de deduplicação dos registros do Monday.
 *
 * O mesmo paciente aparece mais de uma vez no quadro com frequência — às
 * vezes por engano (cadastro repetido), às vezes de verdade (a Soraya fez
 * um facial e um bioestimulador no mesmo mês). A chave separa os dois:
 *
 *  - Com data de fechamento: paciente + dia do fechamento + valor. Duas
 *    vendas diferentes têm valores diferentes e seguem separadas; a mesma
 *    linha repetida (mesmo dia, mesmo valor) vira uma.
 *  - Sem data de fechamento: uma consulta por paciente por dia — duas
 *    linhas da mesma pessoa na mesma data são a mesma consulta (fica a
 *    mais completa/recente).
 *  - Sem data nenhuma, só linhas idênticas se juntam.
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
    const valor = r.closedValue ?? r.surgeryValue ?? "";
    return `${nome(r.patientName)}__venda__${dia(r.conversionDate)}__${valor}`;
  }
  if (r.consultDate) {
    return `${nome(r.patientName)}__consulta__${dia(r.consultDate)}`;
  }
  return [nome(r.patientName), "sem-data", r.consultValue ?? "", r.surgeryValue ?? "", r.closedValue ?? "", r.closed ? 1 : 0].join("__");
}
