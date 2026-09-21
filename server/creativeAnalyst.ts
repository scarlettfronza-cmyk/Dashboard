export type CreativePerformance = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpl: number;
};

export type CreativeClassification = {
  hook: string;
  angle: string;
  promise: string;
  proof: string;
  offer: string;
  callToAction: string;
  performanceInsight: string;
  testHypothesis: string;
  confidence: number;
};

export function buildCreativeClassificationPrompt(input: {
  adName: string;
  campaignName: string;
  format: string;
  title: string | null;
  body: string | null;
  callToAction: string | null;
  performance: CreativePerformance;
}) {
  return `Classifique este anúncio de Meta Ads. Você só pode se basear no texto e nas métricas enviados. Não invente cenas, falas, provas, ofertas ou resultados que não estejam nos dados. Quando não houver informação suficiente, use exatamente "Não identificado".

Anúncio: ${input.adName || "Não identificado"}
Campanha: ${input.campaignName || "Não identificado"}
Formato: ${input.format}
Título: ${input.title || "Não identificado"}
Texto principal: ${input.body || "Não identificado"}
CTA: ${input.callToAction || "Não identificado"}
Métricas: investimento ${input.performance.spend.toFixed(2)}, impressões ${input.performance.impressions}, cliques ${input.performance.clicks}, leads ${input.performance.leads}, CTR ${input.performance.ctr.toFixed(2)}%, CPL ${input.performance.cpl.toFixed(2)}.

O campo performanceInsight deve interpretar os números sem afirmar causalidade absoluta. O campo testHypothesis deve sugerir um teste controlado, sem recomendar publicar, pausar ou alterar campanha automaticamente.`;
}

export function fallbackCreativeClassification(input: {
  body: string | null;
  title: string | null;
  callToAction: string | null;
  performance: CreativePerformance;
}): CreativeClassification {
  const hasCopy = Boolean(input.body || input.title);
  const performanceInsight = input.performance.leads > 0
    ? `Gerou ${input.performance.leads} lead(s), com CTR de ${input.performance.ctr.toFixed(2)}% e CPL de ${input.performance.cpl.toFixed(2)} no período.`
    : `Ainda não gerou leads no período. O CTR foi de ${input.performance.ctr.toFixed(2)}%.`;

  return {
    hook: hasCopy ? "Revisar texto inicial" : "Não identificado",
    angle: "Não identificado",
    promise: "Não identificado",
    proof: "Não identificado",
    offer: "Não identificado",
    callToAction: input.callToAction || "Não identificado",
    performanceInsight,
    testHypothesis: "Criar uma variação controlada do texto inicial e comparar CTR, leads e CPL antes de qualquer mudança de orçamento.",
    confidence: 0,
  };
}
