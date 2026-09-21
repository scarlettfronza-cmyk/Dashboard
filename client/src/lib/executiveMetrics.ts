export function calculateRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function calculateRevenueConcentration(consultas: number, fechamentos: number): number {
  const total = Math.max(0, consultas) + Math.max(0, fechamentos);
  return total > 0 ? (Math.max(0, fechamentos) / total) * 100 : 0;
}
