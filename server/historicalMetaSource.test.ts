import { describe, expect, it } from "vitest";
import {
  buildMediaLineage,
  getHistoricalMetaSourceConfig,
  shouldUseHistoricalMetaSource,
} from "./historicalMetaSource";

const source = getHistoricalMetaSourceConfig({
  source: "historical_meta_sheet",
  coverageStart: "2025-05-19",
  coverageEnd: "2025-12-31",
  label: "Conta Meta histórica do Dr. Mario",
});

describe("historicalMetaSource", () => {
  it("aceita somente uma configuração histórica com datas ISO válidas", () => {
    expect(source).toMatchObject({ coverageStart: "2025-05-19", coverageEnd: "2025-12-31" });
    expect(getHistoricalMetaSourceConfig({ source: "historical_meta_sheet", coverageStart: "maio", coverageEnd: "2025-12-31" })).toBeNull();
  });

  it("prioriza a planilha em períodos que terminam no corte histórico", () => {
    expect(shouldUseHistoricalMetaSource(source, "2025-03-31")).toBe(true);
    expect(shouldUseHistoricalMetaSource(source, "2025-12-31")).toBe(true);
    expect(shouldUseHistoricalMetaSource(source, "2026-01-01")).toBe(false);
  });

  it("declara a origem histórica de mídia sem alterar a origem comercial", () => {
    expect(buildMediaLineage(source, true, false, true)).toEqual({
      source: "historical_meta_sheet",
      label: "Conta Meta histórica do Dr. Mario",
      coverageStart: "2025-05-19",
      coverageEnd: "2025-12-31",
    });
  });
});
