import { describe, expect, it } from "vitest";
import { shouldRedirectToEntrar } from "./sessionRedirect";

describe("redirecionamento da sessão local", () => {
  it("não redireciona enquanto a autenticação ainda está carregando", () => {
    expect(shouldRedirectToEntrar(false, false)).toBe(false);
  });

  it("redireciona apenas depois que auth.me confirma que não há sessão", () => {
    expect(shouldRedirectToEntrar(true, false)).toBe(true);
    expect(shouldRedirectToEntrar(true, true)).toBe(false);
  });
});
