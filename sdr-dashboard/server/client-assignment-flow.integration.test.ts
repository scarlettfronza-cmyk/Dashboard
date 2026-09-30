import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sdrs: [
    { id: 101, userId: 11, name: "SDR A", email: "a@agencia.com", boardIds: "[]" },
    { id: 202, userId: 22, name: "SDR B", email: "b@agencia.com", boardIds: "[]" },
  ] as Array<{ id: number; userId: number; name: string; email: string; boardIds: string }>,
  clients: [] as Array<Record<string, unknown>>,
  currentUserId: null as number | null,
  nextSdrId: null as number | null,
  nextClientId: 1,
}));

const thenable = <T,>(value: T) => ({ then: <R>(resolve: (result: T) => R) => Promise.resolve(resolve(value)) });
const tableName = (table: object) => Object.getOwnPropertySymbols(table).find(symbol => symbol.toString() === "Symbol(drizzle:Name)");
const nameOf = (table: object) => String((table as Record<symbol, unknown>)[tableName(table)!]);

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: object) => {
        const name = nameOf(table);
        if (name === "sdrs") {
          return {
            where: () => ({
              limit: async () => {
                if (state.currentUserId !== null) return state.sdrs.filter(sdr => sdr.userId === state.currentUserId);
                return state.sdrs.filter(sdr => sdr.id === state.nextSdrId);
              },
            }),
          };
        }
        if (name === "clients") {
          return {
            then: thenable(state.clients).then,
            where: () => ({
              then: thenable(state.clients.filter(client => client.sdrId === state.sdrs.find(sdr => sdr.userId === state.currentUserId)?.id)).then,
              limit: async () => state.clients.filter(client => client.id === state.nextClientId - 1),
            }),
          };
        }
        return { where: () => ({ limit: async () => [] }), then: thenable([]).then };
      },
    }),
    insert: (table: object) => ({
      values: async (values: Record<string, unknown>) => {
        if (nameOf(table) === "clients") state.clients.push({ id: state.nextClientId++, ...values });
        return [];
      },
    }),
    update: (table: object) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          if (nameOf(table) === "clients") {
            const client = state.clients.find(item => item.id === state.nextClientId - 1);
            if (client) Object.assign(client, values);
          }
          return [];
        },
      }),
    }),
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(id: number, role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id,
      openId: `user-${id}`,
      name: `Usuária ${id}`,
      email: `u${id}@agencia.com`,
      loginMethod: "email",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("admin.assignClient → admin.reassignClient → sdr.clients", () => {
  it("atribui à SDR A, transfere para SDR B e preserva a visibilidade correta", async () => {
    state.clients = [];
    state.currentUserId = null;
    state.nextClientId = 1;

    const admin = appRouter.createCaller(context(999, "admin"));
    state.nextSdrId = 101;
    const created = await admin.admin.assignClient({
      sdrId: 101,
      name: "Dra Tatiana Patruni",
      boardIds: ["18406678106", "18406678019"],
    });
    expect(created?.sdrId).toBe(101);

    state.currentUserId = 11;
    expect((await appRouter.createCaller(context(11, "user")).sdr.clients()).map(client => client.id)).toEqual([created?.id]);
    state.currentUserId = 22;
    expect(await appRouter.createCaller(context(22, "user")).sdr.clients()).toEqual([]);

    state.currentUserId = null;
    state.nextSdrId = 202;
    await admin.admin.reassignClient({ clientId: created!.id, sdrId: 202 });

    state.currentUserId = 11;
    expect(await appRouter.createCaller(context(11, "user")).sdr.clients()).toEqual([]);
    state.currentUserId = 22;
    expect((await appRouter.createCaller(context(22, "user")).sdr.clients()).map(client => client.id)).toEqual([created?.id]);
  });
});
