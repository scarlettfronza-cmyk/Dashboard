import { describe, it, expect } from "vitest";
import { descreverStatus, montarAlertaContas } from "./statusContaMeta";

describe("descreverStatus", () => {
  it("ativa não é problema; ausente conta como ativa", () => {
    expect(descreverStatus(1).gravidade).toBe("ok");
    expect(descreverStatus(undefined).gravidade).toBe("ok");
  });
  it("cartão recusado = UNSETTLED, crítico, com o que fazer", () => {
    const s = descreverStatus(3);
    expect(s.gravidade).toBe("critico");
    expect(s.rotulo).toBe("Pagamento pendente");
    expect(s.detalhe).toMatch(/cartão/i);
  });
  it("desativada cita o motivo quando a Meta informa", () => {
    expect(descreverStatus(2, 3).detalhe).toContain("risco de pagamento");
    expect(descreverStatus(2).detalhe).not.toContain("Motivo");
  });
  it("status desconhecido vira aviso, não quebra", () => {
    expect(descreverStatus(999)).toMatchObject({ gravidade: "aviso", rotulo: "Status 999" });
  });
});

describe("montarAlertaContas", () => {
  it("null sem problemas", () => {
    expect(montarAlertaContas([{ nome: "A", status: descreverStatus(1) }])).toBeNull();
  });
  it("críticos primeiro, com emoji de cartão", () => {
    const m = montarAlertaContas([
      { nome: "Em análise", status: descreverStatus(7) },
      { nome: "Dr. Cartão ", status: descreverStatus(3) },
      { nome: "Ok", status: descreverStatus(1) },
    ])!;
    expect(m.indexOf("Dr. Cartão")).toBeLessThan(m.indexOf("Em análise"));
    expect(m).toContain("💳 *Dr. Cartão* — Pagamento pendente");
    expect(m).not.toContain("Ok");
  });
});
