import { describe, expect, it } from "vitest";
import { canAssignClient } from "./assignment";

describe("canAssignClient", () => {
  it("ativa o vínculo quando SDR, ao menos um board e nome estão preenchidos", () => {
    expect(canAssignClient(1, ["18406678106"], "Dra Tatiana Patruni")).toBe(true);
  });

  it("mantém o botão desativado sem SDR, board ou nome", () => {
    expect(canAssignClient(null, ["18406678106"], "Dra Tatiana Patruni")).toBe(false);
    expect(canAssignClient(1, [], "Dra Tatiana Patruni")).toBe(false);
    expect(canAssignClient(1, ["18406678106"], "   ")).toBe(false);
  });
});
