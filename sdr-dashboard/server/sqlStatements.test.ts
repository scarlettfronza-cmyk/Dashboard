import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "./sqlStatements";

describe("divisão de comandos SQL", () => {
  it("separa comandos simples", () => {
    expect(splitSqlStatements("SELECT 1; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("não corta em ponto e vírgula dentro de texto", () => {
    const r = splitSqlStatements("INSERT INTO t VALUES ('a; b'); SELECT 1;");
    expect(r).toHaveLength(2);
    expect(r[0]).toContain("'a; b'");
  });

  it("entende aspas simples duplicadas como escape", () => {
    const r = splitSqlStatements("INSERT INTO t VALUES ('O''Brien; x');");
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("O''Brien; x");
  });

  it("entende barra invertida como escape", () => {
    const r = splitSqlStatements("INSERT INTO t VALUES ('a\\'; b');");
    expect(r).toHaveLength(1);
  });

  it("ignora comentário de linha", () => {
    const r = splitSqlStatements("-- comentário; com ponto e vírgula\nSELECT 1;");
    expect(r).toEqual(["SELECT 1"]);
  });

  it("descarta comentário de bloco comum", () => {
    const r = splitSqlStatements("/* nota; aqui */ SELECT 1;");
    expect(r).toEqual(["SELECT 1"]);
  });

  it("preserva comentário executável do MySQL", () => {
    const r = splitSqlStatements("CREATE TABLE t (id int /*!80000 INVISIBLE */);");
    expect(r[0]).toContain("/*!80000 INVISIBLE */");
  });

  it("lida com crase em nome de coluna", () => {
    const r = splitSqlStatements("INSERT INTO `a;b` (`c`) VALUES (1);");
    expect(r).toHaveLength(1);
  });

  it("aceita o último comando sem ponto e vírgula", () => {
    expect(splitSqlStatements("SELECT 1")).toEqual(["SELECT 1"]);
  });

  it("devolve lista vazia para dump vazio ou só comentários", () => {
    expect(splitSqlStatements("")).toEqual([]);
    expect(splitSqlStatements("-- só comentário\n")).toEqual([]);
  });
});

describe("tabelaCriada e comandoIgnorado", () => {
  it("reconhece o nome da tabela em variações do CREATE TABLE", async () => {
    const { tabelaCriada } = await import("./sqlStatements");
    expect(tabelaCriada("CREATE TABLE `clients` (`id` int)")).toBe("clients");
    expect(tabelaCriada("create table if not exists users (id int)")).toBe("users");
    expect(tabelaCriada("CREATE TABLE `sdr`.`ai_reports` (id int)")).toBe("ai_reports");
    expect(tabelaCriada("INSERT INTO `clients` VALUES (1)")).toBeNull();
  });

  it("ignora USE e CREATE DATABASE", async () => {
    const { comandoIgnorado } = await import("./sqlStatements");
    expect(comandoIgnorado("USE `manus_db`")).toBe(true);
    expect(comandoIgnorado("CREATE DATABASE IF NOT EXISTS x")).toBe(true);
    expect(comandoIgnorado("CREATE TABLE x (id int)")).toBe(false);
  });
});
