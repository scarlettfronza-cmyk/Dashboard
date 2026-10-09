import { describe, it, expect } from "vitest";
import { avaliarCliente, avaliarCarteira, acoesPorCampanha, resumoCarteira, semaforo, type ClienteCarteira, type Varredura } from "@shared/carteira";

const base = (over: Partial<ClienteCarteira> = {}): ClienteCarteira => ({
  id: 1, nome: "Cliente", temMeta: true, investimento: 1000, leads: 50, campanhas: [], ...over,
});

describe("avaliarCliente", () => {
  it("dentro da meta", () => {
    const a = avaliarCliente(base(), 20);
    expect(a.situacao).toBe("dentro"); expect(a.cpl).toBe(20); expect(a.desvio).toBe(0);
  });
  it("até 25% acima é atenção; além disso, acima", () => {
    expect(avaliarCliente(base({ leads: 42 }), 20).situacao).toBe("atencao"); // 23,81
    expect(avaliarCliente(base({ leads: 30 }), 20).situacao).toBe("acima");   // 33,33
  });
  it("gastou sem lead", () => {
    const a = avaliarCliente(base({ leads: 0 }), 20);
    expect(a.situacao).toBe("sem_leads"); expect(a.cpl).toBeNull();
  });
  it("sem investimento, sem Meta e erro não são julgados pelo CPL", () => {
    expect(avaliarCliente(base({ investimento: 0, leads: 0 }), 20).situacao).toBe("sem_investimento");
    expect(avaliarCliente(base({ temMeta: false }), 20).situacao).toBe("sem_meta");
    expect(avaliarCliente(base({ erro: "token inválido" }), 20).situacao).toBe("erro");
  });
  it("o resumo cita o CPL com vírgula e o desvio", () => {
    // toLocaleString usa espaço inseparável depois de "R$"
    const resumo = avaliarCliente(base({ leads: 30 }), 20).resumo.replace(/\u00a0/g, " ");
    expect(resumo).toContain("R$ 33,33");
    expect(resumo).toContain("67% acima");
  });
});

describe("acoesPorCampanha", () => {
  const camps = [
    { nome: "WPP Botox", tipo: "mensagens" as const, investimento: 600, leads: 12 },      // 50 → alta
    { nome: "Form Harmonização", tipo: "formulario" as const, investimento: 300, leads: 20 }, // 15 → boa
    { nome: "Direct", tipo: "mensagens" as const, investimento: 200, leads: 9 },          // 22,2 → media
    { nome: "Sem retorno", tipo: "mensagens" as const, investimento: 120, leads: 0 },     // alta
    { nome: "Vídeo institucional", tipo: "video" as const, investimento: 400, leads: 0 },  // ignorada
    { nome: "Teste 10 reais", tipo: "mensagens" as const, investimento: 10, leads: 0 },    // ruído
  ];
  it("julga só campanhas de lead com gasto relevante, da maior para a menor", () => {
    const a = acoesPorCampanha(camps, 20);
    expect(a.map((x) => x.campanha)).toEqual(["WPP Botox", "Form Harmonização", "Direct", "Sem retorno"]);
    expect(a.map((x) => x.gravidade)).toEqual(["alta", "boa", "media", "alta"]);
    expect(a[0].texto).toContain("150% acima");
    expect(a[3].texto).toContain("sem lead");
  });
});

describe("avaliarCarteira / resumoCarteira", () => {
  it("ordena do mais urgente ao mais tranquilo, e por CPL dentro do grupo", () => {
    const linhas = avaliarCarteira([
      base({ id: 1, nome: "Ok", leads: 100 }),
      base({ id: 2, nome: "Ruim", leads: 20 }),
      base({ id: 3, nome: "Pior", leads: 10 }),
      base({ id: 4, nome: "Zerado", leads: 0 }),
      base({ id: 5, nome: "Parado", investimento: 0, leads: 0 }),
    ], 20);
    expect(linhas.map((l) => l.nome)).toEqual(["Pior", "Ruim", "Zerado", "Ok", "Parado"]);
    expect(resumoCarteira(linhas)).toMatchObject({ acima: 2, sem_leads: 1, dentro: 1, sem_investimento: 1 });
  });
});

describe("semaforo (varredura matinal)", () => {
  const varredura = (over: Partial<Varredura> = {}): Varredura => ({
    gastoOntem: 50, gasto7: 350, gasto7Anteriores: 340, campanhasAtivas: 2, saldo: null, conta: { gravidade: "ok", rotulo: "Ativa" },
    decisoes: { pendente: 0, vencida: 0 }, ...over,
  });
  const linha = (c: Partial<ClienteCarteira> = {}, v?: Partial<Varredura>) =>
    avaliarCarteira([base({ ...c, varredura: varredura(v) })], 20)[0];

  it("tudo em ordem é verde, sem motivos", () => {
    expect(semaforo(linha())).toEqual({ cor: "verde", motivos: [] });
  });
  it("CPL estourado, conta crítica, saldo crítico, decisão vencida e gasto zerado são vermelhos", () => {
    expect(semaforo(linha({ leads: 30 })).cor).toBe("vermelho");
    expect(semaforo(linha({}, { conta: { gravidade: "critico", rotulo: "Pagamento pendente" } })).motivos).toContain("conta: pagamento pendente");
    expect(semaforo(linha({}, { saldo: 40 })).cor).toBe("vermelho");
    expect(semaforo(linha({}, { decisoes: { pendente: 1, vencida: 2 } })).motivos).toContain("2 decisões vencidas");
    expect(semaforo(linha({}, { gastoOntem: 0 })).motivos).toContain("não gastou ontem");
  });
  it("saldo baixo, queda de gasto e CPL perto do limite são amarelos", () => {
    expect(semaforo(linha({}, { saldo: 150 })).cor).toBe("amarelo");
    expect(semaforo(linha({}, { gasto7: 100, gasto7Anteriores: 300 })).motivos[0]).toContain("gasto caiu 67%");
    expect(semaforo(linha({ leads: 42 })).cor).toBe("amarelo");
  });
  it("vermelho acumula os motivos amarelos; sem investimento é cinza", () => {
    const s = semaforo(linha({}, { saldo: 40, gasto7: 100, gasto7Anteriores: 300 }));
    expect(s.cor).toBe("vermelho"); expect(s.motivos).toHaveLength(2);
    expect(semaforo(linha({ investimento: 0, leads: 0 }, { gastoOntem: 0, gasto7: 0, gasto7Anteriores: 0 })).cor).toBe("cinza");
  });
  it("sem varredura, só o CPL decide", () => {
    expect(semaforo(avaliarCarteira([base()], 20)[0]).cor).toBe("verde");
    expect(semaforo(avaliarCarteira([base({ leads: 30 })], 20)[0]).cor).toBe("vermelho");
  });
  it("ordena vermelhos antes dos verdes mesmo com CPL igual", () => {
    const ordem = avaliarCarteira([base({ id: 1 }), base({ id: 2, varredura: varredura({ saldo: 10 }) })], 20).map((l) => l.id);
    expect(ordem).toEqual([2, 1]);
  });
});
