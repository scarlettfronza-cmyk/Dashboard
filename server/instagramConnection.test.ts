import { describe, expect, it } from "vitest";
import { pickPreferredInstagramConnection } from "./instagramConnection";

describe("pickPreferredInstagramConnection", () => {
  it("always uses the Instagram OAuth identity when both integrations are present", () => {
    const resolved = pickPreferredInstagramConnection(
      { accessToken: "oauth-token", metaIgUserId: "correct-ig", metaIgUsername: "drmario" },
      { accessToken: "meta-token", metaIgUserId: "wrong-ig", metaIgUsername: "dratatiana" },
    );

    expect(resolved).toMatchObject({
      source: "instagram_oauth",
      accessToken: "oauth-token",
      metaIgUserId: "correct-ig",
      metaIgUsername: "drmario",
    });
  });

  it("uses the Meta Ads token only as authentication fallback for the OAuth identity", () => {
    const resolved = pickPreferredInstagramConnection(
      { accessToken: null, metaIgUserId: "correct-ig", metaIgUsername: "drmario" },
      { accessToken: "meta-token", metaIgUserId: "wrong-ig", metaIgUsername: "dratatiana" },
    );

    expect(resolved).toMatchObject({
      source: "instagram_oauth",
      accessToken: "meta-token",
      metaIgUserId: "correct-ig",
      metaIgUsername: "drmario",
    });
  });

  it("falls back to the Meta Ads identity only when no OAuth identity exists", () => {
    const resolved = pickPreferredInstagramConnection(
      null,
      { accessToken: "meta-token", metaIgUserId: "fallback-ig", metaIgUsername: "fallback" },
    );

    expect(resolved).toMatchObject({ source: "meta_token", metaIgUserId: "fallback-ig" });
  });
});
