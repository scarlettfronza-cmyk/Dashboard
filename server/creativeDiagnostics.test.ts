import { describe, expect, it } from "vitest";
import { diagnoseCreativePerformance } from "./creativeDiagnostics";

describe("diagnóstico comparativo de criativos", () => {
  it("marca como referência o criativo com CPL saudável e geração consistente de leads", () => {
    const result = diagnoseCreativePerformance([
      { spend: 100, impressions: 10000, clicks: 100, leads: 10, ctr: 1, cpl: 10 },
      { spend: 200, impressions: 10000, clicks: 100, leads: 4, ctr: 1, cpl: 50 },
    ], 30);
    expect(result[0].label).toBe("Referência");
  });

  it("identifica gancho fraco quando CTR e CPL ficam piores que a seleção", () => {
    const result = diagnoseCreativePerformance([
      { spend: 200, impressions: 10000, clicks: 20, leads: 2, ctr: 0.2, cpl: 100 },
      { spend: 200, impressions: 10000, clicks: 200, leads: 10, ctr: 2, cpl: 20 },
    ], 50);
    expect(result[0].label).toBe("Otimizar gancho");
  });

  it("identifica problema de conversão quando há clique, mas não há lead", () => {
    const result = diagnoseCreativePerformance([
      { spend: 100, impressions: 10000, clicks: 200, leads: 0, ctr: 2, cpl: 0 },
      { spend: 100, impressions: 10000, clicks: 100, leads: 5, ctr: 1, cpl: 20 },
    ], 30);
    expect(result[0].label).toBe("Otimizar conversão");
  });
});

