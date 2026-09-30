import { describe, expect, it } from "vitest";
import { COLUMN_PROFILES, mappingForBoard, mappingFromTitles, type ColumnMeta } from "./monday";

// Colunas no formato dos boards da Luana: consulta aparece antes da cirurgia,
// e há datas "fechadas" que não são a data da consulta.
const columns: ColumnMeta[] = [
  { id: "status", title: "Status do Lead", type: "status" },
  { id: "consulta-fechada", title: "Data Consulta Fechada", type: "date" },
  { id: "consulta", title: "Data da consulta", type: "date" },
  { id: "fechamento", title: "Data de fechamento", type: "date" },
  { id: "procedimento-fechado", title: "Data Procedimento Fechado", type: "date" },
  { id: "consulta-valor", title: "Valor da Consulta", type: "numbers" },
  { id: "procedimento-valor", title: "Valor do procedimento", type: "numbers" },
  { id: "cirurgia-valor", title: "Valor da cirurgia", type: "numbers" },
];

describe("mappingFromTitles", () => {
  it("prioriza valor da cirurgia ou do procedimento sobre o valor da consulta", () => {
    expect(mappingFromTitles(columns).valor).toEqual(["procedimento-valor"]);

    const soCirurgia = columns.filter(c => c.id !== "procedimento-valor");
    expect(mappingFromTitles(soCirurgia).valor).toEqual(["cirurgia-valor"]);
  });

  it("usa o valor da consulta quando não há valor de cirurgia nem de procedimento", () => {
    const soConsulta = columns.filter(c => !["procedimento-valor", "cirurgia-valor"].includes(c.id));
    expect(mappingFromTitles(soConsulta).valor).toEqual(["consulta-valor"]);
  });

  it("não deixa uma regra genérica posterior sobrescrever a específica", () => {
    const comGenerico: ColumnMeta[] = [
      { id: "valor", title: "Valor", type: "numbers" },
      { id: "ticket", title: "Ticket", type: "numbers" },
      { id: "cirurgia-valor", title: "Valor da cirurgia", type: "numbers" },
    ];
    expect(mappingFromTitles(comGenerico).valor).toEqual(["cirurgia-valor"]);
  });

  it("lê o Valor da Consulta à parte, sem tirar a coluna da receita", () => {
    expect(mappingFromTitles(columns).valorConsulta).toEqual(["consulta-valor"]);
    const soConsulta: ColumnMeta[] = [{ id: "vc", title: "Valor da Consulta", type: "numbers" }];
    const m = mappingFromTitles(soConsulta);
    expect(m.valorConsulta).toEqual(["vc"]);
    expect(m.valor).toEqual(["vc"]);
  });

  it("não trata 'Data Consulta Fechada' como data da consulta", () => {
    const mapping = mappingFromTitles(columns);
    expect(mapping.dataConsulta).toEqual(["consulta"]);
    expect(mapping.dataFechamento).toEqual(["consulta-fechada"]);
  });
});

describe("mappingForBoard", () => {
  it("board sem critério comercial segue a detecção por título com o perfil como reserva", () => {
    const mapping = mappingForBoard("outro-board", COLUMN_PROFILES.ellora, columns);
    expect(mapping.valor[0]).toBe("procedimento-valor");
    expect(mapping.valor).toContain("numeric_mm0g5ne5");
  });

  it("Dra. Tatiana: data da consulta e valor da cirurgia, sem reserva", () => {
    const mapping = mappingForBoard("18406678106", COLUMN_PROFILES.ellora, columns);
    expect(mapping.dataFechamento).toEqual(["consulta"]);
    expect(mapping.valor).toEqual(["cirurgia-valor"]);
  });

  it("Dr. Jonas e Dr. Lucas: valor do procedimento, nunca o valor da consulta", () => {
    for (const boardId of ["18406696056", "18418032339"]) {
      const mapping = mappingForBoard(boardId, COLUMN_PROFILES.ellora, columns);
      expect(mapping.dataFechamento).toEqual(["consulta"]);
      expect(mapping.valor).toEqual(["procedimento-valor"]);
      expect(mapping.valor).not.toContain("consulta-valor");
    }
  });

  it("Dr. Mansur: valor da cirurgia, nunca o valor da consulta", () => {
    const mapping = mappingForBoard("18406692406", COLUMN_PROFILES.ellora, columns);
    expect(mapping.valor).toEqual(["cirurgia-valor"]);
  });

  it("critério com coluna ausente no board mantém a detecção em vez de esvaziar o campo", () => {
    const semCirurgia = columns.filter(c => c.id !== "cirurgia-valor");
    const mapping = mappingForBoard("18406678106", COLUMN_PROFILES.ellora, semCirurgia);
    expect(mapping.valor[0]).toBe("procedimento-valor");
    expect(mapping.dataFechamento).toEqual(["consulta"]);
  });

  it("título do critério casa sem acento e sem diferença de maiúsculas", () => {
    const variante = columns.map(c => (c.id === "consulta" ? { ...c, title: "DATA DA CONSULTA " } : c));
    const mapping = mappingForBoard("18406678106", COLUMN_PROFILES.ellora, variante);
    expect(mapping.dataFechamento).toEqual(["consulta"]);
  });
});
