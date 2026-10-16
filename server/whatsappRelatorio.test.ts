import { describe, it, expect } from "vitest";
import {
  zapVarsFaltando, formatarPeriodo, linkRelatorio, corpoPadrao,
  montarMensagemRelatorio, lerPeriodoDaUrl, ASSINATURA, PERGUNTAS, linhasMetricas,
} from "@shared/whatsappRelatorio";

describe("zapVarsFaltando", () => {
  it("lista o que falta, na ordem", () => {
    expect(zapVarsFaltando({ ZAPI_TOKEN: "x" })).toEqual(["ZAPI_INSTANCE_ID", "ZAPI_CLIENT_TOKEN"]);
  });
  it("valor só com espaço conta como ausente", () => {
    expect(zapVarsFaltando({ ZAPI_INSTANCE_ID: " ", ZAPI_TOKEN: "a", ZAPI_CLIENT_TOKEN: "b" })).toEqual(["ZAPI_INSTANCE_ID"]);
  });
  it("vazio quando tudo está preenchido", () => {
    expect(zapVarsFaltando({ ZAPI_INSTANCE_ID: "1", ZAPI_TOKEN: "2", ZAPI_CLIENT_TOKEN: "3" })).toEqual([]);
  });
});

describe("formatarPeriodo", () => {
  it("mesmo ano: dia/mês a dia/mês/ano", () => {
    expect(formatarPeriodo("2026-08-01", "2026-08-31")).toBe("01/08 a 31/08/2026");
  });
  it("anos diferentes: os dois por inteiro", () => {
    expect(formatarPeriodo("2025-12-01", "2026-01-31")).toBe("01/12/2025 a 31/01/2026");
  });
  it("não quebra com formato inesperado", () => {
    expect(formatarPeriodo("ontem", "hoje")).toBe("ontem a hoje");
  });
});

describe("linkRelatorio", () => {
  it("usa o token público e leva o período", () => {
    expect(linkRelatorio("https://x.com/", "abc123", "2026-08-01", "2026-08-31"))
      .toBe("https://x.com/r/abc123?de=2026-08-01&ate=2026-08-31");
  });
});

describe("mensagem", () => {
  const d = { clienteNome: "  DR MARIO BONGIOLO ", from: "2026-08-01", to: "2026-08-31" };
  it("corpo padrão cita o período, as perguntas e a assinatura — sem o nome do cliente", () => {
    const c = corpoPadrao(d);
    expect(c).not.toContain("MARIO");
    expect(c).toContain("01/08 a 31/08/2026");
    for (const p of PERGUNTAS) expect(c).toContain(p);
    expect(c.indexOf("Perguntinhas")).toBeLessThan(c.indexOf(ASSINATURA));
    expect(c.endsWith(ASSINATURA)).toBe(true);
  });
  it("mensagem completa termina com o link", () => {
    const m = montarMensagemRelatorio(d, "https://x.com/r/t");
    expect(m.startsWith(corpoPadrao(d))).toBe(true);
    expect(m.endsWith("\n\n🔗 https://x.com/r/t")).toBe(true);
  });
  it("texto editado substitui o corpo e mantém o link", () => {
    const m = montarMensagemRelatorio({ ...d, texto: "  Oi, segue! " }, "https://x.com/r/t");
    expect(m).toBe("Oi, segue!\n\n🔗 https://x.com/r/t");
  });
  it("texto só com espaços volta ao padrão", () => {
    expect(montarMensagemRelatorio({ ...d, texto: "   " }, "L")).toBe(`${corpoPadrao(d)}\n\n🔗 L`);
  });
});

describe("lerPeriodoDaUrl", () => {
  const hoje = new Date(2026, 8, 22);
  it("lê um período válido", () => {
    const p = lerPeriodoDaUrl("?de=2026-08-01&ate=2026-08-31", hoje)!;
    expect(p.from.getDate()).toBe(1); expect(p.from.getMonth()).toBe(7);
    expect(p.to.getDate()).toBe(31);
  });
  it("aceita sem o ponto de interrogação", () => {
    expect(lerPeriodoDaUrl("de=2026-08-01&ate=2026-08-31", hoje)).not.toBeNull();
  });
  it("recusa futuro, ordem invertida, formato errado e ausência", () => {
    expect(lerPeriodoDaUrl("?de=2026-09-01&ate=2026-09-30", hoje)).toBeNull();
    expect(lerPeriodoDaUrl("?de=2026-08-31&ate=2026-08-01", hoje)).toBeNull();
    expect(lerPeriodoDaUrl("?de=01/08/2026&ate=31/08/2026", hoje)).toBeNull();
    expect(lerPeriodoDaUrl("?de=2026-02-30&ate=2026-03-01", hoje)).toBeNull();
    expect(lerPeriodoDaUrl("", hoje)).toBeNull();
  });
  it("hoje é permitido como fim", () => {
    expect(lerPeriodoDaUrl("?de=2026-09-01&ate=2026-09-22", hoje)).not.toBeNull();
  });
});

describe("linhasMetricas e corpo com números", () => {
  const m = {
    investimento: 2919.01, leads: 246, custoPorLead: 11.87, vendas: 5, custoPorVenda: 583.8,
    faturamento: 4140, roas: 1.42, ticketMedio: 828, taxaConversao: 2.03, novosContatos: 205, novosSeguidores: 184,
  };
  it("uma linha por número, em português e na ordem do funil", () => {
    const l = linhasMetricas(m).map((x) => x.replace(/ /g, " "));
    expect(l).toEqual([
      "Investimento: R$ 2.919,01", "Leads: 246", "CPL: R$ 11,87", "Vendas: 5", "Custo por venda: R$ 583,80",
      "Faturamento: R$ 4.140,00", "ROAS: 1,42", "Ticket médio: R$ 828,00", "Taxa de conversão: 2,03%",
      "Novos contatos: 205", "Novos seguidores: 184",
    ]);
  });
  it("zero, ausente ou inválido fica de fora", () => {
    expect(linhasMetricas({ investimento: 0, leads: undefined, roas: NaN, novosSeguidores: 3 })).toEqual(["Novos seguidores: 3"]);
  });
  it("o corpo traz o resumo entre a saudação e as perguntas; sem métricas, nada muda", () => {
    const base = { from: "2026-10-01", to: "2026-10-16" };
    const c = corpoPadrao({ ...base, metricas: m });
    expect(c.indexOf("📊 *Resumo do período*")).toBeGreaterThan(c.indexOf("Olá!"));
    expect(c.indexOf("Leads: 246")).toBeLessThan(c.indexOf("Perguntinhas"));
    expect(corpoPadrao({ ...base, metricas: {} })).toBe(corpoPadrao(base));
    expect(corpoPadrao(base)).not.toContain("Resumo do período");
  });
});
