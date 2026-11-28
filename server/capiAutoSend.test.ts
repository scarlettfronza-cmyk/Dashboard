import { describe, it, expect } from "vitest";
import { eventosDoLead, dataMondayMs } from "./capiAutoSend";

const agora = new Date(2026, 10, 28).getTime(); // 28/11/2026
const base = { mondayId: "1", phone: "5541999998888", status: "", consultDate: "", conversionDate: "", value: "", surgeryValue: "", closedValue: "", updatedAt: "2026-11-27T10:00:00Z" };

describe("dataMondayMs", () => {
  it("lê ISO e dd/mm/aaaa", () => {
    expect(dataMondayMs("2026-11-20")).toBe(new Date(2026, 10, 20).getTime());
    expect(dataMondayMs("20/11/2026")).toBe(new Date(2026, 10, 20).getTime());
    expect(dataMondayMs("")).toBeNull();
  });
});

describe("eventosDoLead", () => {
  it("agendou pela data da consulta recente", () => {
    expect(eventosDoLead({ ...base, consultDate: "2026-11-20" }, agora)).toEqual([{ eventName: "Schedule" }]);
  });
  it("agendou pelo status, sem data, se o item foi mexido há pouco", () => {
    expect(eventosDoLead({ ...base, status: "Consulta agendada" }, agora)).toEqual([{ eventName: "Schedule" }]);
    expect(eventosDoLead({ ...base, status: "Consulta agendada", updatedAt: "2026-08-01T10:00:00Z" }, agora)).toEqual([]);
  });
  it("fechou pela data de fechamento com valor, mandando o valor", () => {
    expect(eventosDoLead({ ...base, conversionDate: "25/11/2026", closedValue: "R$ 10.200,00" }, agora)).toEqual([{ eventName: "Purchase", value: 10200 }]);
  });
  it("fechou pelo status, com valor do procedimento", () => {
    expect(eventosDoLead({ ...base, status: "Negócio fechado", surgeryValue: "1300" }, agora)).toEqual([{ eventName: "Purchase", value: 1300 }]);
  });
  it("data de fechamento sem valor não é venda", () => {
    expect(eventosDoLead({ ...base, conversionDate: "2026-11-25" }, agora)).toEqual([]);
  });
  it("histórico antigo fica de fora", () => {
    expect(eventosDoLead({ ...base, consultDate: "2026-09-01", conversionDate: "2026-09-10", closedValue: "500" }, agora)).toEqual([]);
  });
  it("pode agendar e fechar no mesmo lead", () => {
    const evs = eventosDoLead({ ...base, consultDate: "2026-11-10", conversionDate: "2026-11-25", closedValue: "900" }, agora);
    expect(evs.map((e) => e.eventName)).toEqual(["Schedule", "Purchase"]);
  });
});
