import { describe, expect, it } from "vitest";
import { normalizeRankingDateRange } from "./rankingDateRange";

describe("intervalo personalizado do ranking", () => {
  it("mantém as datas quando a data inicial vem antes da final", () => {
    expect(normalizeRankingDateRange("2026-08-01", "2026-08-18")).toEqual({ from: "2026-08-01", to: "2026-08-18" });
  });

  it("corrige automaticamente a ordem quando a data final é escolhida antes da inicial", () => {
    expect(normalizeRankingDateRange("2026-08-18", "2026-08-01")).toEqual({ from: "2026-08-01", to: "2026-08-18" });
  });

  it("não aplica intervalo incompleto", () => {
    expect(normalizeRankingDateRange("", "2026-08-18")).toBeNull();
  });
});
