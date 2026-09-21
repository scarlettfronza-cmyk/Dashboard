import { describe, expect, it } from "vitest";
import { calculateOpportunityRanking } from "./opportunityRanking";

describe("ranking diário de oportunidades", () => {
  it("prioriza atenção quando o CPL está muito acima da meta", () => {
    const result = calculateOpportunityRanking(
      { investimento: 600, leads: 20, consultas: 2, totalConsultas: 200, totalCirurgias: 0, metaApiSuccess: true, mediaDataAvailable: true },
      { targetCpl: 15, targetCostPerConsult: 200, targetRoas: 2 }
    );
    expect(result.category).toBe("atencao");
    expect(result.priority).toBe("alta");
    expect(result.evidence.join(" ")).toContain("CPL 100% acima da meta");
  });

  it("identifica oportunidade quando CPL e ROAS superam as metas", () => {
    const result = calculateOpportunityRanking(
      { investimento: 400, leads: 40, consultas: 5, totalConsultas: 400, totalCirurgias: 1600, metaApiSuccess: true, mediaDataAvailable: true },
      { targetCpl: 20, targetCostPerConsult: 120, targetRoas: 3 }
    );
    expect(result.category).toBe("oportunidade");
    expect(result.roas).toBe(5);
  });

  it("pede configuração quando não há leitura de mídia", () => {
    const result = calculateOpportunityRanking(
      { investimento: 0, leads: 0, consultas: 0, totalConsultas: 0, totalCirurgias: 0, metaApiSuccess: false, mediaDataAvailable: false },
      { targetCpl: 20 }
    );
    expect(result.category).toBe("dados_incompletos");
    expect(result.priority).toBe("configurar");
  });

  it("alerta quando há leads, mas não há consultas registradas", () => {
    const result = calculateOpportunityRanking(
      { investimento: 300, leads: 25, consultas: 0, totalConsultas: 0, totalCirurgias: 0, metaApiSuccess: true, mediaDataAvailable: true },
      { targetCpl: 15 }
    );
    expect(result.category).toBe("atencao");
    expect(result.evidence.join(" ")).toContain("25 leads sem consultas");
  });
});
