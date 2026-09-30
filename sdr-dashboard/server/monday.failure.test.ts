import { describe, expect, it } from "vitest";
import { hasUnavailableBoards } from "./monday";

describe("hasUnavailableBoards", () => {
  it("sinaliza quando um board não pôde ser carregado nem pelo cache", () => {
    expect(hasUnavailableBoards([{ unavailable: false }, { unavailable: true }])).toBe(true);
  });

  it("permite a geração quando todos os boards foram carregados", () => {
    expect(hasUnavailableBoards([{ unavailable: false }, {}])).toBe(false);
  });
});
