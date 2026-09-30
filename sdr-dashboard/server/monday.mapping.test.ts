import { describe, expect, it } from "vitest";
import { COLUMN_PROFILES, mappingForBoard, type ColumnMeta } from "./monday";

const columns: ColumnMeta[] = [
  { id: "consulta", title: "Data da consulta", type: "date" },
  { id: "fechamento", title: "Data Fechamento", type: "date" },
  { id: "consulta-valor", title: "Valor da Consulta", type: "numbers" },
  { id: "procedimento-valor", title: "Valor do procedimento", type: "numbers" },
];

describe("mappingForBoard", () => {
  it("prioriza o valor de procedimento quando o board possui valor de consulta e de cirurgia", () => {
    const mapping = mappingForBoard("outro-board", COLUMN_PROFILES.ellora, columns);
    expect(mapping.valor[0]).toBe("procedimento-valor");
  });

  it("respeita o campo comercial da Dra. Tatiana mesmo havendo outra data de fechamento", () => {
    const mapping = mappingForBoard("18406678106", COLUMN_PROFILES.ellora, columns);
    expect(mapping.dataFechamento[0]).toBe("date_mm0gbha1");
    expect(mapping.valor[0]).toBe("numeric_mm0g5ne5");
  });
});
