import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, Image as ImageIcon, Lightbulb, Loader2, RefreshCw, Sparkles, Target, TestTube2, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { normalizeRankingDateRange } from "@/lib/rankingDateRange";
import { toast } from "sonner";

type CreativeMetrics = { spend: number; impressions: number; reach?: number; clicks: number; leads: number; ctr: number; cpl: number };
type CreativeDiagnostic = {
  label: "Referência" | "Otimizar gancho" | "Otimizar conversão" | "Acompanhar" | "Dados insuficientes";
  tone: "success" | "warning" | "danger" | "neutral";
  explanation: string;
  decision: string;
};
type CreativeAnalysis = {
  id?: number;
  adId: string;
  adName: string | null;
  campaignName: string | null;
  adsetName?: string | null;
  format: string | null;
  thumbnailUrl: string | null;
  hook: string | null;
  angle: string | null;
  promise: string | null;
  proof: string | null;
  offer: string | null;
  callToAction: string | null;
  performanceInsight: string | null;
  testHypothesis: string | null;
  confidence: number;
  metrics: CreativeMetrics | string | null;
  diagnostic?: CreativeDiagnostic;
};

type Client = { id: number; name: string };

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function getInitialRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}
function formatNumber(value: number) { return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0); }
function parseMetrics(value: CreativeAnalysis["metrics"]): CreativeMetrics {
  if (typeof value === "string") {
    try { return JSON.parse(value) as CreativeMetrics; } catch { return { spend: 0, impressions: 0, clicks: 0, leads: 0, ctr: 0, cpl: 0 }; }
  }
  return value ?? { spend: 0, impressions: 0, clicks: 0, leads: 0, ctr: 0, cpl: 0 };
}
function displayLabel(value: string | null | undefined) { return value && value !== "Não identificado" ? value : "Não identificado"; }
function diagnosticStyle(tone: CreativeDiagnostic["tone"]) {
  if (tone === "success") return { color: "#6ee7b7", background: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.30)" };
  if (tone === "warning") return { color: "#fcd34d", background: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)" };
  if (tone === "danger") return { color: "#fda4af", background: "rgba(244,63,94,0.10)", border: "rgba(244,63,94,0.30)" };
  return { color: "#cbd5e1", background: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.25)" };
}

