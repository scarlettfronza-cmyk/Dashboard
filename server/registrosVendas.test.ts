import { describe, it, expect } from "vitest";
import { chaveDeduplicacao } from "./registrosVendas";

const base = { patientName: "Maria Silva", consultDate: new Date(2026, 7, 10), conversionDate: null, consultValue: "300.00", surgeryValue: null, closedValue: null, closed: false };

describe("chaveDeduplicacao", () => {
  it("com data de fechamento: a mesma linha repetida vira uma", () => {
    const a = chaveDeduplicacao({ ...base, conversionDate: new Date(2026, 7, 3), surgeryValue: "1000" });
    const b = chaveDeduplicacao({ ...base, conversionDate: new Date(2026, 7, 3), surgeryValue: "1000", patientName: " maria silva " });
    expect(a).toBe(b);
  });
  it("duas vendas diferentes da mesma pessoa (facial e bioestimulador) seguem separadas", () => {
    const facial = chaveDeduplicacao({ ...base, conversionDate: new Date(2026, 7, 3), surgeryValue: "1800" });
    const bio = chaveDeduplicacao({ ...base, conversionDate: new Date(2026, 7, 3), surgeryValue: "2600" });
    const outroDia = chaveDeduplicacao({ ...base, conversionDate: new Date(2026, 7, 20), surgeryValue: "1800" });
    expect(facial).not.toBe(bio);
    expect(facial).not.toBe(outroDia);
  });
  it("sem data de fechamento: mesma pessoa no mesmo dia é a mesma consulta, mesmo com valores diferentes", () => {
    expect(chaveDeduplicacao(base)).toBe(chaveDeduplicacao({ ...base, patientName: "MARIA SILVA" }));
    expect(chaveDeduplicacao(base)).toBe(chaveDeduplicacao({ ...base, consultValue: "350.00", surgeryValue: "9000" }));
    expect(chaveDeduplicacao(base)).not.toBe(chaveDeduplicacao({ ...base, consultDate: new Date(2026, 7, 11) }));
  });
  it("sem nenhuma data, só linhas idênticas se juntam", () => {
    const s = { ...base, consultDate: null };
    expect(chaveDeduplicacao(s)).toBe(chaveDeduplicacao({ ...s }));
    expect(chaveDeduplicacao(s)).not.toBe(chaveDeduplicacao({ ...s, consultValue: "1" }));
  });
});
