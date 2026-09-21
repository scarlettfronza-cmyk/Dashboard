export type RankingDateRange = { from: string; to: string };

export function normalizeRankingDateRange(from: string, to: string): RankingDateRange | null {
  if (!from || !to) return null;
  return from <= to ? { from, to } : { from: to, to: from };
}
