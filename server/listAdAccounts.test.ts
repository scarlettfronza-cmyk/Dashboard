import { describe, expect, it, vi, beforeEach } from "vitest";

const chamadas: Array<{ url: string; params?: Record<string, unknown> }> = [];
let paginas: Array<{ data: Array<{ id: string; name: string; currency: string }>; paging?: { next?: string } }> = [];

vi.mock("axios", () => ({
  default: {
    get: async (url: string, cfg?: { params?: Record<string, unknown> }) => {
      chamadas.push({ url, params: cfg?.params });
      const p = paginas.shift();
      return { data: p ?? { data: [] } };
    },
  },
}));

const { listAdAccounts } = await import("./metaApi");

const conta = (i: number) => ({ id: `act_${i}`, name: `Conta ${i}`, currency: "BRL" });

describe("listagem de contas de anúncio", () => {
  beforeEach(() => { chamadas.length = 0; paginas = []; });

  it("junta todas as páginas, não só a primeira", async () => {
    paginas = [
      { data: [conta(1), conta(2)], paging: { next: "https://graph/next-1" } },
      { data: [conta(3)], paging: { next: "https://graph/next-2" } },
      { data: [conta(4)] },
    ];
    const r = await listAdAccounts("TOKEN");
    expect(r.map((c) => c.id)).toEqual(["act_1", "act_2", "act_3", "act_4"]);
    expect(chamadas).toHaveLength(3);
  });

  it("encontra a conta que ficava fora da primeira página", async () => {
    paginas = [
      { data: Array.from({ length: 50 }, (_, i) => conta(i)), paging: { next: "https://graph/p2" } },
      { data: [{ id: "act_1625411728898223", name: "MARIO B. CA 01", currency: "BRL" }] },
    ];
    const r = await listAdAccounts("TOKEN");
    expect(r.find((c) => c.id === "act_1625411728898223")).toBeTruthy();
  });

  it("não repassa params na página seguinte, que já vem com cursor", async () => {
    paginas = [
      { data: [conta(1)], paging: { next: "https://graph/next" } },
      { data: [conta(2)] },
    ];
    await listAdAccounts("TOKEN");
    expect(chamadas[0].params).toMatchObject({ access_token: "TOKEN" });
    expect(chamadas[1].params).toBeUndefined();
    expect(chamadas[1].url).toBe("https://graph/next");
  });

  it("para quando não há próxima página", async () => {
    paginas = [{ data: [conta(1)] }];
    expect(await listAdAccounts("TOKEN")).toHaveLength(1);
    expect(chamadas).toHaveLength(1);
  });

  it("não entra em laço infinito se a API sempre devolver next", async () => {
    paginas = Array.from({ length: 100 }, () => ({ data: [conta(1)], paging: { next: "https://graph/sempre" } }));
    await listAdAccounts("TOKEN");
    expect(chamadas.length).toBeLessThanOrEqual(20);
  });

  it("devolve lista vazia sem contas", async () => {
    paginas = [{ data: [] }];
    expect(await listAdAccounts("TOKEN")).toEqual([]);
  });
});
