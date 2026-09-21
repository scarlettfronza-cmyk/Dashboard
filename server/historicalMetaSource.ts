export type HistoricalMetaSourceConfig = {
  source: "historical_meta_sheet";
  coverageStart: string;
  coverageEnd: string;
  label?: string;
};

type MediaLineage = {
  source: "meta_api" | "google_sheets" | "historical_meta_sheet" | "unavailable";
  label: string;
  coverageStart?: string;
  coverageEnd?: string;
};

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getHistoricalMetaSourceConfig(extraConfig: unknown): HistoricalMetaSourceConfig | null {
  if (!extraConfig || typeof extraConfig !== "object" || Array.isArray(extraConfig)) return null;
  const config = extraConfig as Partial<HistoricalMetaSourceConfig>;
  if (
    config.source !== "historical_meta_sheet" ||
    !isIsoDate(config.coverageStart) ||
    !isIsoDate(config.coverageEnd) ||
    config.coverageStart > config.coverageEnd
  ) {
    return null;
  }
  return {
    source: "historical_meta_sheet",
    coverageStart: config.coverageStart,
    coverageEnd: config.coverageEnd,
    label: typeof config.label === "string" && config.label.trim() ? config.label.trim() : "Conta Meta histórica importada",
  };
}

/**
 * Mantém o período histórico separado da API atual. Se a solicitação termina
 * no corte histórico, a planilha é a fonte prioritária, inclusive quando não
 * há linhas para um trecho anterior à cobertura. Assim, nunca misturamos uma
 * conta atual com a conta antiga sem uma decisão explícita da gestão.
 */
export function shouldUseHistoricalMetaSource(
  source: HistoricalMetaSourceConfig | null,
  to: string,
): boolean {
  return Boolean(source && isIsoDate(to) && to <= source.coverageEnd);
}

export function buildMediaLineage(
  source: HistoricalMetaSourceConfig | null,
  usingHistoricalSource: boolean,
  usingMetaApi: boolean,
  usingGoogleSheets: boolean,
): MediaLineage {
  if (usingHistoricalSource && source) {
    return {
      source: "historical_meta_sheet",
      label: source.label ?? "Conta Meta histórica importada",
      coverageStart: source.coverageStart,
      coverageEnd: source.coverageEnd,
    };
  }
  if (usingMetaApi) return { source: "meta_api", label: "Meta Ads API" };
  if (usingGoogleSheets) return { source: "google_sheets", label: "Planilha de mídia" };
  return { source: "unavailable", label: "Origem de mídia não disponível" };
}
