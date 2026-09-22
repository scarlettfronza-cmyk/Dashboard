import { describe, it, expect } from "vitest";
import {
  zapVarsFaltando, formatarPeriodo, linkRelatorio, corpoPadrao,
  montarMensagemRelatorio, lerPeriodoDaUrl, ASSINATURA, nomeArquivoPdf,
} from "@shared/whatsappRelatorio";

describe("nomeArquivoPdf", () => {
  it("tira acentos e símbolos, mantém o período", () => {
    expect(nomeArquivoPdf("Dra. Verônica Vanolli ", "2026-08-01", "2026-08-31"))
      .toBe("Relatorio-DRA-VERONICA-VANOLLI-2026-08-01-a-2026-08-31.pdf");
  });
  it("nome vazio não gera arquivo sem nome", () => {
    expect(nomeArquivoPdf("***", "2026-08-01", "2026-08-31")).toBe("Relatorio-CLIENTE-2026-08-01-a-2026-08-31.pdf");
  });
});

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
  it("corpo padrão cita o cliente, o período e a assinatura", () => {
    const c = corpoPadrao(d);
    expect(c).toContain("*DR MARIO BONGIOLO*");
    expect(c).toContain("01/08 a 31/08/2026");
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
