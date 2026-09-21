export type BriefSource = {
  id: number;
  adName: string | null;
  format: string | null;
  hook: string | null;
  angle: string | null;
  callToAction: string | null;
  testHypothesis: string | null;
  metrics: { ctr: number; leads: number; cpl: number };
};

export type CreativeBriefDraft = {
  title: string;
  objective: string;
  targetAudience: string;
  hypothesis: string;
  hook: string;
  angle: string;
  coreMessage: string;
  visualDirection: string;
  script: string;
  primaryText: string;
  headline: string;
  callToAction: string;
  format: string;
  variableToTest: string;
  successMetric: string;
  priority: number;
  sourceCreativeAnalysisId: number | null;
};

type ClientCreativeContext = {
  name: string;
  leadChannel: string | null;
  campaignTypes: string | null;
  mappingNotes: string | null;
  targetCpl: number | null;
};

export function buildCreativeBriefPrompt(context: ClientCreativeContext, sources: BriefSource[]) {
  const sourceText = sources.map((source, index) => `
REFERÊNCIA ${index + 1}
- ID da análise: ${source.id}
- Anúncio: ${source.adName ?? "Sem nome"}
- Formato: ${source.format ?? "Não identificado"}
- Hook: ${source.hook ?? "Não identificado"}
- Ângulo: ${source.angle ?? "Não identificado"}
- CTA: ${source.callToAction ?? "Não identificado"}
- CTR: ${source.metrics.ctr.toFixed(2)}%
- Leads: ${source.metrics.leads}
- CPL: R$ ${source.metrics.cpl.toFixed(2)}
- Hipótese anterior: ${source.testHypothesis ?? "Sem hipótese"}`).join("\n");

  return `Você é um estrategista criativo de Meta Ads para uma agência brasileira. Crie exatamente 3 briefs diferentes para testar, usando os padrões de referência abaixo sem copiar anúncios literalmente.

CLIENTE: ${context.name}
CANAL PRINCIPAL: ${context.leadChannel ?? "não informado"}
TIPOS DE CAMPANHA: ${context.campaignTypes ?? "não informado"}
META DE CPL: ${context.targetCpl ? `R$ ${context.targetCpl.toFixed(2)}` : "não informada"}
CONTEXTO COMERCIAL: ${context.mappingNotes ?? "não informado"}

${sourceText}

REGRAS IMPORTANTES:
1. Cada brief deve testar UMA variável principal de cada vez.
2. Mantenha o mesmo objetivo comercial do criativo de referência, mas proponha um novo hook, nova prova ou nova abertura.
3. Não faça promessas de resultado, não faça diagnósticos médicos e não presuma atributos pessoais do público.
4. VisualDirection precisa ser concreto para a pessoa de criação executar.
5. Script deve trazer roteiro curto, em blocos de cena ou fala, adequado para vídeo vertical ou imagem.
6. PrimaryText e headline devem estar prontos para copiar, em português brasileiro.
7. Escolha o sourceCreativeAnalysisId mais relacionado a cada brief.
8. Use prioridade 1 para o teste mais urgente, 2 para o segundo e 3 para o terceiro.`;
}

export function fallbackCreativeBriefs(context: ClientCreativeContext, sources: BriefSource[]): CreativeBriefDraft[] {
  const base = sources[0] ?? { id: 0, adName: null, format: "Vídeo vertical", hook: "Prova visual", angle: "Transformação", callToAction: "Saiba mais", testHypothesis: null, metrics: { ctr: 0, leads: 0, cpl: 0 } };
  const variations = [
    { suffix: "dor direta", hook: "Abertura com a dor ou dúvida mais frequente do público", variable: "gancho dos primeiros 3 segundos" },
    { suffix: "prova visual", hook: "Prova visual do processo e do resultado possível", variable: "tipo de prova apresentada" },
    { suffix: "especialista", hook: "Especialista explicando o diferencial de forma simples", variable: "porta-voz e estrutura do roteiro" },
  ];
  return variations.map((variation, index) => ({
    title: `${context.name}: teste de ${variation.suffix}`,
    objective: "Gerar contatos qualificados sem copiar o criativo de referência",
    targetAudience: "Pessoas avaliando o procedimento e buscando mais clareza antes de entrar em contato.",
    hypothesis: `Se testarmos ${variation.hook.toLowerCase()} mantendo o ângulo ${base.angle ?? "da referência"}, poderemos melhorar a qualidade do clique e reduzir o custo por lead.`,
    hook: variation.hook,
    angle: base.angle ?? "Benefício e transformação percebida",
    coreMessage: "Apresente o procedimento com clareza, expectativa responsável e convite simples para saber mais.",
    visualDirection: "Vídeo vertical 9:16 com abertura objetiva, cena de contexto, explicação curta e fechamento com CTA em texto na tela.",
    script: "Cena 1: gancho curto.\nCena 2: explicação ou prova visual.\nCena 3: diferencial e CTA direto.",
    primaryText: "Conheça uma abordagem personalizada e converse com nossa equipe para entender as possibilidades.",
    headline: "Saiba mais sobre o procedimento",
    callToAction: base.callToAction ?? "Saiba mais",
    format: base.format?.toLowerCase().includes("image") ? "Imagem 4:5" : "Vídeo vertical 9:16",
    variableToTest: variation.variable,
    successMetric: context.targetCpl ? `CPL abaixo de R$ ${context.targetCpl.toFixed(2)}` : "CPL abaixo da média dos criativos de referência",
    priority: index + 1,
    sourceCreativeAnalysisId: base.id || null,
  }));
}