export default function ManagerCreativeAnalyst() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [range, setRange] = useState(getInitialRange);
  const [latestRun, setLatestRun] = useState<CreativeAnalysis[] | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("manager_token");
    if (!savedToken) { navigate("/manager/login"); return; }
    setToken(savedToken);
  }, [navigate]);

  const clientsQuery = trpc.managers.myClients.useQuery({ token: token! }, { enabled: !!token });
  const clients = (clientsQuery.data?.clients ?? []) as Client[];

  useEffect(() => {
    if (!clientId && clients.length) setClientId(clients[0].id);
  }, [clientId, clients]);

  const storedQuery = trpc.managers.getCreativeAnalysesAsManager.useQuery(
    { token: token!, clientId: clientId!, from: range.from, to: range.to },
    { enabled: !!token && !!clientId }
  );

  const runAnalysis = trpc.managers.analyzeCreativesAsManager.useMutation({
    onSuccess: async (data) => {
      setLatestRun(null);
      await storedQuery.refetch();
      if (data.warning) toast.message(data.warning);
      else toast.success(`${data.analyzed} criativo(s) analisado(s)${data.cached ? ` e ${data.cached} já existente(s)` : ""}.`);
    },
    onError: (error) => toast.error(error.message || "Não foi possível analisar os criativos."),
  });

  const analyses = (latestRun ?? storedQuery.data?.analyses ?? []) as CreativeAnalysis[];
  const sortedAnalyses = useMemo(() => [...analyses].sort((a, b) => {
    const aMetrics = parseMetrics(a.metrics);
    const bMetrics = parseMetrics(b.metrics);
    if (aMetrics.leads !== bMetrics.leads) return bMetrics.leads - aMetrics.leads;
    return bMetrics.ctr - aMetrics.ctr;
  }), [analyses]);
  const summary = useMemo(() => {
    const metrics = sortedAnalyses.map((analysis) => parseMetrics(analysis.metrics));
    const withLeads = metrics.filter((metric) => metric.leads > 0);
    const bestCtr = metrics.length ? Math.max(...metrics.map((metric) => metric.ctr)) : 0;
    const bestCpl = withLeads.length ? Math.min(...withLeads.map((metric) => metric.cpl)) : 0;
    const top = sortedAnalyses[0];
    return { total: sortedAnalyses.length, bestCtr, bestCpl, topHook: top?.hook ?? "Ainda não analisado" };
  }, [sortedAnalyses]);

  function updateRange(from: string, to: string) {
    const normalized = normalizeRankingDateRange(from, to);
    if (normalized) { setRange(normalized); setLatestRun(null); }
  }

  function selectPreset(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (days - 1));
    updateRange(isoDate(from), isoDate(to));
  }

  function run(force = false) {
    if (!token || !clientId) return;
    runAnalysis.mutate({ token, clientId, from: range.from, to: range.to, force });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 md:px-7 py-4 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/manager/intelligence")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Voltar para Inteligência"><ArrowLeft className="w-4 h-4" /></button>
          <div><div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-300" /><h1 className="font-semibold text-base">Creative Analyst</h1></div><p className="text-xs text-muted-foreground mt-0.5">Padrões de criativos com dados reais, antes de sugerir novas peças.</p></div>
        </div>
        <div className="flex items-center gap-2"><button onClick={() => navigate("/manager/creative-agent")} className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-fuchsia-400/30 text-fuchsia-200 bg-fuchsia-500/10 hover:bg-fuchsia-500/20"><TestTube2 className="w-3.5 h-3.5" />Criar briefs</button><button onClick={() => storedQuery.refetch()} disabled={storedQuery.isFetching} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50">{storedQuery.isFetching ? "Atualizando..." : "Atualizar"}</button></div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-7 py-6 space-y-6">
        <section className="rounded-2xl p-5 md:p-6 border" style={{ background: "linear-gradient(120deg, rgba(79,70,229,0.18), rgba(14,116,144,0.10))", borderColor: "rgba(129,140,248,0.28)" }}>
          <div className="flex flex-col xl:flex-row gap-5 xl:items-end xl:justify-between">
            <div className="max-w-2xl"><span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: "rgba(129,140,248,0.18)", color: "#c7d2fe" }}><Lightbulb className="w-3 h-3" /> Nível 2 da IA Meta Ads</span><h2 className="text-xl md:text-2xl font-semibold mt-3">Descubra o padrão antes de criar a próxima peça.</h2><p className="text-sm text-muted-foreground mt-2 leading-relaxed">A análise usa o texto, CTA, formato e desempenho de até 15 anúncios ativos. Ela sugere hipóteses, mas não publica, pausa ou altera campanhas.</p></div>
            <button onClick={() => run(false)} disabled={!clientId || runAnalysis.isPending} className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 text-white disabled:opacity-55" style={{ background: "#4f46e5" }}>{runAnalysis.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{runAnalysis.isPending ? "Analisando..." : "Analisar até 15 criativos"}</button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="grid lg:grid-cols-[minmax(220px,1fr)_auto] gap-4 lg:items-end">
            <label className="block"><span className="text-xs font-medium">Cliente</span><select value={clientId ?? ""} onChange={(event) => { setClientId(Number(event.target.value)); setLatestRun(null); }} className="mt-1.5 w-full h-10 px-3 rounded-lg text-sm bg-background border border-border outline-none focus:border-violet-400/60"><option value="" disabled>Selecione um cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <div className="flex flex-wrap gap-2 items-center"><button onClick={() => selectPreset(7)} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:border-violet-400/50">7 dias</button><button onClick={() => selectPreset(30)} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:border-violet-400/50">30 dias</button><div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-border bg-background"><CalendarDays className="w-3.5 h-3.5 text-violet-300 ml-1" /><input type="date" value={range.from} onChange={(event) => updateRange(event.target.value, range.to)} aria-label="Data inicial dos criativos" className="h-7 px-1 text-xs bg-card border border-border rounded outline-none focus:border-violet-400/60" /><span className="text-xs text-muted-foreground">até</span><input type="date" value={range.to} onChange={(event) => updateRange(range.from, event.target.value)} aria-label="Data final dos criativos" className="h-7 px-1 text-xs bg-card border border-border rounded outline-none focus:border-violet-400/60" /></div></div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 border border-border bg-card"><span className="text-[11px] text-muted-foreground">Criativos classificados</span><p className="mt-1 text-xl font-semibold text-violet-300">{summary.total}</p></div>
          <div className="rounded-xl p-4 border border-border bg-card"><span className="text-[11px] text-muted-foreground">Melhor CTR</span><p className="mt-1 text-xl font-semibold text-cyan-300">{formatNumber(summary.bestCtr)}%</p></div>
          <div className="rounded-xl p-4 border border-border bg-card"><span className="text-[11px] text-muted-foreground">Melhor CPL</span><p className="mt-1 text-xl font-semibold text-emerald-300">{summary.bestCpl ? formatNumber(summary.bestCpl) : "—"}</p></div>
          <div className="rounded-xl p-4 border border-border bg-card"><span className="text-[11px] text-muted-foreground">Hook prioritário</span><p className="mt-1 text-sm font-semibold leading-snug text-foreground line-clamp-2">{displayLabel(summary.topHook)}</p></div>
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-border flex items-center justify-between"><div><h2 className="font-semibold text-sm">Biblioteca de Creative Intelligence</h2><p className="text-xs text-muted-foreground mt-1">Classificação baseada em texto, CTA e métricas. Revise os rótulos antes de usar como regra estratégica.</p></div>{sortedAnalyses.length > 0 && <button onClick={() => run(true)} disabled={runAnalysis.isPending} className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:border-violet-400/50 hover:text-violet-300 disabled:opacity-50"><RefreshCw className="w-3.5 h-3.5" />Reanalisar</button>}</div>
          {storedQuery.isLoading && !latestRun ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-violet-300" /></div>
          ) : sortedAnalyses.length === 0 ? (
            <div className="py-16 px-5 text-center"><ImageIcon className="w-8 h-8 mx-auto text-muted-foreground/60" /><p className="text-sm text-muted-foreground mt-3">Nenhum criativo foi classificado para esse período.</p><p className="text-xs text-muted-foreground mt-1">Escolha o cliente e clique em “Analisar até 15 criativos”.</p></div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 md:p-5">
              {sortedAnalyses.map((analysis) => {
                const metrics = parseMetrics(analysis.metrics);
                const diagnosis = analysis.diagnostic;
                const style = diagnosticStyle(diagnosis?.tone ?? "neutral");
                return <article key={`${analysis.adId}-${analysis.id ?? analysis.adName}`} className="rounded-xl overflow-hidden border border-border bg-background/40 flex flex-col">
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    {analysis.thumbnailUrl ? <img src={analysis.thumbnailUrl} alt={analysis.adName ?? "Criativo Meta"} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground/50" /></div>}
                    <span className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded-full bg-black/65 text-white capitalize">{analysis.format ?? "não identificado"}</span>
                  </div>
                  <div className="p-4 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{analysis.adName ?? "Anúncio sem nome"}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">{analysis.campaignName ?? "Campanha não identificada"}</p>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="rounded-lg p-2 bg-card border border-border"><span className="block text-[10px] text-muted-foreground">CTR</span><strong className="block text-xs mt-0.5">{formatNumber(metrics.ctr)}%</strong></div>
                      <div className="rounded-lg p-2 bg-card border border-border"><span className="block text-[10px] text-muted-foreground">Leads</span><strong className="block text-xs mt-0.5">{metrics.leads}</strong></div>
                      <div className="rounded-lg p-2 bg-card border border-border"><span className="block text-[10px] text-muted-foreground">CPL</span><strong className="block text-xs mt-0.5">{metrics.leads ? formatNumber(metrics.cpl) : "—"}</strong></div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5"><span className="text-[11px] px-2 py-1 rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-200">Hook: {displayLabel(analysis.hook)}</span><span className="text-[11px] px-2 py-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">Ângulo: {displayLabel(analysis.angle)}</span></div>
                    <div className="mt-3 p-3 rounded-xl border" style={{ background: style.background, borderColor: style.border }}>
                      <p className="text-[11px] font-semibold" style={{ color: style.color }}>Diagnóstico: {diagnosis?.label ?? "Dados insuficientes"}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-foreground">{diagnosis?.explanation ?? "Atualize os dados para comparar este criativo com os demais."}</p>
                      <p className="text-[11px] font-semibold mt-3" style={{ color: style.color }}>Decisão recomendada</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{diagnosis?.decision ?? "Acompanhar antes de decidir uma ação."}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border"><p className="text-[11px] font-semibold text-amber-300">Hipótese de teste</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{analysis.testHypothesis ?? "Sem hipótese disponível."}</p></div>
                  </div>
                </article>;
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 md:p-5"><div className="flex gap-3"><Target className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" /><div><h2 className="font-semibold text-sm">Como usar essa etapa</h2><p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Use os criativos com mais leads, CTR consistente e CPL saudável como referência. Antes de produzir novas peças, confira se os rótulos de hook e ângulo fazem sentido para o negócio. A próxima etapa será transformar esses padrões revisados em briefs e hipóteses de novos testes.</p></div></div></section>
      </main>
    </div>
  );
}
