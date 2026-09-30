import { describe, expect, it } from "vitest";
import { injetarOg, textosOg } from "./ogPortal";

describe("prévia do link do portal", () => {
  it("usa o nome da clínica no título", () => {
    expect(textosOg("Dra. Tatiana").title).toBe("Relatório comercial · Dra. Tatiana");
    expect(textosOg(null).title).toBe("Relatório comercial");
  });

  it("injeta as tags e escapa o conteúdo", () => {
    const html = "<html><head><title>X</title></head><body></body></html>";
    const out = injetarOg(html, { title: 'A "B" <c>', description: "d", image: "https://x/og.png", url: "https://x/portal/t" });
    expect(out).toContain("<title>A &quot;B&quot; &lt;c&gt;</title>");
    expect(out).toContain('<meta property="og:image" content="https://x/og.png" />');
    expect(out.indexOf("og:title")).toBeLessThan(out.indexOf("</head>"));
  });
});
