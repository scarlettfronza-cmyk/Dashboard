import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secretCipher";

const originalSecret = process.env.INTEGRATION_ENCRYPTION_KEY;

afterEach(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = originalSecret;
});

describe("secret cipher", () => {
  it("encrypts integration tokens and restores them only with the server secret", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "z".repeat(64);
    const plaintext = "EAAB-Token-Confidencial";
    const ciphertext = encryptSecret(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(isEncryptedSecret(ciphertext)).toBe(true);
    expect(decryptSecret(ciphertext)).toBe(plaintext);
  });

  it("keeps legacy plaintext readable during the one-time migration", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "z".repeat(64);
    expect(decryptSecret("legacy-token")).toBe("legacy-token");
  });

  it("rejects encryption when a secure master secret is absent", () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(() => encryptSecret("token")).toThrow("INTEGRATION_ENCRYPTION_KEY segura é obrigatória");
  });
});
