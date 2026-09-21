import { describe, expect, it } from "vitest";
import { buildBeforeAfterCreativePrompt } from "./beforeAfterCreative";

describe("prompt de estático de antes e depois", () => {
  it("exige preservar o resultado real e proíbe claims e texto", () => {
    const prompt = buildBeforeAfterCreativePrompt({
      title: "Planejamento da hairline", hook: "Linha frontal natural", angle: "Confiança", coreMessage: "Planejamento individual", visualDirection: "Comparação editorial", format: "Imagem 4:5",
    }, "4:5");
    expect(prompt).toContain("preserves the supplied before and after photos faithfully");
    expect(prompt).toContain("do not alter the medical or aesthetic result");
    expect(prompt).toContain("do not add readable text");
  });
});

