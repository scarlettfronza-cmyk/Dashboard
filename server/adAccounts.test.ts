import { describe, expect, it } from "vitest";
import { buildClientAdAccountIds } from "./adAccounts";

describe("contas Meta do cliente", () => {
  it("reúne a conta principal e as contas adicionais", () => {
    expect(buildClientAdAccountIds("act_100", [
      { id: "act_200", name: "Conta 2" },
      { id: "act_300", name: "Conta 3" },
    ])).toEqual(["act_100", "act_200", "act_300"]);
  });

  it("mantém compatibilidade com configurações antigas separadas por vírgula e remove duplicidades", () => {
    expect(buildClientAdAccountIds(" act_100, act_200 ", [
      { id: "act_200", name: "Duplicada" },
      { id: "act_300", name: "Conta 3" },
    ])).toEqual(["act_100", "act_200", "act_300"]);
  });
});
