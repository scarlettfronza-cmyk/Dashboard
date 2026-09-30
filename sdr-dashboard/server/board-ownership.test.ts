import { describe, expect, it } from "vitest";
import { overlappingBoardIds } from "./routers/sdr";

describe("proteção contra boards duplicados", () => {
  it("identifica board compartilhado mesmo em cadastro com múltiplos boards", () => {
    expect(overlappingBoardIds("101, 202", "303,202")).toEqual(["202"]);
  });

  it("não acusa conflito quando os conjuntos não se cruzam", () => {
    expect(overlappingBoardIds("101,202", "303,404")).toEqual([]);
  });

  it("ignora espaços e entradas vazias", () => {
    expect(overlappingBoardIds(" 101, , 202 ", " 202 ")).toEqual(["202"]);
  });
});

