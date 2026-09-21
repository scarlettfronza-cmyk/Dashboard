import { describe, expect, it } from "vitest";
import { calculateCommercialMetrics, describeRevenueSource } from "./kpiLineage";

describe("kpi lineage", () => {
  it("uses the imported commercial base for one auditable ROAS formula", () => {
    const result = calculateCommercialMetrics({ investimento: 2311, leads: 95, consultas: 15, fechamentos: 1, totalConsultas: 4750, totalCirurgias: 20393, totalEmVendas: 4750 });
    expect(result.receitaTotal).toBe(25143);
    expect(result.roas).toBeCloseTo(10.879, 2);
  });

  it("falls back to the connected sales sheet only when no imported commercial base exists", () => {
    const result = calculateCommercialMetrics({ investimento: 100, leads: 10, consultas: 0, fechamentos: 2, totalConsultas: 0, totalCirurgias: 0, totalEmVendas: 300 });
    expect(result.receitaTotal).toBe(300);
    expect(result.roas).toBe(3);
    expect(describeRevenueSource("sales_sheet").type).toBe("sales_sheet");
  });
});
