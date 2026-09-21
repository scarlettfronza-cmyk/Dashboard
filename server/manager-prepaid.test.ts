import { describe, expect, it } from "vitest";
import { getNextPrePaidStatus } from "../client/src/lib/prePaid";

describe("seletor de conta pré-paga", () => {
  it("marca uma conta pós-paga como pré-paga", () => {
    expect(getNextPrePaidStatus(false)).toBe(true);
  });

  it("desmarca uma conta pré-paga", () => {
    expect(getNextPrePaidStatus(true)).toBe(false);
  });
});

