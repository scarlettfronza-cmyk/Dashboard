import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  comandosDaMigracao, tabelaCriada, tabelaAlterada, tabelasDasMigracoes,
  comandosParaTabela, tabelasFaltando,
} from "./schemaFaltante";

const m1 = "CREATE TABLE `a` (\n\t`id` int NOT NULL\n);\n--> statement-breakpoint\nCREATE TABLE `b` (`id` int);";
const m2 = "ALTER TABLE `a` ADD `x` int;\n--> statement-breakpoint\nCREATE INDEX `a_x_idx` ON `a` (`x`);\n--> statement-breakpoint\nALTER TABLE `b` ADD `y` int;";
const m3 = "CREATE TABLE `c` (`id` int);";

describe("comandosDaMigracao", () => {
  it("separa pelo marcador do Drizzle e tira o ponto e vírgula", () => {
    expect(comandosDaMigracao(m2)).toEqual([
      "ALTER TABLE `a` ADD `x` int",
      "CREATE INDEX `a_x_idx` ON `a` (`x`)",
      "ALTER TABLE `b` ADD `y` int",
    ]);
  });
  it("arquivo de um comando só", () => {
    expect(comandosDaMigracao(m3)).toEqual(["CREATE TABLE `c` (`id` int)"]);
  });
});

describe("reconhecimento de comandos", () => {
  it("CREATE TABLE com e sem crase", () => {
    expect(tabelaCriada("CREATE TABLE `x` (...)")).toBe("x");
    expect(tabelaCriada("create table y (...)")).toBe("y");
    expect(tabelaCriada("ALTER TABLE `x` ADD a int")).toBeNull();
  });
  it("ALTER e CREATE INDEX apontam a tabela", () => {
    expect(tabelaAlterada("ALTER TABLE `x` ADD a int")).toBe("x");
    expect(tabelaAlterada("CREATE INDEX `i` ON `x` (`a`)")).toBe("x");
    expect(tabelaAlterada("CREATE UNIQUE INDEX `i` ON `x` (`a`)")).toBe("x");
    expect(tabelaAlterada("CREATE TABLE `x` (...)")).toBeNull();
  });
});

describe("comandosParaTabela", () => {
  it("CREATE IF NOT EXISTS seguido dos ALTER/INDEX posteriores, só dessa tabela", () => {
    expect(comandosParaTabela([m1, m2, m3], "a")).toEqual([
      "CREATE TABLE IF NOT EXISTS `a` (\n\t`id` int NOT NULL\n)",
      "ALTER TABLE `a` ADD `x` int",
      "CREATE INDEX `a_x_idx` ON `a` (`x`)",
    ]);
  });
  it("ignora ALTER anterior ao CREATE (não deveria existir, mas não pode quebrar)", () => {
    expect(comandosParaTabela([m2, m1], "b")).toEqual(["CREATE TABLE IF NOT EXISTS `b` (`id` int)"]);
  });
  it("tabela desconhecida → nada", () => {
    expect(comandosParaTabela([m1, m2], "zzz")).toEqual([]);
  });
});

describe("tabelasFaltando", () => {
  it("compara sem diferenciar maiúsculas", () => {
    expect(tabelasFaltando(["a", "b", "c"], ["A", "c"])).toEqual(["b"]);
  });
});

describe("com as migrações reais do projeto", () => {
  const dir = path.resolve(__dirname, "../drizzle");
  const migracoes = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(path.join(dir, f), "utf8"));

  it("encontra as tabelas que o backup do Manus não trazia", () => {
    const todas = tabelasDasMigracoes(migracoes);
    for (const t of ["public_report_access_logs", "oauth_states", "creative_analyses", "clients"]) {
      expect(todas).toContain(t);
    }
  });
  it("monta a criação do registro de acesso ao relatório", () => {
    const cmds = comandosParaTabela(migracoes, "public_report_access_logs");
    expect(cmds[0]).toMatch(/^CREATE TABLE IF NOT EXISTS `public_report_access_logs`/);
    expect(cmds.every((c) => !/^ALTER TABLE `(?!public_report_access_logs`)/.test(c))).toBe(true);
  });
  it("oauth_states leva o índice criado na migração seguinte", () => {
    const cmds = comandosParaTabela(migracoes, "oauth_states");
    expect(cmds.some((c) => /CREATE INDEX `oauth_states_expiresAt_idx`/.test(c))).toBe(true);
  });
});
