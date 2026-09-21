import { describe, expect, it } from "vitest";
import { buildLoginUrl, MANAGER_LOGIN_PATH } from "./loginUrl";

const REDIR = "https://exemplo.com/api/oauth/callback";

describe("URL de login do portal", () => {
  it("monta a URL quando o portal está configurado", () => {
    const u = buildLoginUrl("https://portal.exemplo", "app-1", REDIR);
    expect(u).not.toBeNull();
    const p = new URL(u!);
    expect(p.pathname).toBe("/app-auth");
    expect(p.searchParams.get("appId")).toBe("app-1");
    expect(p.searchParams.get("redirectUri")).toBe(REDIR);
    expect(p.searchParams.get("type")).toBe("signIn");
  });

  it("devolve null sem portal — era aqui que a página caía", () => {
    expect(buildLoginUrl(undefined, "app-1", REDIR)).toBeNull();
  });

  it("devolve null sem appId", () => {
    expect(buildLoginUrl("https://portal.exemplo", undefined, REDIR)).toBeNull();
  });

  it("devolve null quando o portal é um valor inválido", () => {
    expect(buildLoginUrl("nao-e-url", "app-1", REDIR)).toBeNull();
  });

  it("não duplica a barra final do portal", () => {
    const u = buildLoginUrl("https://portal.exemplo/", "app-1", REDIR);
    expect(u).toContain("https://portal.exemplo/app-auth");
  });

  it("expõe o login de gestor como alternativa", () => {
    expect(MANAGER_LOGIN_PATH).toBe("/manager/login");
  });
});
