import { describe, expect, it } from "vitest";
import { canAccessClient } from "./routers/sdr";

describe("acesso a clientes", () => {
  it("permite que uma SDR acesse somente os próprios clientes", () => {
    expect(canAccessClient("user", 4, 4)).toBe(true);
    expect(canAccessClient("user", 4, 9)).toBe(false);
  });

  it("permite que a gestora acesse clientes de qualquer SDR", () => {
    expect(canAccessClient("admin", 4, 9)).toBe(true);
  });
});
