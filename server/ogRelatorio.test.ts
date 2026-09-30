import { describe, it, expect } from "vitest";
import { injetarOg, textosOg } from "./ogRelatorio";

describe("textosOg", () => {
  it("com cliente e período", () => {
    const t = textosOg(" DR MARIO BONGIOLO ", "2026-09-01", "2026-09-30");
    expect(t.title).toBe("Relatório de performance · DR MARIO BONGIOLO");
    expect(t.description).toContain("01/09 a 30/09/2026");
    expect(t.description).toContain("Digital Escarlate");
  });
  it("sem cliente: cartão genérico, sem vazar nada", () => {
    expect(textosOg(null).title).toBe("Relatório de performance");
  });
});

describe("injetarOg", () => {
  const html = "<html><head><title>ADS</title></head><body></body></html>";
  it("troca o título, insere as tags e escapa aspas", () => {
    const out = injetarOg(html, { title: 'Relatório "X"', description: "d", image: "https://x/og.png", url: "https://x/r/t" });
    expect(out).toContain('<title>Relatório &quot;X&quot;</title>');
    expect(out).toContain('<meta property="og:image" content="https://x/og.png" />');
    expect(out).toContain('<meta property="og:title" content="Relatório &quot;X&quot;" />');
    expect(out.indexOf("og:title")).toBeLessThan(out.indexOf("</head>"));
  });
});
