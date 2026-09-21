import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * O módulo de OAuth do Meta validava as variáveis na carga, o que derrubava o
 * processo na inicialização quando o Meta não estava configurado — mesmo com o
 * painel de gestor e o relatório público não dependendo delas.
 */
describe("carga do módulo de OAuth do Meta", () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    for (const n of ["META_APP_ID", "META_APP_SECRET", "OAUTH_STATE_SECRET", "PUBLIC_BASE_URL"]) {
      delete process.env[n];
    }
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it("importa sem as variáveis, para o servidor conseguir subir", async () => {
    await expect(import("./metaOAuth")).resolves.toBeDefined();
  });

  it("informa que não está configurado, e quais variáveis faltam", async () => {
    const m = await import("./metaOAuth");
    expect(m.isMetaOAuthConfigured()).toBe(false);
    expect(m.missingMetaOAuthVars()).toEqual([
      "META_APP_ID", "META_APP_SECRET", "OAUTH_STATE_SECRET", "PUBLIC_BASE_URL",
    ]);
  });

  it("reconhece a configuração completa", async () => {
    process.env.META_APP_ID = "1";
    process.env.META_APP_SECRET = "s";
    process.env.OAUTH_STATE_SECRET = "x".repeat(64);
    process.env.PUBLIC_BASE_URL = "https://exemplo.com";
    const m = await import("./metaOAuth");
    expect(m.isMetaOAuthConfigured()).toBe(true);
    expect(m.missingMetaOAuthVars()).toEqual([]);
  });

  it("aponta exatamente a variável que falta", async () => {
    process.env.META_APP_ID = "1";
    process.env.OAUTH_STATE_SECRET = "x".repeat(64);
    process.env.PUBLIC_BASE_URL = "https://exemplo.com";
    const m = await import("./metaOAuth");
    expect(m.missingMetaOAuthVars()).toEqual(["META_APP_SECRET"]);
  });
});
