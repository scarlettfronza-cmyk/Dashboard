import { describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { clients, sdrs, users } from "../drizzle/schema";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";
import { accountRouter } from "./routers/account";
import { sdrRouter } from "./routers/sdr";
import { hashPassword, LOCAL_SESSION_COOKIE } from "./password";

function query<T>(rows: T[]) {
  return {
    limit: async () => rows,
    then: (resolve: (value: T[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
  };
}

describe("fluxo de sessão local da SDR", () => {
  it("mantém a SDR autenticada entre o login e a consulta protegida do dashboard", async () => {
    const passwordHash = await hashPassword("SenhaSegura.2026");
    const localSdr = {
      id: 91,
      openId: "local:luana",
      name: "Luana",
      email: "luana@example.com",
      passwordHash,
      loginMethod: "password",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const profile = { id: 15, userId: 91, name: "Luana", email: "luana@example.com", boardIds: "[]" };
    const db = {
      select: () => ({
        from: (table: unknown) => {
          if (table === users) return { where: () => query([localSdr]) };
          if (table === sdrs) return { where: () => query([profile]) };
          if (table === clients) return { where: () => query([]) };
          return { where: () => query([]) };
        },
      }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    getDbMock.mockResolvedValue(db);

    const emittedCookies: Array<{ name: string; value: string }> = [];
    const loginContext = {
      user: null,
      req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
      res: {
        cookie: (name: string, value: string) => emittedCookies.push({ name, value }),
        clearCookie: vi.fn(),
      },
    } as any;

    await accountRouter.createCaller(loginContext).login({ email: "luana@example.com", password: "SenhaSegura.2026" });
    const session = emittedCookies.find(cookie => cookie.name === LOCAL_SESSION_COOKIE);
    expect(session?.value).toBeTruthy();

    const protectedContext = await createContext({
      req: { headers: { cookie: `${LOCAL_SESSION_COOKIE}=${encodeURIComponent(session!.value)}` } } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    });

    await expect(appRouter.createCaller(protectedContext).auth.me()).resolves.toMatchObject({ id: 91, role: "user" });
    await expect(sdrRouter.createCaller(protectedContext).clients()).resolves.toEqual([]);
  });
});
