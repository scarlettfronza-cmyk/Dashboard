import { describe, expect, it } from "vitest";
import { resolvePreset, PRESETS } from "./periodPresets";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("períodos pré-definidos", () => {
  const hoje = new Date(2026, 8, 21); // 21/09/2026

  it("hoje é um único dia", () => {
    const p = resolvePreset("today", hoje);
    expect(iso(p.from)).toBe("2026-09-21");
    expect(iso(p.to)).toBe("2026-09-21");
  });

  it("7 dias inclui o próprio dia", () => {
    const p = resolvePreset("7d", hoje);
    expect(iso(p.from)).toBe("2026-09-15");
    expect(iso(p.to)).toBe("2026-09-21");
  });

  it("este mês vai do dia 1 até hoje", () => {
    const p = resolvePreset("month", hoje);
    expect(iso(p.from)).toBe("2026-09-01");
    expect(iso(p.to)).toBe("2026-09-21");
  });

  it("mês passado é o mês civil inteiro, não os últimos 30 dias", () => {
    const p = resolvePreset("lastMonth", hoje);
    expect(iso(p.from)).toBe("2026-08-01");
    expect(iso(p.to)).toBe("2026-08-31");
  });

  it("mês passado respeita meses de 30 dias", () => {
    const p = resolvePreset("lastMonth", new Date(2026, 6, 10)); // julho
    expect(iso(p.from)).toBe("2026-06-01");
    expect(iso(p.to)).toBe("2026-06-30");
  });

  it("mês passado atravessa a virada de ano", () => {
    const p = resolvePreset("lastMonth", new Date(2026, 0, 5)); // janeiro
    expect(iso(p.from)).toBe("2025-12-01");
    expect(iso(p.to)).toBe("2025-12-31");
  });

  it("mês passado acerta fevereiro em ano bissexto", () => {
    const p = resolvePreset("lastMonth", new Date(2028, 2, 3)); // março de 2028
    expect(iso(p.from)).toBe("2028-02-01");
    expect(iso(p.to)).toBe("2028-02-29");
  });

  it("12 meses cobre o mês atual e os onze anteriores", () => {
    const p = resolvePreset("12m", hoje);
    expect(iso(p.from)).toBe("2025-10-01");
    expect(iso(p.to)).toBe("2026-09-21");
  });

  it("6 meses atravessa a virada de ano", () => {
    const p = resolvePreset("6m", new Date(2026, 1, 15)); // fevereiro
    expect(iso(p.from)).toBe("2025-09-01");
  });

  it("nenhum preset devolve início depois do fim", () => {
    for (const { id } of PRESETS) {
      const p = resolvePreset(id, hoje);
      expect(p.from.getTime()).toBeLessThanOrEqual(p.to.getTime());
    }
  });
});
