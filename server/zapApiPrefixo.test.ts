import { describe, it, expect } from "vitest";
import { prefixoInstancia } from "./zapApi";

describe("prefixoInstancia", () => {
  it("mostra só o começo do ID, com reticências", () => {
    expect(prefixoInstancia("3F95B6471583317B4476ABCDEF")).toBe("3F95B64715…");
  });
  it("vazio ou ausente não mostra nada", () => {
    expect(prefixoInstancia("  ")).toBeUndefined();
    expect(prefixoInstancia(undefined)).toBeUndefined();
  });
});
