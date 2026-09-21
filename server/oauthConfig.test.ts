import crypto from "crypto";
import { describe, expect, it } from "vitest";

describe("configuração segura do OAuth Meta", () => {
  it("possui chave exclusiva válida e URL pública canônica", () => {
    const secret = process.env.OAUTH_STATE_SECRET;
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;

    expect(secret).toMatch(/^[a-f0-9]{64}$/i);
    expect(publicBaseUrl).toBe("https://dashboard.escarlatedigital.com");

    const payload = "oauth-state-validation";
    const signature = crypto
      .createHmac("sha256", secret!)
      .update(payload)
      .digest("hex");

    expect(signature).toHaveLength(64);
  });
});
