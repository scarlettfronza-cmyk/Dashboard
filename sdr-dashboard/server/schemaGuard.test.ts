import { describe, expect, it } from "vitest";
import { COLUNAS, TABELAS, comandosFaltando, type EstadoBanco } from "./schemaGuard";

function estadoCompleto(): EstadoBanco {
  const estado: EstadoBanco = new Map();
  for (const [tabela, ddl] of Object.entries(TABELAS)) {
    const colunas = [...ddl.matchAll(/^\s+`(\w+)` /gm)].map(m => m[1]);
    estado.set(tabela, new Set(colunas));
  }
  return estado;
}

describe("comandosFaltando", () => {
  it("banco vazio: cria todas as tabelas e não altera nada", () => {
    const { criar, alterar } = comandosFaltando(new Map());
    expect(criar).toHaveLength(Object.keys(TABELAS).length);
    expect(alterar).toEqual([]);
  });

  it("banco em dia: nada a fazer", () => {
    expect(comandosFaltando(estadoCompleto())).toEqual({ criar: [], alterar: [] });
  });

  it("backup do Manus sem a coluna do WhatsApp nem board_snapshots", () => {
    const estado = estadoCompleto();
    estado.get("clients")!.delete("whatsappGroupId");
    estado.delete("board_snapshots");
    const { criar, alterar } = comandosFaltando(estado);
    expect(criar).toHaveLength(1);
    expect(criar[0]).toContain("`board_snapshots`");
    expect(alterar).toEqual(["ALTER TABLE `clients` ADD COLUMN `whatsappGroupId` varchar(128) NULL"]);
  });

  it("toda coluna tardia também existe no CREATE TABLE da tabela", () => {
    const estado = estadoCompleto();
    for (const c of COLUNAS) expect(estado.get(c.tabela)?.has(c.coluna)).toBe(true);
  });
});
