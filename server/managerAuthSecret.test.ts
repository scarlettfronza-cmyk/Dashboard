import { afterEach, describe, expect, it } from "vitest";
import { getManagerJwtSecret } from "./managerAuthSecret";

const originalSecret = process.env.MANAGER_JWT_SECRET;

afterEach(() => {
  process.env.MANAGER_JWT_SECRET = originalSecret;
});

describe("manager JWT secret", () => {
  it("uses a configured strong secret", () => {
    process.env.MANAGER_JWT_SECRET = "m".repeat(64);
    expect(getManagerJwtSecret()).toHaveLength(64);
  });

  it("fails closed instead of using a fallback secret", () => {
    delete process.env.MANAGER_JWT_SECRET;
    expect(() => getManagerJwtSecret()).toThrow("MANAGER_JWT_SECRET seguro é obrigatório");
  });
});
