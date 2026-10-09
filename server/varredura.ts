/**
 * Varredura matinal: a parte pura que transforma gasto diário, saldo e
 * status da conta no resumo que a Carteira pinta de cor.
 */
import type { GastoDiario } from "./metaApi";
import type { Varredura } from "@shared/carteira";

export const isoDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function diasAtras(n: number, hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
  return isoDia(d);
}

/** Janela da varredura: 14 dias terminando ontem. */
export function janelaVarredura(hoje = new Date()): { since: string; until: string } {
  return { since: diasAtras(14, hoje), until: diasAtras(1, hoje) };
}

export function resumirGasto(linhas: GastoDiario[], hoje = new Date()): Pick<Varredura, "gastoOntem" | "gasto7" | "gasto7Anteriores" | "campanhasAtivas"> {
  const ontem = diasAtras(1, hoje);
  const inicio7 = diasAtras(7, hoje);
  const inicio14 = diasAtras(14, hoje);
  let gastoOntem = 0, gasto7 = 0, gasto7Anteriores = 0;
  const ativas = new Set<string>();
  for (const l of linhas) {
    if (l.gasto <= 0) continue;
    if (l.data === ontem) { gastoOntem += l.gasto; ativas.add(l.campanha); }
    if (l.data >= inicio7 && l.data <= ontem) gasto7 += l.gasto;
    else if (l.data >= inicio14 && l.data < inicio7) gasto7Anteriores += l.gasto;
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { gastoOntem: r2(gastoOntem), gasto7: r2(gasto7), gasto7Anteriores: r2(gasto7Anteriores), campanhasAtivas: ativas.size };
}
