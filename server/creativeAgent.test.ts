import { describe, expect, it } from "vitest";
import { buildCreativeBriefPrompt, fallbackCreativeBriefs } from "./creativeAgent";

const context = { name: "Neo Hair", leadChannel: "whatsapp", campaignTypes: "[\"lead\"]", mappingNotes: "Atendimento em consulta particular", targetCpl: 30 };
const source = [{ id: 10, adName: "Criativo referência", format: "video", hook: "Transformação visual", angle: "Confiança", callToAction: "Saiba mais", testHypothesis: "Variar a prova", metrics: { ctr: 1.2, leads: 30, cpl: 20 } }];

describe("Creative Agent", () => {
  it("inclui o contexto do cliente e as referências no prompt", () => {
    const prompt = buildCreativeBriefPrompt(context, source);
    expect(prompt).toContain("Neo Hair");
    expect(prompt).toContain("Transformação visual");
    expect(prompt).toContain("exatamente 3 briefs");
  });

  it("cria três briefs de fallback com uma variável por teste", () => {
    const briefs = fallbackCreativeBriefs(context, source);
    expect(briefs).toHaveLength(3);
    expect(briefs.map((brief) => brief.variableToTest)).toEqual([
      "gancho dos primeiros 3 segundos",
      "tipo de prova apresentada",
      "porta-voz e estrutura do roteiro",
    ]);
  });
});

