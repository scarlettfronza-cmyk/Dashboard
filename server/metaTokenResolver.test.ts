import { describe, expect, it } from "vitest";
import { resolverToken, descreverAusencia } from "./metaTokenResolver";

describe("origem do token do Meta", () => {
  it("prefere o token da agência, para a renovação valer para todos", () => {
    const r = resolverToken("AGENCIA", { accessToken: "DO-CLIENTE", adAccountId: "act_1" });
    expect(r.token).toBe("AGENCIA");
    expect(r.origem).toBe("agencia");
  });

  it("usa o do cliente quando não há token da agência", () => {
    const r = resolverToken(null, { accessToken: "DO-CLIENTE", adAccountId: "act_1" });
    expect(r.token).toBe("DO-CLIENTE");
    expect(r.origem).toBe("cliente");
  });

  it("ignora valores em branco, que não são token", () => {
    expect(resolverToken("   ", { accessToken: "DO-CLIENTE" }).origem).toBe("cliente");
    expect(resolverToken("  ", { accessToken: "   " }).token).toBeNull();
  });

  it("mantém a conta de anúncio no cliente, mesmo usando o token da agência", () => {
    const r = resolverToken("AGENCIA", { accessToken: null, adAccountId: "act_999" });
    expect(r.token).toBe("AGENCIA");
    expect(r.adAccountId).toBe("act_999");
  });

  it("não inventa conta de anúncio quando o cliente não tem", () => {
    expect(resolverToken("AGENCIA", null).adAccountId).toBeNull();
    expect(resolverToken("AGENCIA", { accessToken: "x" }).adAccountId).toBeNull();
  });

  it("devolve vazio quando não há token algum", () => {
    const r = resolverToken(null, null);
    expect(r).toEqual({ token: null, origem: null, adAccountId: null });
  });

  it("explica o que falta, para a tela poder dizer", () => {
    expect(descreverAusencia(resolverToken(null, null))).toContain("Nenhum token");
    expect(descreverAusencia(resolverToken("AGENCIA", null))).toContain("conta de anúncio");
    expect(descreverAusencia(resolverToken("AGENCIA", { adAccountId: "act_1" }))).toBeNull();
  });
});
