import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBoards, invalidateCache } from "./monday";

const boardResponse = (name = "Board de teste") =>
  new Response(
    JSON.stringify({
      data: {
        boards: [{ name, columns: [], items_page: { cursor: null, items: [] } }],
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

describe("controle de requisições do Monday", () => {
  beforeEach(() => invalidateCache());
  afterEach(() => vi.unstubAllGlobals());

  it("tenta novamente quando o Monday responde 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: "rate limit" }] }), { status: 429, headers: { "retry-after": "0.001" } }))
      .mockResolvedValueOnce(boardResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBoards([{ id: "101", clientName: "Dra Teste" }], { force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.indisponiveis).toEqual([]);
    expect(result.boards[0]?.boardName).toBe("Board de teste");
  });

  it("permite ao job periódico limitar a uma tentativa quando o Monday responde 429", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "rate limit" }] }), { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBoards(
      [{ id: "102", clientName: "Dra Job" }],
      { force: true, maxAttempts: 1, requestTimeoutMs: 1_000, boardTimeoutMs: 5_000 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.indisponiveis).toMatchObject([{ boardId: "102", kind: "rate_limit", usouCache: false }]);
  });

  it("busca múltiplos boards sem chamadas simultâneas", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight -= 1;
      return boardResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBoards(
      [
        { id: "201", clientName: "Dra A" },
        { id: "202", clientName: "Dra B" },
      ],
      { force: true },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
    expect(result.boards).toHaveLength(2);
    expect(result.indisponiveis).toEqual([]);
  });

  it("mantém os dados em cache quando uma atualização recebe limite 429", async () => {
    const firstFetch = vi.fn().mockResolvedValue(boardResponse("Board em cache"));
    vi.stubGlobal("fetch", firstFetch);
    await fetchBoards([{ id: "303", clientName: "Dra Cache" }], { force: true });

    const limitedFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "rate limit" }] }), { status: 429, headers: { "retry-after": "0.001" } }),
    );
    vi.stubGlobal("fetch", limitedFetch);
    const result = await fetchBoards([{ id: "303", clientName: "Dra Cache" }], { force: true });

    expect(limitedFetch).toHaveBeenCalledTimes(3);
    expect(result.boards[0]?.boardName).toBe("Board em cache");
    expect(result.indisponiveis).toMatchObject([{ boardId: "303", kind: "rate_limit", usouCache: true }]);
  });
});
