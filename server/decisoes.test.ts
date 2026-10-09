import { describe, it, expect } from "vitest";
import { statusDecisao, resumoDecisoes, diasParaPrazo, formatarPrazo, ordenarDecisoes } from "@shared/decisoes";

const hoje = new Date(2026, 9, 9); // 09/10/2026

describe("statusDecisao", () => {
  it("concluída vence qualquer prazo", () => {
    expect(statusDecisao({ prazo: "2026-01-01", concluidaEm: new Date() }, hoje)).toBe("concluida");
  });
  it("prazo passado é vencida; hoje ainda é pendente", () => {
    expect(statusDecisao({ prazo: "2026-10-08", concluidaEm: null }, hoje)).toBe("vencida");
    expect(statusDecisao({ prazo: "2026-10-09", concluidaEm: null }, hoje)).toBe("pendente");
    expect(statusDecisao({ prazo: null, concluidaEm: null }, hoje)).toBe("pendente");
  });
});

describe("prazo", () => {
  it("conta os dias e descreve em português", () => {
    expect(diasParaPrazo("2026-10-12", hoje)).toBe(3);
    expect(formatarPrazo("2026-10-12", hoje)).toBe("vence em 3 dias");
    expect(formatarPrazo("2026-10-10", hoje)).toBe("vence amanhã");
    expect(formatarPrazo("2026-10-09", hoje)).toBe("vence hoje");
    expect(formatarPrazo("2026-10-08", hoje)).toBe("venceu ontem");
    expect(formatarPrazo("2026-10-01", hoje)).toBe("venceu há 8 dias");
    expect(formatarPrazo(null, hoje)).toBe("sem prazo");
  });
});

describe("resumo e ordem", () => {
  const lista = [
    { id: 1, prazo: "2026-10-20", concluidaEm: null, createdAt: new Date(2026, 9, 1) },
    { id: 2, prazo: "2026-10-01", concluidaEm: null, createdAt: new Date(2026, 9, 1) },
    { id: 3, prazo: null, concluidaEm: new Date(2026, 9, 5), createdAt: new Date(2026, 9, 1) },
    { id: 4, prazo: "2026-10-10", concluidaEm: null, createdAt: new Date(2026, 9, 2) },
  ];
  it("conta por status", () => {
    expect(resumoDecisoes(lista, hoje)).toEqual({ pendente: 2, vencida: 1, concluida: 1 });
  });
  it("vencidas primeiro, depois por prazo, concluídas no fim", () => {
    expect(ordenarDecisoes(lista, hoje).map((d) => d.id)).toEqual([2, 4, 1, 3]);
  });
});
