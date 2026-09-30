import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

type Conta = { id: number; name: string | null; email: string | null; passwordHash: string | null; role: string };

const estado = {
  contas: [] as Conta[],
  atualizacoes: [] as Array<Record<string, unknown>>,
  /** Resultado da próxima busca com where (conta escolhida, ou e-mail repetido). */
  buscas: [] as Conta[][],
};

/** Banco simulado com a forma mínima do drizzle usada pela rota. */
vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => {
        // Mesmos apelidos do select da rota (nome, papel).
        const lista = Promise.resolve(
          estado.contas.map(c => ({ id: c.id, nome: c.name, email: c.email, papel: c.role, passwordHash: c.passwordHash })),
        );
        return Object.assign(lista, {
          where: () => ({ limit: async () => estado.buscas.shift() ?? [] }),
        });
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: async () => {
          estado.atualizacoes.push(v);
        },
      }),
    }),
  }),
}));

const { registerRecoveryRoute } = await import("./recoveryRoute");

const TOKEN = "token-de-recuperacao-longo";

async function subir() {
  const app = express();
  registerRecoveryRoute(app);
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  return { srv, url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}` };
}

async function post(url: string, caminho: string, body: unknown) {
  const r = await fetch(`${url}${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, corpo: await r.json() };
}

describe("rota de recuperação de acesso", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => {
    estado.contas = [
      { id: 1, name: "Gestora", email: null, passwordHash: null, role: "admin" },
      { id: 2, name: "Luana", email: "luana@exemplo.com", passwordHash: "scrypt$x", role: "user" },
    ];
    estado.atualizacoes = [];
    estado.buscas = [];
  });
  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it("responde como inexistente sem a variável", async () => {
    delete process.env.RECOVERY_TOKEN;
    const { srv, url } = await subir();
    try {
      expect((await post(url, "/api/recuperar/contas", { senha: TOKEN })).status).toBe(404);
    } finally {
      srv.close();
    }
  });

  it("recusa senha errada", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    const { srv, url } = await subir();
    try {
      expect((await post(url, "/api/recuperar/contas", { senha: "outra-senha-qualquer-longa" })).status).toBe(401);
    } finally {
      srv.close();
    }
  });

  it("lista as contas sem expor o hash da senha", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    const { srv, url } = await subir();
    try {
      const r = await post(url, "/api/recuperar/contas", { senha: TOKEN });
      expect(r.status).toBe(200);
      expect(r.corpo.contas).toEqual([
        { id: 1, nome: "Gestora", email: null, papel: "admin", temSenha: false },
        { id: 2, nome: "Luana", email: "luana@exemplo.com", papel: "user", temSenha: true },
      ]);
      expect(JSON.stringify(r.corpo)).not.toContain("scrypt");
    } finally {
      srv.close();
    }
  });

  it("conta do Manus sem e-mail exige o e-mail e grava senha como hash", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    const { srv, url } = await subir();
    try {
      estado.buscas = [[estado.contas[0]]];
      const semEmail = await post(url, "/api/recuperar/senha", { senha: TOKEN, id: 1, novaSenha: "SenhaNova.2026" });
      expect(semEmail.status).toBe(400);

      estado.buscas = [[estado.contas[0]], []];
      const ok = await post(url, "/api/recuperar/senha", {
        senha: TOKEN,
        id: 1,
        email: " Gestora@Exemplo.com ",
        novaSenha: "SenhaNova.2026",
      });
      expect(ok.status).toBe(200);
      expect(ok.corpo).toEqual({ ok: true, nome: "Gestora", email: "gestora@exemplo.com" });
      expect(estado.atualizacoes).toHaveLength(1);
      expect(estado.atualizacoes[0].email).toBe("gestora@exemplo.com");
      expect(String(estado.atualizacoes[0].passwordHash)).toMatch(/^scrypt\$/);
    } finally {
      srv.close();
    }
  });

  it("recusa senha fraca", async () => {
    process.env.RECOVERY_TOKEN = TOKEN;
    const { srv, url } = await subir();
    try {
      const r = await post(url, "/api/recuperar/senha", { senha: TOKEN, id: 2, novaSenha: "curta" });
      expect(r.status).toBe(400);
      expect(estado.atualizacoes).toHaveLength(0);
    } finally {
      srv.close();
    }
  });
});
