import { describe, expect, it } from "vitest";
import { shouldAutoSyncMonday } from "../client/src/lib/mondaySync";

describe("auto-sync Monday no painel manager", () => {
  it("sincroniza quando o gestor, o cliente e o board estão configurados", () => {
    expect(shouldAutoSyncMonday({
      managerToken: "jwt-do-gestor",
      clientId: 30001,
      mondayBoardId: "7171531533",
    })).toBe(true);
  });

  it("não tenta sincronizar quando falta a configuração do board", () => {
    expect(shouldAutoSyncMonday({
      managerToken: "jwt-do-gestor",
      clientId: 30001,
      mondayBoardId: null,
    })).toBe(false);
  });
});

