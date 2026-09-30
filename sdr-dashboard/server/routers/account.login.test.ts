import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("../db", () => ({ getDb: getDbMock }));

import { hashPassword } from "../password";
import { accountRouter } from "./account";

describe("account.login", () => {
  beforeEach(() => getDbMock.mockReset());

  it("autentica a gestora pela mesma procedure usada pela tela de entrada", async () => {
    const passwordHash = await hashPassword("SenhaSegura.2026");
    const cookies: Array<{ name: string; value: string }> = [];
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [{ id: 1, email: "gestora@example.com", passwordHash, name: "Gestora", role: "admin" }] }) }),
      }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    getDbMock.mockResolvedValue(db);

    const ctx = {
      user: null,
      req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
      res: { cookie: (name: string, value: string) => cookies.push({ name, value }), clearCookie: vi.fn() },
    } as any;

    const result = await accountRouter.createCaller(ctx).login({
      email: "Gestora@Example.com",
      password: "SenhaSegura.2026",
    });

    expect(result).toMatchObject({ id: 1, email: "gestora@example.com", role: "admin" });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.value).toBeTruthy();
  });
});
