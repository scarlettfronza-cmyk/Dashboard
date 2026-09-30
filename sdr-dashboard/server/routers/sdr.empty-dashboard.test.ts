import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("../db", () => ({ getDb: getDbMock }));

import { sdrRouter } from "./sdr";

describe("sdr.clients", () => {
  beforeEach(() => getDbMock.mockReset());

  it("cria o perfil e retorna dashboard vazio até a gestora atribuir um cliente", async () => {
    let selectCall = 0;
    let insertedProfile: Record<string, unknown> | undefined;
    const results = [
      [],
      [{ id: 71, userId: 44, name: "Nova SDR", email: "nova.sdr@example.com", boardIds: "[]" }],
      [],
    ];
    const makeQuery = (rows: unknown[]) => ({
      limit: async () => rows,
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
    });
    const db = {
      select: () => {
        const rows = results[selectCall++] ?? [];
        return { from: () => ({ where: () => makeQuery(rows) }) };
      },
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedProfile = values;
          return { onDuplicateKeyUpdate: async () => undefined };
        },
      }),
    };
    getDbMock.mockResolvedValue(db);

    const ctx = {
      user: { id: 44, openId: "local:new-sdr", name: "Nova SDR", email: "nova.sdr@example.com", role: "user" },
      req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
      res: { cookie: vi.fn(), clearCookie: vi.fn() },
    } as any;

    const clients = await sdrRouter.createCaller(ctx).clients();

    expect(insertedProfile).toMatchObject({ userId: 44, name: "Nova SDR", boardIds: "[]" });
    expect(clients).toEqual([]);
  });
});
