import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

/** Banco simulado: registra o que foi executado e finge o estado das tabelas. */
const estado = {
  tabelas: [] as string[],
  contagens: {} as Record<string, number>,
  executados: [] as string[],
  encerrado: false,
};

vi.mock("mysql2/promise", () => ({
  default: {
    createConnection: async () => ({
      query: async (sql: string) => {
        if (sql === "SHOW TABLES") {
          return [estado.tabelas.map((t) => ({ Tables_in_test: t }))];
        }
        const m = /SELECT COUNT\(\*\) AS n FROM `(.+)`/.exec(sql);
        if (m) return [[{ n: estado.contagens[m[1]] ?? 0 }]];
        estado.executados.push(sql);
        return [[]];
      },
      end: async () => { estado.encerrado = true; },
    }),
  },
}));

const { registerRestoreRoute } = await import("./restoreRoute");

const SENHA = "senha-de-importacao-longa";

async function subirServidor() {
  const app = express();
  registerRestoreRoute(app);
  const srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const { port } = srv.address() as AddressInfo;
  return { srv, url: `http://127.0.0.1:${port}` };
}

async function importar(url: string, body: unknown) {
  const r = await fetch(`${url}/api/importar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, corpo: await r.json() };
}

describe("rota de importação", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    estado.tabelas = [];
    estado.contagens = {};
    estado.executados = [];
    estado.encerrado = false;
    process.env.DATABASE_URL = "mysql://u:p@127.0.0.1:3306/test";
  });
  afterEach(() => { process.env = { ...envOriginal }; });

  it("responde como inexistente quando a senha não está configurada", async () => {
    delete process.env.RESTORE_TOKEN;
    const { srv, url } = await subirServidor();
    const r = await importar(url, { senha: SENHA, sql: "SELECT 1;" });
    expect(r.status).toBe(404);
    expect(estado.executados).toHaveLength(0);
    srv.close();
  });

  it("informa o estado à tela", async () => {
    const { srv, url } = await subirServidor();
    delete process.env.RESTORE_TOKEN;
    expect(await (await fetch(`${url}/api/importar/status`)).json()).toEqual({ habilitada: false });
    process.env.RESTORE_TOKEN = SENHA;
    expect(await (await fetch(`${url}/api/importar/status`)).json()).toEqual({ habilitada: true });
    srv.close();
  });

  it("recusa senha errada sem tocar no banco", async () => {
    process.env.RESTORE_TOKEN = SENHA;
    const { srv, url } = await subirServidor();
    const r = await importar(url, { senha: "outra-senha-qualquer-aqui", sql: "SELECT 1;" });
    expect(r.status).toBe(401);
    expect(estado.executados).toHaveLength(0);
    srv.close();
  });

  it("recusa quando o banco já tem registros", async () => {
    process.env.RESTORE_TOKEN = SENHA;
    estado.tabelas = ["clients"];
    estado.contagens = { clients: 19 };
    const { srv, url } = await subirServidor();
    const r = await importar(url, { senha: SENHA, sql: "INSERT INTO a VALUES (1);" });
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toContain("1 tabela");
    expect(estado.executados).toHaveLength(0);
    srv.close();
  });

  it("recusa arquivo vazio", async () => {
    process.env.RESTORE_TOKEN = SENHA;
    const { srv, url } = await subirServidor();
    expect((await importar(url, { senha: SENHA, sql: "   " })).status).toBe(400);
    srv.close();
  });

  it("importa no banco vazio e devolve o resumo", async () => {
    process.env.RESTORE_TOKEN = SENHA;
    const { srv, url } = await subirServidor();
    const sql = "CREATE TABLE clients (id int);\nINSERT INTO clients VALUES (1);";
    // Depois da carga, a contagem simula o que entrou.
    estado.contagens = { clients: 19 };
    const r = await importar(url, { senha: SENHA, sql });
    expect(r.status).toBe(200);
    expect(r.corpo.ok).toBe(true);
    expect(r.corpo.comandos).toBe(2);
    expect(r.corpo.aplicados).toBe(2);
    // As checagens de chave estrangeira envolvem a carga.
    expect(estado.executados[0]).toContain("FOREIGN_KEY_CHECKS = 0");
    expect(estado.executados.at(-1)).toContain("FOREIGN_KEY_CHECKS = 1");
    expect(estado.encerrado).toBe(true);
    srv.close();
  });
});
