import { describe, expect, it } from "vitest";
import { buildClientAssignment, listVisibleClients, transferClientAssignment } from "./clientAssignment";

describe("fluxo de distribuição de clientes", () => {
  it("atribui, isola e transfere um cliente entre duas SDRs", () => {
    const sdrA = 101;
    const sdrB = 202;
    const assigned = buildClientAssignment({
      sdrId: sdrA,
      name: " Dra Tatiana Patruni ",
      boardId: "18406678106, 18406678019",
      clientToken: "token-tatiana",
    });

    expect(listVisibleClients([assigned], "user", sdrA)).toEqual([assigned]);
    expect(listVisibleClients([assigned], "user", sdrB)).toEqual([]);

    const transferred = transferClientAssignment(assigned, sdrB);
    expect(listVisibleClients([transferred], "user", sdrA)).toEqual([]);
    expect(listVisibleClients([transferred], "user", sdrB)).toEqual([transferred]);
    expect(listVisibleClients([transferred], "admin", sdrA)).toEqual([transferred]);
  });
});
