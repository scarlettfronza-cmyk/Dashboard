export type RevenueSourceType = "sales_records" | "sales_sheet" | "unavailable";

export function calculateCommercialMetrics(input: {
  investimento: number;
  leads: number;
  consultas: number;
  fechamentos: number;
  totalConsultas: number;
  totalCirurgias: number;
  totalEmVendas: number;
}) {
  const hasImportedCommercialData = input.totalConsultas > 0 || input.totalCirurgias > 0;
  const receitaTotal = hasImportedCommercialData
    ? input.totalConsultas + input.totalCirurgias
    : input.totalEmVendas;
  const roas = input.investimento > 0 ? receitaTotal / input.investimento : 0;
  const custoPorLead = input.leads > 0 ? input.investimento / input.leads : 0;
  const custoPorConsulta = input.consultas > 0 ? input.investimento / input.consultas : 0;
  const custoPorVenda = input.fechamentos > 0 ? input.investimento / input.fechamentos : 0;
  const taxaConversao = input.leads > 0 ? (input.consultas / input.leads) * 100 : 0;
  const ticketMedio = input.consultas > 0
    ? receitaTotal / input.consultas
    : input.fechamentos > 0 ? receitaTotal / input.fechamentos : 0;
  return { receitaTotal, roas, custoPorLead, custoPorConsulta, custoPorVenda, taxaConversao, ticketMedio };
}

export function describeRevenueSource(source: RevenueSourceType, uploadedAt?: Date | null) {
  if (source === "sales_records") {
    return {
      type: source,
      label: "Base comercial importada (Monday ou XLSX)",
      updatedAt: uploadedAt?.toISOString() ?? null,
      roasFormula: "(Receita de consultas + receita de fechamentos) ÷ investimento",
    };
  }
  if (source === "sales_sheet") {
    return {
      type: source,
      label: "Planilha comercial conectada",
      updatedAt: null,
      roasFormula: "Receita registrada na planilha ÷ investimento",
    };
  }
  return {
    type: source,
    label: "Sem base comercial disponível no período",
    updatedAt: null,
    roasFormula: "ROAS indisponível sem receita comercial",
  };
}
