import { describe, expect, it } from "vitest";
import { getClosingReferenceDate, groupNameToPeriodDate } from "./db";

describe("data que conta para fechamentos", () => {
  it("prioriza a data explícita de fechamento", () => {
    const result = getClosingReferenceDate({
      conversionDate: new Date("2026-08-07T00:00:00Z"),
      consultDate: new Date("2026-08-04T00:00:00Z"),
      groupName: "Agendamentos Julho 2026",
      lastUpdated: new Date("2026-08-14T00:00:00Z"),
    });

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-07");
  });

  it("sem data de fechamento não é venda: a data da consulta não serve de reserva", () => {
    const result = getClosingReferenceDate({
      conversionDate: null,
      consultDate: new Date("2026-09-07T00:00:00Z"),
      groupName: "Agendamento Setembro 2026",
      lastUpdated: new Date("2026-09-11T00:00:00Z"),
    });

    expect(result).toBeNull();
  });

  it("nem o mês do grupo serve de reserva para fechamento", () => {
    const result = getClosingReferenceDate({
      conversionDate: null,
      consultDate: null,
      groupName: "Agendamentos Agosto 2026",
      lastUpdated: new Date("2026-08-06T00:00:00Z"),
    });

    expect(result).toBeNull();
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
