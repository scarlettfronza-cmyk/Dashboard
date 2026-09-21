import { describe, expect, it } from "vitest";
import {
  autorizar, bancoAceitaCarga, arquivoUtilizavel, importacaoHabilitada,
  TAMANHO_MINIMO_SENHA,
} from "./restoreGuards";

const SENHA = "x".repeat(TAMANHO_MINIMO_SENHA);

describe("proteção da importação", () => {
  it("fica desligada quando a senha não está definida", () => {
    expect(importacaoHabilitada({} as NodeJS.ProcessEnv)).toBe(false);
    const r = autorizar({} as NodeJS.ProcessEnv, SENHA);
    expect(r).toMatchObject({ ok: false, motivo: "desativado" });
  });

  it("fica desligada com senha curta demais", () => {
    const env = { RESTORE_TOKEN: "curta" } as unknown as NodeJS.ProcessEnv;
    expect(importacaoHabilitada(env)).toBe(false);
    expect(autorizar(env, "curta")).toMatchObject({ ok: false, motivo: "senha_fraca" });
  });

  it("recusa sem senha enviada", () => {
    const env = { RESTORE_TOKEN: SENHA } as unknown as NodeJS.ProcessEnv;
    expect(autorizar(env, "")).toMatchObject({ ok: false, motivo: "senha_ausente" });
    expect(autorizar(env, undefined)).toMatchObject({ ok: false, motivo: "senha_ausente" });
  });

  it("recusa senha errada, inclusive de tamanho diferente", () => {
    const env = { RESTORE_TOKEN: SENHA } as unknown as NodeJS.ProcessEnv;
    expect(autorizar(env, "y".repeat(TAMANHO_MINIMO_SENHA))).toMatchObject({ ok: false, motivo: "senha_invalida" });
    expect(autorizar(env, SENHA + "a")).toMatchObject({ ok: false, motivo: "senha_invalida" });
  });

  it("aceita a senha correta", () => {
    const env = { RESTORE_TOKEN: SENHA } as unknown as NodeJS.ProcessEnv;
    expect(autorizar(env, SENHA)).toEqual({ ok: true });
  });

  it("recusa banco que já tem dados", () => {
    expect(bancoAceitaCarga(3)).toMatchObject({ ok: false, motivo: "banco_com_dados" });
  });

  it("aceita banco vazio", () => {
    expect(bancoAceitaCarga(0)).toEqual({ ok: true });
  });

  it("recusa arquivo vazio ou em branco", () => {
    expect(arquivoUtilizavel("")).toMatchObject({ ok: false, motivo: "arquivo_vazio" });
    expect(arquivoUtilizavel("   \n ")).toMatchObject({ ok: false, motivo: "arquivo_vazio" });
    expect(arquivoUtilizavel(null)).toMatchObject({ ok: false, motivo: "arquivo_vazio" });
  });

  it("aceita arquivo com conteúdo", () => {
    expect(arquivoUtilizavel("CREATE TABLE a (id int);")).toEqual({ ok: true });
  });
});
