import { describe, expect, it } from "vitest";
import { buildCreativeVisualPrompt } from "./creativeVisuals";

describe("prompts visuais do Creative Agent", () => {
  it("preserva o conceito do brief e restringe texto e resultados enganosos", () => {
    const prompt = buildCreativeVisualPrompt({
      title: "Hairline natural", hook: "Linha frontal personalizada", angle: "Confiança", coreMessage: "Planejamento individual", visualDirection: "Profissional explicando o planejamento", format: "Vídeo vertical", targetAudience: "Adultos pesquisando transplante capilar",
    }, "4:5");
    expect(prompt).toContain("Linha frontal personalizada");
    expect(prompt).toContain("Do not render any text");
    expect(prompt).toContain("deceptive before-and-after");
  });
});

