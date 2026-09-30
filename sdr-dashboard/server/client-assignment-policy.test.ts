import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("política de atribuição de clientes", () => {
  it("expõe a atribuição e a transferência apenas no painel administrativo", () => {
    const procedures = appRouter._def.procedures;

    expect(procedures["admin.assignClient"]).toBeDefined();
    expect(procedures["admin.reassignClient"]).toBeDefined();
    expect(procedures["sdr.addClient"]).toBeUndefined();
  });
});
