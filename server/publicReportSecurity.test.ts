import { describe, expect, it } from "vitest";
import { fingerprintPublicReportToken, isValidPublicReportToken } from "./publicReportSecurity";

describe("public report token security", () => {
  const validToken = "a".repeat(64);

  it("accepts only long hexadecimal public tokens", () => {
    expect(isValidPublicReportToken(validToken)).toBe(true);
    expect(isValidPublicReportToken("b".repeat(48))).toBe(true);
    expect(isValidPublicReportToken("dra-tatiana")).toBe(false);
    expect(isValidPublicReportToken("a".repeat(47))).toBe(false);
  });

  it("creates a stable non-reversible fingerprint for audit records", () => {
    const fingerprint = fingerprintPublicReportToken(validToken);
    expect(fingerprint).toHaveLength(64);
    expect(fingerprint).not.toContain(validToken);
    expect(fingerprint).toBe(fingerprintPublicReportToken(validToken));
  });
});
