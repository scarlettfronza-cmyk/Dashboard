import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { InstagramProfile } from "@/components/report/InstagramProfile";
import { TopContent } from "@/components/report/TopContent";
import { Trafego, Perfil, Comercial } from "@/components/report/ResultsMetrics";
import { PRESETS, resolvePreset, type PresetId } from "@/lib/periodPresets";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTHS_CAL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ─── Theme tokens ─────────────────────────────────────────────────────────────────────────────
const DARK_THEME = {
  bg: "oklch(0.06 0.005 20)",
  bgCard: "oklch(0.10 0.006 20)",
  bgHeader: "oklch(0.08 0.006 20)",
  bgBorder: "oklch(0.15 0.008 20)",
  bgHover: "oklch(0.13 0.007 20)",
  bgInput: "oklch(0.12 0.006 20)",
  textPrimary: "oklch(0.95 0.005 60)",
  textSecondary: "oklch(0.75 0.010 60)",
  textMuted: "oklch(0.50 0.010 60)",
  accent: "oklch(0.55 0.22 25)",
  accentHex: "#e63946",
  accentBg: "oklch(0.18 0.08 25)",
  gridColor: "oklch(0.18 0.008 20)",
  axisColor: "oklch(0.45 0.010 60)",
  tooltipBg: "oklch(0.10 0.006 20)",
  tooltipBorder: "oklch(0.55 0.22 25 / 0.30)",
  kpiGrad: "linear-gradient(135deg, oklch(0.22 0.10 25), oklch(0.16 0.06 25))",
  kpiGrad2: "linear-gradient(135deg, oklch(0.20 0.08 25), oklch(0.14 0.05 25))",
  badgeBg: "oklch(0.18 0.08 25)",
  badgeText: "oklch(0.75 0.18 25)",
};
const LIGHT_THEME = {
  bg: "#f1f5f9",
  bgCard: "#ffffff",
  bgHeader: "#ffffff",
  bgBorder: "#e2e8f0",
  bgHover: "#f8fafc",
  bgInput: "#f8fafc",
  textPrimary: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  accent: "#6366f1",
  accentHex: "#6366f1",
  accentBg: "#eef2ff",
  gridColor: "#e2e8f0",
  axisColor: "#94a3b8",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e8f0",
  kpiGrad: "linear-gradient(135deg, #6366f1, #4f46e5)",
  kpiGrad2: "linear-gradient(135deg, #10b981, #059669)",
  badgeBg: "#eef2ff",
  badgeText: "#4f46e5",
};
type ReportTheme = typeof DARK_THEME;

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, prefix = "") {
  if (n == null || isNaN(n as number)) return "—";
  if (prefix === "R$") return `R$ ${(n as number).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (n as number).toLocaleString("pt-BR");
}

// ─── KPI Card (light) ─────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, gradient, icon, t }: {
  label: string; value: string; sub?: string; gradient?: string; icon?: string; t?: ReportTheme;
}) {
  if (gradient) {
    return (
      <div className="rounded-2xl p-4 flex flex-col gap-1 text-white" style={{ background: gradient }}>
        {icon && <span className="text-2xl mb-0.5">{icon}</span>}
        <p className="text-[10px] uppercase tracking-widest font-semibold opacity-80">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>}
      </div>
    );
  }
  const theme = t ?? DARK_THEME;
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
      {icon && <span className="text-xl mb-0.5">{icon}</span>}
      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: theme.textMuted }}>{label}</p>
      <p className="text-2xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: theme.textMuted }}>{sub}</p>}
    </div>
  );
}

function SmallKpi({ label, value, accent, t }: { label: string; value: string; accent?: string; t?: ReportTheme }) {
  const theme = t ?? DARK_THEME;
  return (
    <div className="rounded-xl p-3 flex flex-col gap-0.5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
      <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: theme.textMuted }}>{label}</p>
      <p className="text-base font-bold" style={{ color: accent || theme.textPrimary }}>{value}</p>
    </div>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, t }: any) {
  if (!active || !payload?.length) return null;
  const theme: ReportTheme = t ?? DARK_THEME;
  return (
    <div className="rounded-xl p-3 shadow-lg text-xs" style={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}` }}>
      <p className="mb-1 font-medium" style={{ color: theme.textMuted }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {typeof p.value === "number" && p.value >= 100
            ? `R$ ${p.value >= 1000 ? (p.value/1000).toFixed(0)+"k" : p.value.toFixed(0)}`
            : p.value?.toLocaleString?.("pt-BR") ?? p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = ["Resultados", "Conteúdos"] as const;
type Tab = typeof TABS[number];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PublicClientReport() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const managerToken = typeof window !== "undefined" ? localStorage.getItem("manager_token") ?? undefined : undefined;
  const [activeTab, setActiveTab] = useState<Tab>("Resultados");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [fromDate, setFromDate] = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [toDate, setToDate] = useState<Date>(() => startOfDay(now));
  const dateRange = useMemo(() => ({ from: formatDate(fromDate), to: formatDate(toDate) }), [fromDate, toDate]);

  function applyPreset(preset: PresetId) {
    const { from, to } = resolvePreset(preset, new Date());
    setFromDate(from);
    setToDate(to);
  }

  const [mondayAutoSyncing, setMondayAutoSyncing] = useState(false);
  const syncBoardMutation = trpc.monday.syncBoardAsManager.useMutation();
  const utils = trpc.useUtils();

  const { data: _clientInfoRaw, isLoading: loadingClient, error: clientError } =
    trpc.public.getClientByToken.useQuery({ token, managerToken }, { enabled: !!token });
  const clientInfo = _clientInfoRaw as (typeof _clientInfoRaw & { logoUrl?: string | null; brandColor?: string | null }) | undefined;

  useEffect(() => {
    if (!clientInfo?.id) return;
    const managerToken = localStorage.getItem("manager_token");
    if (!managerToken || !clientInfo.mondayBoardId) return;
    setMondayAutoSyncing(true);
    syncBoardMutation.mutate(
      { clientId: clientInfo.id, boardId: clientInfo.mondayBoardId, managerToken, startDate: new Date(dateRange.from + "T00:00:00"), endDate: new Date(dateRange.to + "T23:59:59") },
      { onSuccess: (data) => { setMondayAutoSyncing(false); if (!data.reason) utils.public.getPublicKpis.invalidate(); }, onError: () => setMondayAutoSyncing(false) }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientInfo?.id, dateRange.from, dateRange.to]);

  const { data: dashData, isLoading: loadingDash } = trpc.public.getPublicKpis.useQuery(
    { token, from: dateRange.from, to: dateRange.to, managerToken },
    { enabled: !!clientInfo?.id }
  );
  const { data: postsData, isLoading: postsLoading } = (trpc as any).public.getPublicTopPosts.useQuery(
    { token, limit: 8, managerToken },
    { enabled: !!clientInfo?.igUsername && activeTab === "Conteúdos" }
  );
  const { data: igInsights, isLoading: igInsightsLoading } = (trpc as any).public.getPublicInstagramInsights.useQuery(
    { token, from: dateRange.from, to: dateRange.to, managerToken },
    { enabled: !!clientInfo?.igUsername }
  );
  const { data: publicCreativesData, isLoading: publicCreativesLoading } = (trpc as any).public.getPublicCreatives.useQuery(
    { token, from: dateRange.from, to: dateRange.to, managerToken },
    { enabled: !!clientInfo?.id && activeTab === "Resultados" }
  );

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (loadingClient) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DARK_THEME.bg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(0.55 0.22 25)", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: DARK_THEME.textMuted }}>Carregando relatório...</p>
        </div>
      </div>
    );
  }
  if (clientError || !clientInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: DARK_THEME.bg }}>
        <div className="text-center">
          <p className="text-4xl mb-3">🔗</p>
          <p className="text-lg font-semibold mb-2" style={{ color: DARK_THEME.textPrimary }}>Link inválido</p>
          <p className="text-sm" style={{ color: DARK_THEME.textMuted }}>Este link não existe ou expirou.</p>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = dashData as any;
  const reportTheme = (clientInfo as any).reportTheme ?? "dark";
  const theme: ReportTheme = reportTheme === "light" ? LIGHT_THEME : DARK_THEME;
  const accentColor = clientInfo.brandColor || theme.accentHex;

  // Generate color variants from accentColor
  function adjHex(hex: string, factor: number): string {
    try {
      const h = hex.replace(/^#/, "").padEnd(6, "0");
      const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      const c = (v: number) => Math.min(255, Math.max(0, Math.round(v * factor))).toString(16).padStart(2,"0");
      return `#${c(r)}${c(g)}${c(b)}`;
    } catch { return hex; }
  }
  const ac = accentColor.startsWith("#") ? accentColor : "#e63946";
  const grad1 = `linear-gradient(135deg, ${ac} 0%, ${adjHex(ac, 0.65)} 100%)`;
  const grad2 = `linear-gradient(135deg, ${adjHex(ac, 0.80)} 0%, ${adjHex(ac, 0.55)} 100%)`;
  const grad3 = `linear-gradient(135deg, ${adjHex(ac, 1.20)} 0%, ${ac} 100%)`;
  const grad4 = `linear-gradient(135deg, ${adjHex(ac, 0.90)} 0%, ${adjHex(ac, 0.70)} 100%)`;

  const totalVendas = d ? (d.receitaTotal ?? (((d.totalConsultas ?? 0) + (d.totalCirurgias ?? 0)) || (d.totalEmVendas ?? 0))) : 0;
  const roas = d?.roas ?? 0;
  const ticketMedio = d?.ticketMedio ?? 0;
  const custoPorLead = d?.custoPorLead ?? (d?.leads > 0 ? d?.investimento / d?.leads : 0);
  const revenueLineage = d?.revenueLineage as { label?: string; updatedAt?: string | null; roasFormula?: string } | undefined;
  const revenueUpdatedAt = revenueLineage?.updatedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(revenueLineage.updatedAt))
    : null;

  const campanhaData = d?.campanhas ? [
    d.campanhas.mensagens && { name: "Mensagens", investimento: d.campanhas.mensagens.investimento ?? 0 },
    d.campanhas.visitas && { name: "Visitas", investimento: d.campanhas.visitas.investimento ?? 0 },
    d.campanhas.formulario && { name: "Formulário", investimento: d.campanhas.formulario.investimento ?? 0 },
  ].filter(Boolean) : [];

  const funilData = d ? [
    { name: "Leads", value: d.leads ?? 0, color: accentColor },
    { name: "Consultas", value: d.consultas ?? 0, color: adjHex(ac, 0.80) },
    { name: "Fechamentos", value: d.vendas ?? 0, color: adjHex(ac, 0.60) },
  ] : [];

  const periodLabel = (() => {
    const f = fromDate; const t = toDate;
    if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
      return `${MONTHS_FULL[f.getMonth()]} ${f.getFullYear()}`;
    }
    return `${MONTHS_CAL[f.getMonth()]} – ${MONTHS_CAL[t.getMonth()]} ${t.getFullYear()}`;
  })();

  return (
    <div className="min-h-screen" style={{ background: theme.bg, fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30" style={{ background: theme.bgHeader, borderBottom: `1px solid ${theme.bgBorder}` }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 gap-3">
            {/* Brand */}
            <div className="flex items-center gap-2.5 min-w-0">
              {clientInfo.logoUrl ? (
                <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                  <img src={clientInfo.logoUrl} alt={clientInfo.name} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: accentColor }}>
                  {clientInfo.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-bold truncate" style={{ color: theme.textPrimary }}>{clientInfo.name}</h1>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px]" style={{ color: theme.textMuted }}>Relatório de Desempenho</p>
                  {mondayAutoSyncing && (
                    <span className="flex items-center gap-1 text-[10px] animate-pulse" style={{ color: theme.accent }}>
                      <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Atualizando...
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Period presets — hidden on mobile */}
            <div className="hidden md:flex items-center gap-1.5 flex-wrap justify-end">
              {PRESETS.map(({ id, label }) => {
                return (
                  <button key={id} onClick={() => applyPreset(id)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors" style={{ background: theme.bgInput, border: `1px solid ${theme.bgBorder}`, color: theme.textSecondary }}>
                    {label}
                  </button>
                );
              })}
              <input type="date" value={formatDate(fromDate)} max={formatDate(toDate)}
                onChange={e => { const d = new Date(e.target.value + "T00:00:00"); if (!isNaN(d.getTime())) setFromDate(d); }}
                className="px-2 py-1 rounded-lg text-[10px] outline-none" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}`, color: theme.textSecondary }} />
              <span className="text-xs" style={{ color: theme.textMuted }}>→</span>
              <input type="date" value={formatDate(toDate)} min={formatDate(fromDate)} max={formatDate(startOfDay(now))}
                onChange={e => { const d = new Date(e.target.value + "T00:00:00"); if (!isNaN(d.getTime())) setToDate(d); }}
                className="px-2 py-1 rounded-lg text-[10px] outline-none" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}`, color: theme.textSecondary }} />
            </div>

            {/* Mobile: period button */}
            <button className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px]" style={{ background: theme.bgInput, border: `1px solid ${theme.bgBorder}`, color: theme.textSecondary }}
              onClick={() => setMobileMenuOpen(o => !o)}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/>
                <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2"/>
              </svg>
              {periodLabel}
            </button>
          </div>

          {/* Mobile date panel */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-3 pt-1 flex flex-wrap gap-1.5 items-center" style={{ borderTop: `1px solid ${theme.bgBorder}` }}>
              {PRESETS.map(({ id, label }) => {
                return (
                  <button key={id} onClick={() => { applyPreset(id); setMobileMenuOpen(false); }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors" style={{ background: theme.bgInput, border: `1px solid ${theme.bgBorder}`, color: theme.textSecondary }}>
                    {label}
                  </button>
                );
              })}
              <input type="date" value={formatDate(fromDate)} max={formatDate(toDate)}
                onChange={e => { const d = new Date(e.target.value + "T00:00:00"); if (!isNaN(d.getTime())) setFromDate(d); }}
                className="px-2 py-1 rounded-lg text-[10px] outline-none" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}`, color: theme.textSecondary }} />
              <span className="text-xs" style={{ color: theme.textMuted }}>→</span>
              <input type="date" value={formatDate(toDate)} min={formatDate(fromDate)} max={formatDate(startOfDay(now))}
                onChange={e => { const d = new Date(e.target.value + "T00:00:00"); if (!isNaN(d.getTime())) setToDate(d); }}
                className="px-2 py-1 rounded-lg text-[10px] outline-none" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}`, color: theme.textSecondary }} />
            </div>
          )}

          {/* Tabs — horizontal scroll on mobile */}
          <div ref={tabsRef} className="flex gap-0 overflow-x-auto scrollbar-none -mb-px" style={{ borderTop: `1px solid ${theme.bgBorder}` }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-2.5 text-[11px] font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeTab === tab ? "border-current" : "border-transparent hover:opacity-80"
                }`}
                style={activeTab === tab ? { borderColor: accentColor, color: accentColor } : { color: theme.textMuted }}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-6" style={{ color: theme.textPrimary }}>
        {/* Period label */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: theme.textPrimary }}>{activeTab}</h2>
            <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{periodLabel}</p>
          </div>
          {d && !loadingDash && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Atualizado
            </div>
          )}
        </div>

        {loadingDash ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: theme.bgInput }} />)}
          </div>
        ) : d ? (
          <>
            {/* ── RESULTADOS ───────────────────────────────────────────────── */}
            {activeTab === "Resultados" && (
              <div className="space-y-6">
                <section className="rounded-2xl px-5 py-5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                  <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: theme.textMuted }}>Resumo do período</p>
                  <p className="text-base md:text-lg leading-relaxed" style={{ color: theme.textSecondary }}>
                    Investimento de <strong style={{ color: theme.textPrimary }}>{fmt(d.investimento, "R$")}</strong> gerou <strong style={{ color: theme.textPrimary }}>{fmt(totalVendas, "R$")}</strong> em receita, com <strong style={{ color: accentColor }}>ROAS de {roas > 0 ? `${roas.toFixed(2)}x` : "—"}</strong> e ticket médio de <strong style={{ color: theme.textPrimary }}>{fmt(ticketMedio, "R$")}</strong>.
                  </p>
                  <div className="mt-4 pt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ borderTop: `1px solid ${theme.bgBorder}`, color: theme.textMuted }}>
                    <span>Leads: <strong style={{ color: theme.textPrimary }}>{fmt(d.leads)}</strong></span>
                    <span>CPL: <strong style={{ color: theme.textPrimary }}>{fmt(custoPorLead, "R$")}</strong></span>
                    <span>Consultas: <strong style={{ color: theme.textPrimary }}>{fmt(d.consultas ?? 0)}</strong></span>
                    <span>Fechamentos: <strong style={{ color: theme.textPrimary }}>{fmt(d.vendas)}</strong></span>
                    <span>Alcance: <strong style={{ color: theme.textPrimary }}>{fmt(d.alcance)}</strong></span>
                    <span>Cliques: <strong style={{ color: theme.textPrimary }}>{fmt(d.cliquesEstimados)}</strong></span>
                  </div>
                </section>

                {/* ── Métricas do período ─────────────────────────────────── */}
                <Trafego
                  investimento={d.investimento ?? 0}
                  leads={d.leads ?? 0}
                  leadsMensagem={d.campanhas?.mensagens?.leads ?? 0}
                  leadsFormulario={d.campanhas?.formulario?.leads ?? 0}
                  cplMensagem={d.campanhas?.mensagens?.custoPorLead ?? custoPorLead}
                  cplFormulario={d.campanhas?.formulario?.custoPorLead ?? 0}
                  alcance={d.alcance ?? 0}
                  cliquesNoLink={d.cliquesEstimados ?? 0}
                  accentColor={accentColor}
                  t={theme}
                />

                {igInsights?.connected && igInsights?.totals && (
                  <Perfil
                    novosSeguidores={igInsights.totals.novosSeguidores ?? 0}
                    visitasAoPerfil={igInsights.totals.profileVisits ?? 0}
                    cliquesNoLinkBio={igInsights.totals.interactions ?? 0}
                    t={theme}
                  />
                )}

                <Comercial
                  roas={roas}
                  receita={totalVendas}
                  ticketMedio={ticketMedio}
                  consultasAgendadas={d.consultas ?? 0}
                  vendas={d.vendas ?? 0}
                  accentColor={accentColor}
                  t={theme}
                />

                <div className="px-1 py-1 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between" style={{ color: theme.textMuted }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: theme.textMuted }}>Dados comerciais</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: theme.textSecondary }}>{revenueLineage?.label ?? "Sem base comercial disponível no período"}</p>
                  </div>
                  <div className="text-[10px] sm:text-right" style={{ color: theme.textMuted }}>
                    {revenueUpdatedAt && <p className="mt-0.5">Atualizado em {revenueUpdatedAt}</p>}
                  </div>
                </div>

                {/* Chart */}
                {campanhaData.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: theme.textSecondary }}>Investimento por tipo de campanha</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={campanhaData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: theme.axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: theme.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`} />
                        <Tooltip content={<CustomTooltip t={theme} />} />
                        <Bar dataKey="investimento" name="Investimento" radius={[6, 6, 0, 0]} fill={accentColor} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Funil de resultados</h3>
                    <p className="text-xs mt-1" style={{ color: theme.textMuted }}>Resumo agregado sem expor contatos ou informações pessoais do CRM.</p>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: "Leads captados", value: d.leads ?? 0, width: 100, detail: "Base do funil" },
                      { label: "Consultas realizadas", value: d.consultas ?? 0, width: d.leads > 0 ? ((d.consultas ?? 0) / d.leads) * 100 : 0, detail: d.leads > 0 ? `${(((d.consultas ?? 0) / d.leads) * 100).toFixed(1)}% dos leads` : "Sem base de leads" },
                      { label: "Negócios fechados", value: d.vendas ?? 0, width: d.leads > 0 ? ((d.vendas ?? 0) / d.leads) * 100 : 0, detail: (d.consultas ?? 0) > 0 ? `${((d.vendas / d.consultas) * 100).toFixed(1)}% das consultas` : "Sem consultas registradas" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-baseline justify-between gap-3 mb-2">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: theme.textSecondary }}>{item.label}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: theme.textMuted }}>{item.detail}</p>
                          </div>
                          <p className="text-lg font-bold" style={{ color: theme.textPrimary }}>{fmt(item.value)}</p>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: theme.bgInput }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(item.width, item.value > 0 ? 2 : 0)}%`, background: accentColor }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-5">
                    <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>Anúncios no ar</h3>
                    <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>As peças que estão sendo veiculadas em nome da clínica neste período.</p>
                  </div>
                  {publicCreativesLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <div key={i} className="aspect-square rounded-2xl animate-pulse" style={{ background: theme.bgInput }} />)}</div>
                  ) : publicCreativesData?.error === "meta_not_configured" ? (
                    <div className="text-center py-10 rounded-2xl border-2 border-dashed" style={{ borderColor: theme.bgBorder }}>
                      <p className="text-sm" style={{ color: theme.textMuted }}>Meta Ads não configurado para este cliente.</p>
                    </div>
                  ) : publicCreativesData?.creatives?.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {(publicCreativesData.creatives as any[]).map((cr: any) => (
                        <div key={cr.adId} className="rounded-xl overflow-hidden" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                          <div className="relative aspect-square overflow-hidden" style={{ background: theme.bgInput }}>
                            {cr.thumbnailUrl ? (
                              <img src={cr.thumbnailUrl} alt={cr.adName} className="w-full h-full object-contain" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: theme.textMuted }}>
                                {cr.format === "video" ? "🎥" : cr.format === "carousel" ? "📷" : "🖼️"}
                              </div>
                            )}
                            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/60 text-white">
                              {cr.format === "video" ? "Vídeo" : cr.format === "carousel" ? "Carrossel" : "Imagem"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 rounded-2xl border-2 border-dashed" style={{ borderColor: theme.bgBorder }}>
                      <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum anúncio ativo encontrado para este período.</p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ── META ADS ─────────────────────────────────────────────────── */}
            {false && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Investimento" value={fmt(d.investimento, "R$")}
                    gradient={grad1} icon="💰" />
                  <KpiCard label="Leads (WPP)" value={fmt(d.leads)} sub="Conversas iniciadas"
                    gradient={grad2} icon="💬" />
                  <KpiCard label="CPL Médio" value={fmt(custoPorLead, "R$")}
                    gradient={grad3} icon="📊" />
                  <KpiCard label="Alcance" value={fmt(d.alcance)} sub="Pessoas alcançadas"
                    gradient={grad4} icon="👥" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <SmallKpi label="Cliques no Link" value={fmt(d.cliquesEstimados)} />
                  <SmallKpi label="Custo/Clique" value={fmt(d.custoPorClique, "R$")} accent="#10b981" />
                  {d.campanhas?.visitas && <SmallKpi label="Visitas ao Perfil" value={fmt(d.campanhas.visitas.alcance)} />}
                  {d.campanhas?.visitas && <SmallKpi label="Custo/Visita" value={fmt(d.campanhas.visitas.custoPorVisita, "R$")} accent="#10b981" />}
                </div>
                {campanhaData.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: theme.textSecondary }}>Distribuição por campanha</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={campanhaData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                        <XAxis type="number" tick={{ fill: theme.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`} />
                        <YAxis type="category" dataKey="name" tick={{ fill: theme.axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                        <Tooltip content={<CustomTooltip t={theme} />} />
                        <Bar dataKey="investimento" name="Investimento" radius={[0, 6, 6, 0]} fill={accentColor} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ── CRM & VENDAS ─────────────────────────────────────────────── */}
            {false && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Receita Total" value={fmt(totalVendas, "R$")} sub={`${d.vendas ?? 0} fechamentos`}
                    gradient={grad1} icon="💰" />
                  <KpiCard label="ROAS"
                    value={roas > 0 ? `${roas.toFixed(1)}x` : "—"}
                    gradient={grad2}
                    icon="⚡" />
                  <KpiCard label="Ticket Médio" value={fmt(ticketMedio, "R$")}
                    gradient={grad3} icon="🎯" />
                  <KpiCard label="Fechamentos" value={fmt(d.vendas)}
                    gradient={grad4} icon="✅" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <SmallKpi label="Consultas" value={fmt(d.consultas ?? 0)} />
                  <SmallKpi label="Custo/Venda" value={fmt(d.custoPorVenda, "R$")} accent="#10b981" />
                  <SmallKpi label="Taxa Conversão" value={d.taxaConversao != null ? `${(d.taxaConversao as number).toFixed(1)}%` : "—"} accent="#6366f1" />
                </div>
                {(d.totalConsultas > 0 || d.totalCirurgias > 0) && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                      <h3 className="text-sm font-semibold mb-4" style={{ color: theme.textSecondary }}>Receita por tipo</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={[
                          { name: "Consultas", valor: d.totalConsultas ?? 0 },
                          { name: "Procedimentos", valor: d.totalCirurgias ?? 0 },
                        ]} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fill: theme.axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: theme.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                            tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`} />
                          <Tooltip content={<CustomTooltip t={theme} />} />
                          <Bar dataKey="valor" name="Receita" radius={[6, 6, 0, 0]}>
                            <Cell fill="#10b981" />
                            <Cell fill="#8b5cf6" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-2xl p-5 flex flex-col justify-center gap-4" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                      <div>
                        <p className="text-xs mb-1" style={{ color: theme.textMuted }}>Total em Consultas</p>
                        <p className="text-2xl font-bold text-emerald-500">{fmt(d.totalConsultas ?? 0, "R$")}</p>
                      </div>
                      <div className="h-px" style={{ background: theme.bgBorder }} />
                      <div>
                        <p className="text-xs mb-1" style={{ color: theme.textMuted }}>Total em Procedimentos</p>
                        <p className="text-2xl font-bold text-purple-500">{fmt(d.totalCirurgias ?? 0, "R$")}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── FUNIL ────────────────────────────────────────────────────── */}
            {false && (
              <div className="space-y-6">
                <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                  <h3 className="text-sm font-semibold mb-5" style={{ color: "oklch(0.65 0.010 60)" }}>Funil de conversão</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Leads captados", value: d.leads ?? 0, color: accentColor, pct: 100 },
                      { label: "Consultas realizadas", value: d.consultas ?? 0, color: adjHex(ac, 0.80), pct: d.leads > 0 ? ((d.consultas ?? 0) / d.leads) * 100 : 0 },
                      { label: "Negócios fechados", value: d.vendas ?? 0, color: adjHex(ac, 0.60), pct: d.leads > 0 ? ((d.vendas ?? 0) / d.leads) * 100 : 0 },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium" style={{ color: theme.textSecondary }}>{item.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs" style={{ color: theme.textMuted }}>{item.pct.toFixed(1)}%</span>
                            <span className="text-base font-bold" style={{ color: theme.textPrimary }}>{fmt(item.value)}</span>
                          </div>
                        </div>
                        <div className="h-2.5 rounded-full" style={{ background: theme.bgBorder }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(item.pct, 100)}%`, background: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Leads" value={fmt(d.leads)} gradient={grad1} icon="📥" />
                  <KpiCard label="Consultas" value={fmt(d.consultas ?? 0)}
                    sub={d.leads > 0 ? `${(((d.consultas ?? 0) / d.leads) * 100).toFixed(1)}% dos leads` : undefined}
                    gradient={grad2} icon="📅" />
                  <KpiCard label="Fechamentos" value={fmt(d.vendas)}
                    sub={d.leads > 0 ? `${(((d.vendas ?? 0) / d.leads) * 100).toFixed(1)}% dos leads` : undefined}
                    gradient={grad3} icon="✅" />
                  <KpiCard label="Receita Total" value={fmt(totalVendas, "R$")}
                    gradient={grad4} icon="💰" />
                </div>
                <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.65 0.010 60)" }}>Comparativo do funil</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={funilData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: theme.axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "oklch(0.35 0.008 20)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Quantidade" radius={[6, 6, 0, 0]}>
                        {funilData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16" style={{ color: theme.textMuted }}>
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm">Nenhum dado encontrado para o período selecionado.</p>
          </div>
        )}

        {/* ── CONTEÚDOS ────────────────────────────────────────────────────── */}
        {activeTab === "Conteúdos" && (
          <div>
            {!clientInfo?.igUsername ? (
              <div className="text-center py-12 rounded-2xl border-2 border-dashed" style={{ borderColor: theme.bgBorder }}>
                <p className="text-sm" style={{ color: theme.textMuted }}>Instagram não conectado para este cliente.</p>
              </div>
            ) : (
              <div>
                {/* ── Perfil: seguidores, crescimento e alcance ───────────── */}
                {igInsightsLoading ? (
                  <div className="grid gap-3 md:grid-cols-3 mb-8">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: theme.bgInput }} />
                    ))}
                  </div>
                ) : igInsights?.connected && igInsights?.totals ? (
                  <InstagramProfile
                    totals={igInsights.totals}
                    username={igInsights.username}
                    accentColor={accentColor}
                    periodLabel={periodLabel}
                    t={theme}
                  />
                ) : null}

                {/* ── Conteúdos que mais performaram ──────────────────────── */}
                {postsLoading ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="aspect-[4/5] rounded-2xl animate-pulse" style={{ background: theme.bgInput }} />
                    ))}
                  </div>
                ) : postsData?.posts?.length > 0 ? (
                  <TopContent posts={postsData.posts} accentColor={accentColor} t={theme} />
                ) : (
                  <div className="text-center py-12 rounded-2xl border-2 border-dashed" style={{ borderColor: theme.bgBorder }}>
                    <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum conteúdo encontrado no período.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CRIATIVOS ────────────────────────────────────────────────────── */}
        {false && (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">🎨</span>
              <div>
                <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>Criativos Ativos no Tráfego</h3>
                <p className="text-xs" style={{ color: theme.textMuted }}>{periodLabel}</p>
              </div>
            </div>
            {publicCreativesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <div key={i} className="aspect-square rounded-2xl animate-pulse" style={{ background: theme.bgInput }} />)}</div>
            ) : publicCreativesData?.error === "meta_not_configured" ? (
              <div className="text-center py-12 rounded-2xl border-2 border-dashed" style={{ borderColor: "oklch(0.20 0.008 20)" }}>
                <p className="text-sm" style={{ color: theme.textMuted }}>Meta Ads não configurado para este cliente.</p>
              </div>
            ) : publicCreativesData?.creatives?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {(publicCreativesData.creatives as any[]).map((cr: any) => (
                  <div key={cr.adId} className="rounded-xl overflow-hidden" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                    <div className="relative aspect-square overflow-hidden" style={{ background: theme.bgInput }}>
                      {cr.thumbnailUrl ? (
                        <img src={cr.thumbnailUrl} alt={cr.adName} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: "oklch(0.35 0.008 20)" }}>
                          {cr.format === "video" ? "🎥" : cr.format === "carousel" ? "📷" : "🖼️"}
                        </div>
                      )}
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/60 text-white">
                        {cr.format === "video" ? "🎥" : cr.format === "carousel" ? "📷" : "🖼️"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-2xl border-2 border-dashed" style={{ borderColor: "oklch(0.20 0.008 20)" }}>
                <p className="text-sm" style={{ color: theme.textMuted }}>Nenhum criativo encontrado para este período.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-xs" style={{ borderTop: `1px solid ${theme.bgBorder}`, color: theme.textMuted }}>
        Relatório gerado por ADS Dashboard · Escarlate Digital · {periodLabel}
      </footer>
    </div>
  );
}
