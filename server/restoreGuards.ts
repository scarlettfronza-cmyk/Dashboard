/**
 * Regras de proteção da importação de banco pela web.
 *
 * Uma rota que executa SQL enviado pelo navegador é perigosa por natureza, e
 * este sistema já sofreu um vazamento de credenciais. As travas ficam aqui,
 * separadas do transporte, para poderem ser testadas sem servidor e sem banco:
 *
 *  1. desligada por padrão — só existe se RESTORE_TOKEN estiver definida;
 *  2. exige a senha, comparada em tempo constante;
 *  3. recusa banco que já tenha dados, para não sobrescrever nada.
 *
 * Terminada a importação, a variável deve ser removida do ambiente: sem ela a
 * rota deixa de existir.
 */
import crypto from "node:crypto";

export type Recusa =
  | { ok: false; motivo: "desativado" | "senha_ausente" | "senha_invalida" | "banco_com_dados" | "arquivo_vazio" | "senha_fraca"; detalhe: string };
export type Resultado = { ok: true } | Recusa;

/** Mínimo para que a senha não seja adivinhável por tentativa. */
export const TAMANHO_MINIMO_SENHA = 16;

export function importacaoHabilitada(env: NodeJS.ProcessEnv): boolean {
  const t = env.RESTORE_TOKEN;
  return typeof t === "string" && t.length >= TAMANHO_MINIMO_SENHA;
}

/** Comparação em tempo constante: evita descobrir a senha medindo a resposta. */
function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function autorizar(env: NodeJS.ProcessEnv, enviada: unknown): Resultado {
  const esperada = env.RESTORE_TOKEN;

  if (typeof esperada !== "string" || esperada.length === 0) {
    return { ok: false, motivo: "desativado", detalhe: "A importação não está habilitada neste ambiente." };
  }
  if (esperada.length < TAMANHO_MINIMO_SENHA) {
    return {
      ok: false, motivo: "senha_fraca",
      detalhe: `A senha de importação precisa de ao menos ${TAMANHO_MINIMO_SENHA} caracteres.`,
    };
  }
  if (typeof enviada !== "string" || enviada.length === 0) {
    return { ok: false, motivo: "senha_ausente", detalhe: "Informe a senha de importação." };
  }
  if (!iguais(enviada, esperada)) {
    return { ok: false, motivo: "senha_invalida", detalhe: "Senha de importação incorreta." };
  }
  return { ok: true };
}

/** O banco só pode receber a carga se estiver vazio. */
export function bancoAceitaCarga(tabelasComDados: number): Resultado {
  if (tabelasComDados > 0) {
    return {
      ok: false, motivo: "banco_com_dados",
      detalhe: `O banco já tem ${tabelasComDados} tabela(s) com registros. A importação foi cancelada para não sobrescrever dados.`,
    };
  }
  return { ok: true };
}

export function arquivoUtilizavel(sql: unknown): Resultado {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    return { ok: false, motivo: "arquivo_vazio", detalhe: "O arquivo enviado está vazio." };
  }
  return { ok: true };
}
