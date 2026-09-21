import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

const estado = {
  gestores: [] as Array<{ id: number; name: string; email: string; passwordHash: string; active: number }>,
  atualizacoes: [] as Array<{ id: number; passwordHash: string }>,
};

/** Banco simulado com a forma mínima do drizzle usada pela rota. */
vi.mock("./db", () => ({
  getDb: async () => ({
    select: (_cols?: unknown) => ({
      from: () => ({
        where: () => ({ limit: async () => estado.gestores.slice(0, 1) }),
        then: undefined,
        // `select().from()` sem where devolve a lista inteira
        [Symbol.asyncIterator]: undefined,
      }),
    }),
    update: () => ({
      set: (v: { passwordHash: string }) => ({
        where: async () => { estado.atualizacoes.push({ id: estado.gestores[0]?.id ?? 0, passwordHash: v.passwordHash }); },
      }),
    }),
  }),
}));
vi.mock("../drizzle/schema", () => ({ managers: { id: "id", name: "name", email: "email", active: "active" } }));
vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));

const { registerRecoveryRoute } = await import("./recoveryRoute");

const TOKEN = "token-de-recuperacao-longo";

async function subir() {
  const app = express();
  registerRecoveryRoute(app);
  const srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  return { srv, url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}` };
}

async function post(url: string, caminho: string, body: unknown) {
  const r = await fetch(`${url}${caminho}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: r.status, corpo: await r.json() };
}

describe("rota de recuperação de senha", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => {
    estado.gestores = [{ id: 90001, name: "Scarlett Fronza", email: "s@exemplo.com", passwordHash: "antigo", active: 1 }];
    estado.atualizacoes = [];
  });
  afterEach(() => { process.env = { ...envOriginal }; });

  it("responde como inexistente sem a variável", async () => {
    delete process.env.RECOVERY_TOKEN;
    const { srv, url } = await subir();
    const r = await post(url, "/api/recuperar/senha", { senha: TOKEN, email: "s@exemplo.com", novaSenha: "12345678" });
    expect(r.status).toBe(404);
    expect(estado.atualizacoes).toHaveLength(0);
    srv.close();
  });

  it("a senha da importação não abre a recuperação", async () => {
    delete process.env.RECOVERY_TOKEN;
    process.env.RESTORE_TOKEN = TOKEN;
    const { srv, url } = await subir();
    const r = await post(url, "/api/recuperar/senha", { senha: TOKEN, email: "s@exemplo.com", novaSenha: "12345678" });
    expect(r.status).toBe(404);
    expect(estado.atualizacoes).toHaveLength(0);
    srv.close();
  });

  it("recusa senha de recuperação errada", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    const { srv, url } = await subir();
    const r = await post(url, "/api/recuperar/senha", { senha: "errada-mas-com-16-chars", email: "s@exemplo.com", novaSenha: "12345678" });
    expect(r.status).toBe(401);
    expect(estado.atualizacoes).toHaveLength(0);
    srv.close();
  });

  it("recusa nova senha curta antes de tocar no banco", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    const { srv, url } = await subir();
    const r = await post(url, "/api/recuperar/senha", { senha: TOKEN, email: "s@exemplo.com", novaSenha: "1234" });
    expect(r.status).toBe(400);
    expect(estado.atualizacoes).toHaveLength(0);
    srv.close();
  });

  it("recusa e-mail vazio", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    const { srv, url } = await subir();
    expect((await post(url, "/api/recuperar/senha", { senha: TOKEN, email: "  ", novaSenha: "12345678" })).status).toBe(400);
    srv.close();
  });

  it("informa quando não existe gestor com o e-mail", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    estado.gestores = [];
    const { srv, url } = await subir();
    const r = await post(url, "/api/recuperar/senha", { senha: TOKEN, email: "ninguem@exemplo.com", novaSenha: "12345678" });
    expect(r.status).toBe(404);
    expect(r.corpo.erro).toContain("ninguem@exemplo.com");
    srv.close();
  });

  it("redefine a senha gravando um hash novo, nunca o texto", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    const { srv, url } = await subir();
    const r = await post(url, "/api/recuperar/senha", { senha: TOKEN, email: "s@exemplo.com", novaSenha: "senha-nova-123" });
    expect(r.status).toBe(200);
    expect(r.corpo.ok).toBe(true);
    expect(estado.atualizacoes).toHaveLength(1);
    const gravado = estado.atualizacoes[0].passwordHash;
    expect(gravado).not.toBe("senha-nova-123");
    expect(gravado).toMatch(/^\$2[aby]\$12\$/);
    srv.close();
  });

  it("informa o estado à tela", async () => {
    const { srv, url } = await subir();
    delete process.env.RECOVERY_TOKEN;
    expect(await (await fetch(`${url}/api/recuperar/status`)).json()).toEqual({ habilitada: false });
    process.env.RECOVERY_TOKEN = TOKEN;
    expect(await (await fetch(`${url}/api/recuperar/status`)).json()).toEqual({ habilitada: true });
    srv.close();
  });
});
