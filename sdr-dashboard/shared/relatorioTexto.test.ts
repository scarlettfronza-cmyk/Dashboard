import { describe, expect, it } from "vitest";
import { montarTextoRelatorio } from "./relatorioTexto";
import type { Metrics } from "./metrics";

const base: Metrics = {
  leadsRecebidos: 52,
  agendamentos: 40,
  comparecimentos: 30,
  negociosFechados: 6,
  negociosPerdidos: 4,
  emNegociacao: 3,
  aguardandoRetorno: 1,
  taxaConversao: 11.5,
  taxaComparecimento: 75,
  receitaTotal: 67200,
  ticketMedio: 11200,
  porCanal: [
    { name: "Instagram", value: 30, color: "" },
    { name: "Google", value: 15, color: "" },
    { name: "Indicação", value: 7, color: "" },
    { name: "Outros", value: 0, color: "" },
  ],
  porProcedimento: [{ name: "Rinoplastia", value: 9, color: "" }],
  porStatus: [],
  porMes: [],
  porSdr: [],
  porCliente: [],
};

const range = { from: "2026-08-01", to: "2026-08-31" };

describe("montarTextoRelatorio", () => {
  it("traz os números do período exatamente como calculados", () => {
    const texto = montarTextoRelatorio({ clienteNome: "Dra. Tatiana Patruni", range, metrics: base });
    expect(texto).toContain("Dra. Tatiana Patruni");
    expect(texto).toContain("01/08/2026 a 31/08/2026");
    expect(texto).toContain("Leads recebidos: 52");
    expect(texto).toContain("Agendamentos: 40");
    expect(texto).toContain("Comparecimentos: 30 (75% dos agendados)");
    expect(texto).toContain("Fechamentos: 6");
    expect(texto).toMatch(/Faturamento: R\$\s67\.200/);
    expect(texto).toMatch(/Ticket médio: R\$\s11\.200/);
    expect(texto).toContain("Instagram (30), Google (15) e Indicação (7)");
    expect(texto).not.toContain("Outros (0)");
  });

  it("não usa travessão", () => {
    const texto = montarTextoRelatorio({ clienteNome: "Clínica", range, metrics: base, observacoes: "Feriado no dia 15." });
    expect(texto).not.toMatch(/[—–]/);
  });

  it("inclui o comparativo só das métricas com período anterior", () => {
    const texto = montarTextoRelatorio({
      clienteNome: "Clínica",
      range,
      metrics: base,
      comparison: {
        leadsRecebidos: { atual: 52, anterior: 40, variacaoPct: 30 },
        agendamentos: { atual: 40, anterior: 40, variacaoPct: 0 },
        receitaTotal: { atual: 67200, anterior: 0, variacaoPct: null },
        negociosFechados: { atual: 6, anterior: 8, variacaoPct: -25 },
      },
    });
    expect(texto).toContain("Em relação ao período anterior: leads +30%, agendamentos estáveis e fechamentos -25%.");
    expect(texto).not.toContain("faturamento");
  });

  it("sem faturamento não mostra valores zerados", () => {
    const texto = montarTextoRelatorio({
      clienteNome: "Clínica",
      range: null,
      metrics: { ...base, receitaTotal: 0, ticketMedio: 0, negociosFechados: 0, agendamentos: 0, comparecimentos: 0 },
    });
    expect(texto).toContain("todo o período");
    expect(texto).not.toContain("Faturamento");
    expect(texto).toContain("Comparecimentos: 0\n");
  });

  it("acrescenta o contexto escrito pela SDR", () => {
    const texto = montarTextoRelatorio({ clienteNome: "Clínica", range, metrics: base, observacoes: "  Tivemos feriado prolongado.  " });
    expect(texto).toContain("\n\nTivemos feriado prolongado.\n\n");
  });
});
