import { describe, it, expect } from "vitest";
import { statusSignificaFechou } from "./mondaySync";

describe("statusSignificaFechou", () => {
  it.each([["Sim", true], ["sim ", true], ["Negócio Fechado", true], ["Feito", true], ["Pago", true], ["Não", false], ["Aguardando", false], ["", false], [null, false]])
  ("%s → %s", (t, esperado) => { expect(statusSignificaFechou(t as string | null)).toBe(esperado); });
});
