export type RankingMetrics = {
  investimento: number;
  leads: number;
  consultas: number;
  totalConsultas: number;
  totalCirurgias: number;
  metaApiSuccess: boolean;
  mediaDataAvailable: boolean;
};

export type RankingTargets = {
  targetCpl?: number | null;
  targetCostPerConsult?: number | null;
  targetRoas?: number | null;
};

export type OpportunityCategory = "atencao" | "oportunidade" | "estabilidade" | "dados_incompletos";

export function calculateOpportunityRanking(metrics: RankingMetrics, targets: RankingTargets) {
  const cpl = metrics.leads > 0 ? metrics.investimento / metrics.leads : 0;
  const costPerConsult = metrics.consultas > 0 ? metrics.investimento / metrics.consultas : 0;
  const commercialRevenue = metrics.totalConsultas + metrics.totalCirurgias;
  const roas = metrics.investimento > 0 ? commercialRevenue / metrics.investimento : 0;
  const evidence: string[] = [];
  const actions: string[] = [];
  let attentionScore = 0;
  let opportunityScore = 0;

  if (!metrics.mediaDataAvailable) {
    return {
      category: "dados_incompletos" as OpportunityCategory,
      priority: "configurar" as const,
      score: 0,
      cpl,
      costPerConsult,
      roas,
      evidence: ["Não há leitura de mídia disponível para o período selecionado."],
      recommendation: "Verifique o token Meta ou a fonte alternativa de mídia antes de tomar decisões.",
    };
  }

  if (metrics.investimento > 0 && metrics.leads === 0) {
    attentionScore += 45;
    evidence.push("Houve investimento, mas não houve leads no período.");
    actions.push("Verificar entrega, objetivo da campanha, criativo e formulário ou conversa.");
  }

  if (targets.targetCpl && metrics.leads > 0) {
    const ratio = cpl / targets.targetCpl;
    if (ratio > 1.25) {
      attentionScore += 35;
      evidence.push(`CPL ${Math.round((ratio - 1) * 100)}% acima da meta.`);
      actions.push("Revisar criativo, público e mensagem inicial antes de aumentar orçamento.");
    } else if (ratio > 1) {
      attentionScore += 15;
      evidence.push("CPL acima da meta, mas ainda próximo do esperado.");
      actions.push("Acompanhar o CPL e comparar os conjuntos que geram conversas mais qualificadas.");
    } else if (ratio <= 0.8) {
      opportunityScore += 20;
      evidence.push(`CPL ${Math.round((1 - ratio) * 100)}% abaixo da meta.`);
      actions.push("Preservar o conjunto eficiente e considerar um teste gradual de escala após validar a qualidade dos leads.");
    }
  }

  if (targets.targetCostPerConsult && targets.targetCostPerConsult > 0 && metrics.consultas > 0) {
    const ratio = costPerConsult / targets.targetCostPerConsult;
    if (ratio > 1.25) {
      attentionScore += 30;
      evidence.push(`Custo por consulta ${Math.round((ratio - 1) * 100)}% acima da meta.`);
      actions.push("Avaliar atendimento, qualificação e follow-up dos leads antes de mudar apenas a mídia.");
    } else if (ratio <= 0.8) {
      opportunityScore += 15;
      evidence.push(`Custo por consulta ${Math.round((1 - ratio) * 100)}% abaixo da meta.`);
      actions.push("Manter o processo comercial e identificar quais campanhas alimentam as consultas mais eficientes.");
    }
  } else if (metrics.leads >= 10 && metrics.consultas === 0) {
    attentionScore += 25;
    evidence.push(`${metrics.leads} leads sem consultas registradas no período.`);
    actions.push("Conferir a velocidade de atendimento, a abordagem comercial e se o Monday está atualizado.");
  }

  if (targets.targetRoas && targets.targetRoas > 0 && metrics.investimento > 0) {
    const ratio = roas / targets.targetRoas;
    if (ratio < 0.7) {
      attentionScore += 35;
      evidence.push("ROAS muito abaixo da meta cadastrada.");
      actions.push("Investigar vendas, ticket, conversão comercial e qualidade das campanhas antes de escalar.");
    } else if (ratio < 1) {
      attentionScore += 15;
      evidence.push("ROAS abaixo da meta cadastrada.");
      actions.push("Acompanhar o funil comercial e testar melhorias de campanha de forma controlada.");
    } else if (ratio >= 1.2) {
      opportunityScore += 20;
      evidence.push("ROAS acima da meta cadastrada.");
      actions.push("Avaliar uma expansão gradual, preservando o controle de qualidade e da capacidade de atendimento.");
    }
  }

  if (attentionScore >= 25) {
    return {
      category: "atencao" as OpportunityCategory,
      priority: attentionScore >= 55 ? "alta" as const : "media" as const,
      score: attentionScore,
      cpl,
      costPerConsult,
      roas,
      evidence: evidence.length ? evidence : ["Há sinais que exigem acompanhamento."],
      recommendation: actions[0] ?? "Revisar o funil antes de tomar uma decisão de mídia.",
    };
  }

  if (opportunityScore >= 15) {
    return {
      category: "oportunidade" as OpportunityCategory,
      priority: opportunityScore >= 35 ? "alta" as const : "media" as const,
      score: opportunityScore,
      cpl,
      costPerConsult,
      roas,
      evidence: evidence.length ? evidence : ["Os indicadores estão acima do esperado."],
      recommendation: actions[0] ?? "Monitorar a qualidade antes de qualquer escala.",
    };
  }

  return {
    category: "estabilidade" as OpportunityCategory,
    priority: "baixa" as const,
    score: 0,
    cpl,
    costPerConsult,
    roas,
    evidence: evidence.length ? evidence : ["Sem desvios relevantes em relação às metas disponíveis."],
    recommendation: "Manter acompanhamento e acumular mais dados antes de fazer mudanças.",
  };
}
