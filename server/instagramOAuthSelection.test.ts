import { describe, expect, it } from "vitest";
import { getProfileListingToken, isPendingInstagramSelection, requireAccessibleInstagramProfile } from "./instagramOAuthSelection";

describe("instagramOAuthSelection", () => {
  it("prioriza o token OAuth pendente ao listar perfis", () => {
    expect(getProfileListingToken("oauth-token", "meta-token")).toBe("oauth-token");
  });

  it("identifica uma autorização que ainda exige seleção humana", () => {
    expect(isPendingInstagramSelection({ accessToken: "oauth-token", metaIgUserId: null })).toBe(true);
    expect(isPendingInstagramSelection({ accessToken: "oauth-token", metaIgUserId: "17841402950971975" })).toBe(false);
  });

  it("rejeita um perfil que não estava disponível na autorização atual", () => {
    const profiles = [{ igUserId: "1", username: "perfil-correto", name: "Perfil correto", followersCount: 10 }];
    expect(requireAccessibleInstagramProfile(profiles, "1").username).toBe("perfil-correto");
    expect(() => requireAccessibleInstagramProfile(profiles, "2")).toThrow("não faz parte da autorização atual");
  });
});
