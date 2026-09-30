import { describe, expect, it } from "vitest";
import { getMondayErrorGuidance } from "./mondayError";

describe("mensagem de recuperação do Monday", () => {
  it("orienta a aguardar e tentar novamente no limite 429", () => {
    expect(getMondayErrorGuidance("Limite de requisições do Monday atingido.")).toContain("Espere um pouco e tente de novo");
  });

  it("não confunde limite de requisições com erro de token", () => {
    expect(getMondayErrorGuidance("Limite de requisições do Monday atingido.")).not.toContain("MONDAY_API_TOKEN");
  });
});
