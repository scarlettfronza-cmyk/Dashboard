import { describe, expect, it } from "vitest";
import { shouldLoadAllClientData } from "./useMondayData";

describe("shouldLoadAllClientData", () => {
  it("não consulta o Monday antes de a carteira do banco resolver", () => {
    expect(shouldLoadAllClientData(null, { authenticated: true, clientCount: undefined })).toBe(false);
  });

  it("não consulta o Monday para SDR sem clientes vinculados", () => {
    expect(shouldLoadAllClientData(null, { authenticated: true, clientCount: 0 })).toBe(false);
  });

  it("consulta somente após a carteira resolvida indicar clientes", () => {
    expect(shouldLoadAllClientData(null, { authenticated: true, clientCount: 5 })).toBe(true);
  });
});
