import { describe, it, expect } from "vitest";
import { candidatosExecutavel, resolverExecutavel } from "./relatorioPdf";

describe("candidatosExecutavel", () => {
  it("prioriza CHROMIUM_PATH, depois o do Playwright, depois o padrão do container", () => {
    expect(candidatosExecutavel({ CHROMIUM_PATH: "/x/chromium", PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: "/y" }))
      .toEqual(["/x/chromium", "/y", "/opt/pw-browsers/chromium"]);
  });
  it("ignora valores vazios", () => {
    expect(candidatosExecutavel({ CHROMIUM_PATH: "  " })).toEqual(["/opt/pw-browsers/chromium"]);
  });
});

describe("resolverExecutavel", () => {
  it("devolve o primeiro caminho que existe", () => {
    const r = resolverExecutavel({ CHROMIUM_PATH: "/nao/existe" }, (p) => p === "/opt/pw-browsers/chromium", () => null);
    expect(r).toBe("/opt/pw-browsers/chromium");
  });
  it("cai para o PATH quando nenhum caminho existe", () => {
    const r = resolverExecutavel({}, () => false, (n) => (n === "chromium" ? "/nix/store/abc/bin/chromium" : null));
    expect(r).toBe("/nix/store/abc/bin/chromium");
  });
  it("null quando não há navegador", () => {
    expect(resolverExecutavel({}, () => false, () => null)).toBeNull();
  });
});
