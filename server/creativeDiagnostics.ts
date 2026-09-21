export type CreativeDiagnosticMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpl: number;
};

export type CreativeDiagnostic = {
  label: "Referência" | "Otimizar gancho" | "Otimizar conversão" | "Acompanhar" | "Dados insuficientes";
  tone: "success" | "warning" | "danger" | "neutral";
  explanation: string;
  decision: string;
  accountAverageCtr: number;
  accountAverageCpl: number | null;
  ctrDifferencePercent: number | null;
  cplDifferencePercent: number | null;
};

function round(value: number) { return Math.round(value * 100) / 100; }
function format(value: number) { return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function percentDifference(value: number, baseline: number) {
  if (!baseline) return null;
  return round(((value - baseline) / baseline) * 100);
}

export function diagnoseCreativePerformance(
  metrics: CreativeDiagnosticMetrics[],
  targetCpl: number | null
): CreativeDiagnostic[] {
  const valid = metrics.filter((metric) => metric.impressions > 0);
  const totalImpressions = valid.reduce((sum, metric) => sum + metric.impressions, 0);
  const totalClicks = valid.reduce((sum, metric) => sum + metric.clicks, 0);
  const totalSpend = valid.reduce((sum, metric) => sum + metric.spend, 0);
  const totalLeads = valid.reduce((sum, metric) => sum + metric.leads, 0);
  const averageCtr = totalImpressions ? round((totalClicks / totalImpressions) * 100) : 0;
  const averageCpl = totalLeads ? round(totalSpend / totalLeads) : null;

  return metrics.map((metric) => {
    if (!metric.impressions) {
      return {
        label: "Dados insuficientes", tone: "neutral", accountAverageCtr: averageCtr, accountAverageCpl: averageCpl,
        ctrDifferencePercent: null, cplDifferencePercent: null,
        explanation: "O anúncio ainda não acumulou impressões suficientes no período para uma leitura confiável.",
        decision: "Acompanhar antes de decidir qualquer mudança.",
      };
    }

    const ctrDiff = percentDifference(metric.ctr, averageCtr);
    const cplDiff = averageCpl !== null && metric.leads > 0 ? percentDifference(metric.cpl, averageCpl) : null;
    const ctrBelowAverage = averageCtr > 0 && metric.ctr < averageCtr * 0.75;
    const ctrAboveAverage = averageCtr > 0 && metric.ctr > averageCtr * 1.2;
    const cplAboveTarget = targetCpl !== null && metric.leads > 0 && metric.cpl > targetCpl;
    const cplAboveAverage = averageCpl !== null && metric.leads > 0 && metric.cpl > averageCpl * 1.2;
    const cplHealthy = metric.leads > 0 && (!targetCpl || metric.cpl <= targetCpl) && (averageCpl === null || metric.cpl <= averageCpl);

    if (metric.leads === 0 && metric.spend > 0) {
      if (ctrBelowAverage) {
        return {
          label: "Otimizar gancho", tone: "danger", accountAverageCtr: averageCtr, accountAverageCpl: averageCpl,
          ctrDifferencePercent: ctrDiff, cplDifferencePercent: null,
          explanation: `O CTR de ${format(metric.ctr)}% está ${Math.abs(ctrDiff ?? 0).toFixed(0)}% abaixo da média de ${format(averageCtr)}% da seleção e não houve leads.`,
          decision: "Trocar o gancho visual ou textual antes de investir mais volume neste criativo.",
        };
      }
      return {
        label: "Otimizar conversão", tone: "warning", accountAverageCtr: averageCtr, accountAverageCpl: averageCpl,
        ctrDifferencePercent: ctrDiff, cplDifferencePercent: null,
        explanation: `O CTR de ${format(metric.ctr)}% está competitivo, mas o anúncio não gerou leads no período. O interesse não está virando contato.`,
        decision: "Testar CTA, oferta, formulário ou a coerência entre a promessa do anúncio e a próxima etapa.",
      };
    }

    if (metric.leads > 0 && cplHealthy && (ctrAboveAverage || metric.leads >= 3)) {
      const targetMessage = targetCpl ? ` e abaixo da meta de R$ ${format(targetCpl)}` : "";
      return {
        label: "Referência", tone: "success", accountAverageCtr: averageCtr, accountAverageCpl: averageCpl,
        ctrDifferencePercent: ctrDiff, cplDifferencePercent: cplDiff,
        explanation: `Gerou ${metric.leads} lead(s) com CPL de R$ ${format(metric.cpl)}, abaixo da média de R$ ${format(averageCpl ?? metric.cpl)}${targetMessage}.`,
        decision: "Manter como referência e testar variações do mesmo ângulo, sem copiar o criativo literalmente.",
      };
    }

    if (ctrBelowAverage && (cplAboveAverage || cplAboveTarget)) {
      return {
        label: "Otimizar gancho", tone: "danger", accountAverageCtr: averageCtr, accountAverageCpl: averageCpl,
        ctrDifferencePercent: ctrDiff, cplDifferencePercent: cplDiff,
        explanation: `O CTR de ${format(metric.ctr)}% está ${Math.abs(ctrDiff ?? 0).toFixed(0)}% abaixo da média e o CPL de R$ ${format(metric.cpl)} está acima do patamar esperado.`,
        decision: "Priorizar uma nova abertura, contraste visual ou dor mais específica antes de testar novas cópias longas.",
      };
    }

    if ((ctrAboveAverage && (cplAboveAverage || cplAboveTarget)) || (metric.leads > 0 && cplAboveTarget)) {
      return {
        label: "Otimizar conversão", tone: "warning", accountAverageCtr: averageCtr, accountAverageCpl: averageCpl,
        ctrDifferencePercent: ctrDiff, cplDifferencePercent: cplDiff,
        explanation: `O anúncio chama atenção, mas o CPL de R$ ${format(metric.cpl)} está acima ${targetCpl ? "da meta definida" : "da média da seleção"}.`,
        decision: "Preservar o gancho e testar clareza de oferta, CTA ou público antes de descartar o conceito.",
      };
    }

    return {
      label: "Acompanhar", tone: "neutral", accountAverageCtr: averageCtr, accountAverageCpl: averageCpl,
      ctrDifferencePercent: ctrDiff, cplDifferencePercent: cplDiff,
      explanation: `Gerou ${metric.leads} lead(s), com CTR de ${format(metric.ctr)}% e CPL de R$ ${format(metric.cpl)}. O resultado ainda está próximo da média da seleção.`,
      decision: "Manter em observação até reunir mais volume antes de decidir se deve variar o criativo.",
    };
  });
}
