import { afterEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { verifyManagerJwt } from "./managerAuth";
import { getManagerJwtSecret } from "./managerAuthSecret";

const originalJwtSecret = process.env.MANAGER_JWT_SECRET;
const originalLegacyJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  process.env.MANAGER_JWT_SECRET = originalJwtSecret;
  process.env.JWT_SECRET = originalLegacyJwtSecret;
});

describe("autorização de gestor", () => {
  it("aceita somente um JWT de gestor assinado com o segredo obrigatório", async () => {
    process.env.MANAGER_JWT_SECRET = "g".repeat(64);
    const validToken = await new SignJWT({ managerId: 42 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(getManagerJwtSecret());

    await expect(verifyManagerJwt(validToken)).resolves.toEqual({ managerId: 42 });
    await expect(verifyManagerJwt("token-falso")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejeita tokens assinados pelo segredo legado da sessão administrativa", async () => {
    process.env.MANAGER_JWT_SECRET = "m".repeat(64);
    process.env.JWT_SECRET = "l".repeat(64);
    const legacySecret = new TextEncoder().encode(process.env.JWT_SECRET);
    const legacyToken = await new SignJWT({ managerId: 42 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(legacySecret);

    await expect(verifyManagerJwt(legacyToken)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
