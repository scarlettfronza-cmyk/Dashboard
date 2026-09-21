/**
 * Períodos pré-definidos do relatório.
 *
 * Os presets originais terminavam todos no dia de hoje, o que não cobre o uso
 * mais comum: o relatório mensal fechado, que vai do primeiro ao último dia do
 * mês anterior. Faltavam também as janelas longas, necessárias para ler
 * tendência em vez de um retrato.
 *
 * A montagem fica separada da tela para poder ser testada: erro de virada de
 * mês ou de ano aqui produz um relatório com o período errado, e ninguém
 * percebe olhando.
 */

export type Periodo = { from: Date; to: Date };

export type PresetId =
  | "today" | "7d" | "30d" | "month" | "lastMonth" | "3m" | "6m" | "12m";

export const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "lastMonth", label: "Mês passado" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "12m", label: "12 meses" },
];

const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const somaDias = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Primeiro dia do mês, deslocado em `n` meses. */
function inicioDoMes(d: Date, n = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Último dia do mês, deslocado em `n` meses. O dia 0 é o último do anterior. */
function fimDoMes(d: Date, n = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + n + 1, 0);
}

export function resolvePreset(id: PresetId, hoje: Date): Periodo {
  const h = dia(hoje);
  switch (id) {
    case "today":
      return { from: h, to: h };
    case "7d":
      return { from: somaDias(h, -6), to: h };
    case "30d":
      return { from: somaDias(h, -29), to: h };
    case "month":
      return { from: inicioDoMes(h), to: h };
    case "lastMonth":
      // Mês civil completo: do dia 1 ao último dia do mês anterior.
      return { from: inicioDoMes(h, -1), to: fimDoMes(h, -1) };
    case "3m":
      return { from: inicioDoMes(h, -2), to: h };
    case "6m":
      return { from: inicioDoMes(h, -5), to: h };
    case "12m":
      return { from: inicioDoMes(h, -11), to: h };
  }
}
