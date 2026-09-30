import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { LOCAL_SESSION_COOKIE, readSessionToken } from "../password";

describe("sessão local de SDR", () => {
  it("mantém o identificador da SDR no cookie para a consulta protegida seguinte", async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "test-session-secret");
    const token = await new SignJWT({ uid: 91, kind: "local" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    const cookieHeader = `${LOCAL_SESSION_COOKIE}=${encodeURIComponent(token)}`;
    const tokenFromCookie = cookieHeader
      .split(";")
      .map(part => part.trim())
      .find(part => part.startsWith(`${LOCAL_SESSION_COOKIE}=`))
      ?.slice(LOCAL_SESSION_COOKIE.length + 1);

    expect(await readSessionToken(tokenFromCookie ? decodeURIComponent(tokenFromCookie) : undefined)).toBe(91);
  });
});
