import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("../db", () => ({ getDb: getDbMock }));

import { accountRouter } from "./account";

describe("account.signup", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("cria uma nova SDR como usuária comum sem clientes atribuídos", async () => {
    let whereCalls = 0;
    let inserted: Record<string, unknown> | undefined;
    const cookies: Array<{ name: string; value: string }> = [];

    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              whereCalls += 1;
              if (whereCalls === 1) return [];
              return [{
                id: 77,
                openId: inserted?.openId,
                name: inserted?.name,
                email: inserted?.email,
                passwordHash: inserted?.passwordHash,
                loginMethod: "password",
                role: "user",
              }];
            },
          }),
          limit: async () => [{ id: 1 }],
        }),
      }),
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          inserted = values;
        },
      }),
    };
    getDbMock.mockResolvedValue(db);

    const ctx = {
      user: null,
      req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
      res: {
        cookie: (name: string, value: string) => cookies.push({ name, value }),
        clearCookie: vi.fn(),
      },
    } as any;

    const result = await accountRouter.createCaller(ctx).signup({
      name: "SDR de Teste",
      email: "sdr.teste@example.com",
      password: "SenhaForte.2026",
    });

    expect(result).toMatchObject({ id: 77, name: "SDR de Teste", email: "sdr.teste@example.com", role: "user" });
    expect(inserted).toMatchObject({ name: "SDR de Teste", email: "sdr.teste@example.com", role: "user", loginMethod: "password" });
    expect(inserted?.passwordHash).not.toBe("SenhaForte.2026");
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.value).toBeTruthy();
  });
});
