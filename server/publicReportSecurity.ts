import crypto from "node:crypto";

export const PUBLIC_REPORT_TOKEN_PATTERN = /^[a-f0-9]{48,64}$/i;

export function isValidPublicReportToken(token: string) {
  return PUBLIC_REPORT_TOKEN_PATTERN.test(token);
}

export function fingerprintPublicReportToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
