import { describe, expect, it } from "vitest";
import { fallbackCreativeClassification } from "./creativeAnalyst";

describe("Creative Analyst", () => {
  it("não inventa elementos quando o anúncio não traz texto", () => {
    const result = fallbackCreativeClassification({
      body: null,
      title: null,
      callToAction: null,
      performance: { spend: 100, impressions: 1000, clicks: 10, leads: 0, ctr: 1, cpl: 0 },
    });
    expect(result.hook).toBe("Não identificado");
    expect(result.callToAction).toBe("Não identificado");
  });

  it("resume os resultados reais do criativo no fallback", () => {
    const result = fallbackCreativeClassification({
      body: "Conheça nosso tratamento",
      title: null,
      callToAction: "LEARN_MORE",
      performance: { spend: 250, impressions: 5000, clicks: 100, leads: 10, ctr: 2, cpl: 25 },
    });
    expect(result.performanceInsight).toContain("10 lead(s)");
    expect(result.performanceInsight).toContain("CPL de 25.00");
  });
});

