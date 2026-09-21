import { describe, expect, it } from "vitest";
import { resolveModuleDir } from "./moduleDir";

describe("diretório do módulo", () => {
  it("usa o dirname nativo quando existe (Node 20.11+)", () => {
    expect(resolveModuleDir("/app/dist", "file:///outro/lugar/x.js")).toBe("/app/dist");
  });

  it("deriva da URL quando o dirname não existe (Node 18)", () => {
    expect(resolveModuleDir(undefined, "file:///app/dist/index.js")).toBe("/app/dist");
  });

  it("nunca devolve undefined, que é o que quebrava o path.resolve", () => {
    const r = resolveModuleDir(undefined, import.meta.url);
    expect(typeof r).toBe("string");
    expect(r.length).toBeGreaterThan(0);
  });
});
