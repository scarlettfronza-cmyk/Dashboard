import { describe, it, expect } from "vitest";
import { normalizarNumeroWhatsApp, formatarNumeroWhatsApp, ehGrupoWhatsApp } from "./alertas";

describe("normalizarNumeroWhatsApp", () => {
  it("aceita celular com DDD e coloca o 55", () => {
    expect(normalizarNumeroWhatsApp("(41) 99999-8888")).toBe("5541999998888");
    expect(normalizarNumeroWhatsApp("41 3333 4444")).toBe("554133334444");
  });
  it("mantém o 55 quando já vier", () => {
    expect(normalizarNumeroWhatsApp("+55 41 99999-8888")).toBe("5541999998888");
  });
  it("rejeita vazio e tamanho fora do padrão", () => {
    expect(normalizarNumeroWhatsApp("")).toBeNull();
    expect(normalizarNumeroWhatsApp("9999")).toBeNull();
    expect(normalizarNumeroWhatsApp("1234567890123456")).toBeNull();
  });
});

describe("formatarNumeroWhatsApp", () => {
  it("formata número brasileiro", () => {
    expect(formatarNumeroWhatsApp("5541999998888")).toBe("+55 (41) 99999-8888");
    expect(formatarNumeroWhatsApp("554133334444")).toBe("+55 (41) 3333-4444");
  });
  it("outro país sai só com o +", () => {
    expect(formatarNumeroWhatsApp("351912345678")).toBe("+351912345678");
  });
});

describe("ehGrupoWhatsApp", () => {
  it("ID de grupo tem algo além de dígitos; número de pessoa não", () => {
    expect(ehGrupoWhatsApp("120363019502650035-group")).toBe(true);
    expect(ehGrupoWhatsApp("5541999998888-1612345678@g.us")).toBe(true);
    expect(ehGrupoWhatsApp("5541999998888")).toBe(false);
    expect(ehGrupoWhatsApp("")).toBe(false);
    expect(ehGrupoWhatsApp(null)).toBe(false);
  });
});
