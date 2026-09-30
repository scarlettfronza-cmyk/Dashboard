import { describe, expect, it, vi } from "vitest";

const { fetchBoardsMock, invokeLLMMock, lerSnapshotsMock } = vi.hoisted(() => ({
  fetchBoardsMock: vi.fn(),
  invokeLLMMock: vi.fn(),
  lerSnapshotsMock: vi.fn(),
}));

const tableName = (table: object) => Object.getOwnPropertySymbols(table).find(symbol => symbol.toString() === "Symbol(drizzle:Name)");
const nameOf = (table: object) => String((table as Record<symbol, unknown>)[tableName(table)!]);

vi.mock("../db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: object) => ({
        where: () => ({
          limit: async () =>
            nameOf(table) === "sdrs"
              ? [{ id: 60001, userId: 9, name: "Luana", email: "luana@agencia.com", boardIds: "[]" }]
              : [{ id: 1, sdrId: 60001, name: "Dra Estéfani", boardId: "101", isActive: true }],
        }),
      }),
    }),
  }),
}));

vi.mock("../monday", () => ({
  fetchBoards: fetchBoardsMock,
  hasUnavailableBoards: (result: { indisponiveis: unknown[] }) => result.indisponiveis.length > 0,
  invalidateCache: vi.fn(),
}));

vi.mock("../_core/llm", () => ({ invokeLLM: invokeLLMMock }));

vi.mock("../sync", () => ({
  lerSnapshots: lerSnapshotsMock,
  sincronizarCliente: vi.fn(),
}));

import { sdrRouter } from "./sdr";

describe("sdr.generateAnalysis", () => {
  it("recusa gerar relatório quando algum board está indisponível", async () => {
    lerSnapshotsMock.mockResolvedValue({
      leads: [],
      atendimentos: [],
      problemas: [{ boardId: "101", motivo: "Aguardando a primeira sincronização.", temDados: false }],
      atualizadoEm: null,
    });

    const caller = sdrRouter.createCaller({
      user: { id: 9, openId: "local:luana", name: "Luana", email: "luana@agencia.com", role: "user" },
      req: { protocol: "https", headers: {} },
      res: { cookie: vi.fn(), clearCookie: vi.fn() },
    } as any);

    await expect(caller.generateAnalysis({ clientId: 1, range: null })).rejects.toThrow(/números incompletos/i);
    expect(invokeLLMMock).not.toHaveBeenCalled();
  });
});
