import { describe, expect, it, vi } from "vitest";

const { getDbMock, fetchBoardsMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  fetchBoardsMock: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./monday", () => ({ fetchBoards: fetchBoardsMock }));

import { lerSnapshots, sincronizarCliente } from "./sync";

describe("lerSnapshots", () => {
  it("lê os dados locais e informa boards ainda não sincronizados sem chamar o Monday", async () => {
    const syncedAt = new Date("2026-08-31T20:00:00.000Z");
    const rows = [
      {
        boardId: "101",
        payload: JSON.stringify({ leads: [{ id: "lead-1" }], atendimentos: [] }),
        syncedAt,
        lastError: null,
      },
    ];
    getDbMock.mockResolvedValue({
      select: () => ({ from: () => ({ where: async () => rows }) }),
    });

    const result = await lerSnapshots(["101", "202"]);

    expect(result.leads).toEqual([{ id: "lead-1" }]);
    expect(result.atualizadoEm).toEqual(syncedAt);
    expect(result.problemas).toEqual([{ boardId: "202", motivo: "Aguardando a primeira sincronização.", temDados: false }]);
    expect(fetchBoardsMock).not.toHaveBeenCalled();
  });
});

describe("sincronizarCliente", () => {
  it("para no primeiro board indisponível para não manter a SDR aguardando", async () => {
    getDbMock.mockResolvedValue({
      insert: () => ({
        values: () => ({ onDuplicateKeyUpdate: async () => undefined }),
      }),
    });
    fetchBoardsMock.mockResolvedValue({
      boards: [{ boardId: "101", boardName: "Agenda", leads: [], atendimentos: [] }],
      indisponiveis: [{ boardId: "101", motivo: "Limite de requisições do Monday atingido." }],
    });

    const result = await sincronizarCliente({ name: "Dra. Tatiana", boardId: "101,202,303" });

    expect(result).toEqual({ ok: 0, falhas: 1 });
    expect(fetchBoardsMock).toHaveBeenCalledTimes(1);
    expect(fetchBoardsMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "101" })],
      expect.objectContaining({
        force: true,
        maxAttempts: 1,
        requestTimeoutMs: 8_000,
        boardTimeoutMs: 12_000,
      }),
    );
  });
});
