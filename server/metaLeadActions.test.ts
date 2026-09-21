import { describe, expect, it } from "vitest";
import {
  formLeadsFrom, messageLeadsFrom, reportedCostPer, blendCostPerLead,
  MSG_ACTION, FORM_ACTIONS, FORM_FALLBACK_ACTION,
} from "./metaLeadActions";

describe("leads de formulário do Meta", () => {
  it("soma formulário instantâneo e lead por pixel", () => {
    const actions = [
      { action_type: FORM_ACTIONS[0], value: "12" },
      { action_type: FORM_ACTIONS[1], value: "8" },
    ];
    expect(formLeadsFrom(actions)).toBe(20);
  });

  it("não conta duas vezes quando o Meta também manda o tipo agregado", () => {
    const actions = [
      { action_type: FORM_ACTIONS[0], value: "12" },
      { action_type: FORM_FALLBACK_ACTION, value: "12" },
    ];
    expect(formLeadsFrom(actions)).toBe(12);
  });

  it("usa o tipo agregado quando nenhum específico veio", () => {
    expect(formLeadsFrom([{ action_type: FORM_FALLBACK_ACTION, value: "7" }])).toBe(7);
  });

  it("devolve zero sem ações de lead", () => {
    expect(formLeadsFrom([{ action_type: "video_view", value: "900" }])).toBe(0);
    expect(formLeadsFrom(undefined)).toBe(0);
  });
});

describe("conversas iniciadas", () => {
  it("lê a ação de conversa iniciada", () => {
    expect(messageLeadsFrom([{ action_type: MSG_ACTION, value: "31" }])).toBe(31);
  });

  it("ignora campanha de formulário", () => {
    expect(messageLeadsFrom([{ action_type: FORM_ACTIONS[0], value: "31" }])).toBe(0);
  });
});

describe("custo por lead", () => {
  it("prefere o custo que o Meta informa", () => {
    const cpa = [{ action_type: FORM_ACTIONS[0], value: "4.25" }];
    expect(reportedCostPer(cpa, FORM_ACTIONS)).toBeCloseTo(4.25);
  });

  it("devolve null quando o Meta não informa, para quem chama decidir", () => {
    expect(reportedCostPer([{ action_type: "video_view", value: "1" }], FORM_ACTIONS)).toBeNull();
    expect(reportedCostPer(undefined, FORM_ACTIONS)).toBeNull();
  });

  it("faz média ponderada quando há custo informado", () => {
    // 10 leads a 5,00 e 30 leads a 1,00 -> 80/40 = 2,00
    expect(blendCostPerLead(10 * 5 + 30 * 1, 40, 500, 40)).toBeCloseTo(2);
  });

  it("cai para investimento dividido por leads sem custo informado", () => {
    expect(blendCostPerLead(0, 0, 900, 45)).toBeCloseTo(20);
  });

  it("não divide por zero", () => {
    expect(blendCostPerLead(0, 0, 900, 0)).toBe(0);
  });
});
