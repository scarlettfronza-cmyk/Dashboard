import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const masterSecret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!masterSecret || masterSecret.length < 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY segura é obrigatória para proteger tokens de integração.");
  }

  return Buffer.from(crypto.hkdfSync(
    "sha256",
    Buffer.from(masterSecret, "utf8"),
    Buffer.from("ads-dashboard:secret-cipher:v1", "utf8"),
    Buffer.from("integration-token-encryption", "utf8"),
    32,
  ));
}

export function isEncryptedSecret(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(value: string | null | undefined) {
  if (!value || isEncryptedSecret(value)) return value ?? null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value || !isEncryptedSecret(value)) return value ?? null;

  const payload = value.slice(PREFIX.length).split(".");
  if (payload.length !== 3) throw new Error("Formato de token criptografado inválido.");
  const [ivEncoded, tagEncoded, ciphertextEncoded] = payload;
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
