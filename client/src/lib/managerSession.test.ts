import { describe, expect, it, vi } from "vitest";
import { clearManagerSession, getManagerEntryPath, isManagerPath } from "./managerSession";

describe("sessão de gestor", () => {
  it("direciona a entrada /manager para login ou dashboard conforme a sessão local", () => {
    expect(getManagerEntryPath(false)).toBe("/manager/login");
    expect(getManagerEntryPath(true)).toBe("/manager/dashboard");
  });

  it("reconhece as rotas de gestor, incluindo a entrada sem barra final", () => {
    expect(isManagerPath("/manager")).toBe(true);
    expect(isManagerPath("/manager/dashboard")).toBe(true);
    expect(isManagerPath("/dashboard")).toBe(false);
  });

  it("remove todos os dados locais ao invalidar a sessão", () => {
    const removeItem = vi.fn();
    clearManagerSession({ removeItem });
    expect(removeItem).toHaveBeenCalledTimes(3);
    expect(removeItem).toHaveBeenCalledWith("manager_token");
    expect(removeItem).toHaveBeenCalledWith("manager_name");
    expect(removeItem).toHaveBeenCalledWith("manager_email");
  });
});
