import { describe, expect, it } from "vitest";
import { getClosingReferenceDate, groupNameToPeriodDate } from "./db";

describe("fallback de data para fechamentos", () => {
  it("prioriza a data explícita de fechamento", () => {
    const result = getClosingReferenceDate({
      conversionDate: new Date("2026-08-07T00:00:00Z"),
      consultDate: new Date("2026-08-04T00:00:00Z"),
      groupName: "Agendamentos Julho 2026",
      lastUpdated: new Date("2026-08-14T00:00:00Z"),
    });

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-07");
  });

  it("usa a data da consulta quando a origem não informa a data de conversão", () => {
    const result = getClosingReferenceDate({
      conversionDate: null,
      consultDate: new Date("2026-09-07T00:00:00Z"),
      groupName: "Agendamento Setembro 2026",
      lastUpdated: new Date("2026-09-11T00:00:00Z"),
    });

    expect(result?.toISOString().slice(0, 10)).toBe("2026-09-07");
  });

  it("usa o mês do grupo quando a origem não informa data de fechamento", () => {
    const result = getClosingReferenceDate({
      conversionDate: null,
      consultDate: null,
      groupName: "Agendamentos Agosto 2026",
      lastUpdated: new Date("2026-08-06T00:00:00Z"),
    });

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("aceita grupos no formato abreviado, como Fechamento (AGO/2026)", () => {
    const result = groupNameToPeriodDate("Fechamento (AGO/2026)");

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("não usa a última atualização quando não existe data comercial", () => {
    const result = getClosingReferenceDate({
      conversionDate: null,
      consultDate: null,
      groupName: "Agendamentos - Dra. Nathalia",
      lastUpdated: new Date("2026-08-06T00:00:00Z"),
    });

    expect(result).toBeNull();
  });
});
