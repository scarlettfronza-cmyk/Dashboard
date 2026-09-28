import { describe, it, expect } from "vitest";
import { chaveDeduplicacao } from "./registrosVendas";

const base = { patientName: "Maria Silva", consultDate: new Date(2026, 7, 10), conversionDate: null, consultValue: "300.00", surgeryValue: null, closedValue: null, closed: false };

describe("chaveDeduplicacao", () => {
  it("com data de conversão: paciente + mês, ignorando o resto", () => {
    const a = chaveDeduplicacao({ ...base, conversionDate: new Date(2026, 7, 3), closedValue: "1000" });
    const b = chaveDeduplicacao({ ...base, conversionDate: new Date(2026, 7, 28), closedValue: "5000", patientName: " maria silva " });
    expect(a).toBe(b);
    expect(chaveDeduplicacao({ ...base, conversionDate: new Date(2026, 8, 1) })).not.toBe(a);
  });
  it("sem data de conversão: linhas idênticas viram uma; qualquer diferença separa", () => {
    expect(chaveDeduplicacao(base)).toBe(chaveDeduplicacao({ ...base, patientName: "MARIA SILVA" }));
    expect(chaveDeduplicacao(base)).not.toBe(chaveDeduplicacao({ ...base, consultDate: new Date(2026, 7, 11) }));
    expect(chaveDeduplicacao(base)).not.toBe(chaveDeduplicacao({ ...base, consultValue: "350.00" }));
    expect(chaveDeduplicacao(base)).not.toBe(chaveDeduplicacao({ ...base, closed: true }));
  });
  it("sem nenhuma data ainda deduplica por nome e valores", () => {
    const s = { ...base, consultDate: null };
    expect(chaveDeduplicacao(s)).toBe(chaveDeduplicacao({ ...s }));
  });
});
