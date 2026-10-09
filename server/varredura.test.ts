import { describe, it, expect } from "vitest";
import { janelaVarredura, resumirGasto } from "./varredura";

const hoje = new Date(2026, 9, 9); // 09/10/2026

describe("janelaVarredura", () => {
  it("14 dias terminando ontem", () => {
    expect(janelaVarredura(hoje)).toEqual({ since: "2026-09-25", until: "2026-10-08" });
  });
});

describe("resumirGasto", () => {
  it("separa ontem, semana atual e semana anterior, e conta campanhas ativas", () => {
    const linhas = [
      { data: "2026-10-08", campanha: "a", gasto: 50 },
      { data: "2026-10-08", campanha: "b", gasto: 30 },
      { data: "2026-10-08", campanha: "c", gasto: 0 },
      { data: "2026-10-05", campanha: "a", gasto: 40 },
      { data: "2026-10-02", campanha: "a", gasto: 10 }, // primeiro dia da semana atual
      { data: "2026-10-01", campanha: "a", gasto: 70 }, // semana anterior
      { data: "2026-09-25", campanha: "a", gasto: 20 },
      { data: "2026-09-24", campanha: "a", gasto: 999 }, // fora da janela
    ];
    expect(resumirGasto(linhas, hoje)).toEqual({ gastoOntem: 80, gasto7: 130, gasto7Anteriores: 90, campanhasAtivas: 2 });
  });
  it("sem linhas, tudo zero", () => {
    expect(resumirGasto([], hoje)).toEqual({ gastoOntem: 0, gasto7: 0, gasto7Anteriores: 0, campanhasAtivas: 0 });
  });
});
