import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ChevronRight, CircleAlert, Database, Loader2, Save, Search, Sparkles, Target, TrendingUp, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { normalizeRankingDateRange } from "@/lib/rankingDateRange";
import { toast } from "sonner";

type MappingItem = {
  clientId: number;
  clientName: string;
  metaAdAccountId: string | null;
  mondayBoardId: string | null;
  instagramUsername: string | null;
  campaignTypes: string[];
  leadChannel: string | null;
  targetCpl: string | number | null;
  targetCostPerConsult: string | number | null;
  targetRoas: string | number | null;
  mappingNotes: string | null;
  mappingConfirmed: boolean;
  salesRecordsCount: number;
  pendingFields: string[];
  readiness: number;
  status: "pronto" | "parcial" | "pendente";
};

type RankingItem = {
  clientId: number;
  clientName: string;
  leadChannel: string | null;
  metrics: { investimento: number; leads: number; consultas: number; fechamentos: number; receita: number };
  targets: { cpl: number | null; costPerConsult: number | null; roas: number | null };
  category: "atencao" | "oportunidade" | "estabilidade" | "dados_incompletos";
  priority: "alta" | "media" | "baixa" | "configurar";
  score: number;
  cpl: number;
  costPerConsult: number;
  roas: number;
  evidence: string[];
  recommendation: string;
};

const CAMPAIGN_TYPES = [
  { id: "lead", label: "Engajamento / Lead", emoji: "🎯" },
  { id: "profile_visit", label: "Visitas ao Perfil", emoji: "👤" },
  { id: "awareness", label: "Reconhecimento", emoji: "📢" },
];

const LEAD_CHANNELS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram Direct" },
  { id: "formulario", label: "Formulário" },
  { id: "misto", label: "Misto" },
  { id: "outro", label: "Outro" },
];

function statusStyle(status: MappingItem["status"]) {
  if (status === "pronto") return { label: "Pronto", color: "#34d399", background: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" };
  if (status === "parcial") return { label: "Parcial", color: "#fbbf24", background: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" };
  return { label: "Pendente", color: "#fb7185", background: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.3)" };
}

function numericValue(value: string | number | null) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getInitialRankingRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { from: formatDate(start), to: formatDate(end) };
}

function rankingStyle(category: RankingItem["category"]) {
  if (category === "atencao") return { label: "Atenção", color: "#fb7185", background: "rgba(244,63,94,0.13)", border: "rgba(244,63,94,0.35)", icon: CircleAlert };
  if (category === "oportunidade") return { label: "Oportunidade", color: "#34d399", background: "rgba(16,185,129,0.13)", border: "rgba(16,185,129,0.35)", icon: TrendingUp };
  if (category === "dados_incompletos") return { label: "Dados incompletos", color: "#fbbf24", background: "rgba(245,158,11,0.13)", border: "rgba(245,158,11,0.35)", icon: Database };
  return { label: "Estabilidade", color: "#67e8f9", background: "rgba(6,182,212,0.13)", border: "rgba(6,182,212,0.35)", icon: Target };
}

export default function ManagerIntelligence() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | MappingItem["status"]>("todos");
  const [rankingRange, setRankingRange] = useState(getInitialRankingRange);
  const [selected, setSelected] = useState<MappingItem | null>(null);
  const [form, setForm] = useState({
    mondayBoardId: "",
    leadChannel: "",
    campaignTypes: [] as string[],
    targetCpl: "",
    targetCostPerConsult: "",
    targetRoas: "",
    mappingNotes: "",
    mappingConfirmed: false,
  });

  useEffect(() => {
    const savedToken = localStorage.getItem("manager_token");
    if (!savedToken) {
      navigate("/manager/login");
      return;
    }
    setToken(savedToken);
  }, [navigate]);

  const mappingsQuery = trpc.managers.getIntelligenceMappingsAsManager.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  const rankingQuery = trpc.managers.getOpportunityRankingAsManager.useQuery(
    { token: token!, from: rankingRange.from, to: rankingRange.to },
    { enabled: !!token }
  );

  const saveMapping = trpc.managers.saveIntelligenceMappingAsManager.useMutation({
    onSuccess: async () => {
      toast.success("Mapeamento salvo com sucesso");
      setSelected(null);
      await mappingsQuery.refetch();
    },
    onError: (error) => toast.error(error.message || "Não foi possível salvar o mapeamento"),
  });

  const items = (mappingsQuery.data?.items ?? []) as MappingItem[];
  const rankingItems = (rankingQuery.data?.items ?? []) as RankingItem[];
  const summary = useMemo(() => ({
    ready: items.filter((item) => item.status === "pronto").length,
    partial: items.filter((item) => item.status === "parcial").length,
    pending: items.filter((item) => item.status === "pendente").length,
  }), [items]);

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesSearch = item.clientName.toLowerCase().includes(search.trim().toLowerCase()) || (item.metaAdAccountId ?? "").includes(search.trim());
    return matchesSearch && (filter === "todos" || item.status === filter);
  }), [items, search, filter]);

  const rankingSummary = useMemo(() => ({
    attention: rankingItems.filter((item) => item.category === "atencao").length,
    opportunity: rankingItems.filter((item) => item.category === "oportunidade").length,
    stable: rankingItems.filter((item) => item.category === "estabilidade").length,
    incomplete: rankingItems.filter((item) => item.category === "dados_incompletos").length,
  }), [rankingItems]);

  function openEditor(item: MappingItem) {
    setSelected(item);
    setForm({
      mondayBoardId: item.mondayBoardId ?? "",
      leadChannel: item.leadChannel ?? "",
      campaignTypes: item.campaignTypes ?? [],
      targetCpl: numericValue(item.targetCpl),
      targetCostPerConsult: numericValue(item.targetCostPerConsult),
      targetRoas: numericValue(item.targetRoas),
      mappingNotes: item.mappingNotes ?? "",
      mappingConfirmed: item.mappingConfirmed,
    });
  }

  function toggleCampaignType(type: string) {
    setForm((current) => ({
      ...current,
      campaignTypes: current.campaignTypes.includes(type)
        ? current.campaignTypes.filter((value) => value !== type)
        : [...current.campaignTypes, type],
    }));
  }

  function applyRankingRange(from: string, to: string) {
    const normalized = normalizeRankingDateRange(from, to);
    if (normalized) setRankingRange(normalized);
  }

  function handleSave() {
    if (!selected || !token) return;
    const invalidNumericInput = [form.targetCpl, form.targetCostPerConsult, form.targetRoas].some((value) => value.trim() && parseNumber(value) === null);
    if (invalidNumericInput) {
      toast.error("Preencha as metas com números válidos, usando ponto ou vírgula para decimais.");
      return;
    }
    saveMapping.mutate({
      token,
      clientId: selected.clientId,
      mondayBoardId: form.mondayBoardId.trim() || null,
      leadChannel: form.leadChannel ? form.leadChannel as "whatsapp" | "instagram" | "formulario" | "misto" | "outro" : null,
      campaignTypes: form.campaignTypes as Array<"lead" | "profile_visit" | "awareness">,
      targetCpl: parseNumber(form.targetCpl),
      targetCostPerConsult: parseNumber(form.targetCostPerConsult),
      targetRoas: parseNumber(form.targetRoas),
      mappingNotes: form.mappingNotes.trim() || null,
      mappingConfirmed: form.mappingConfirmed,
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 md:px-7 py-4 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/manager/dashboard")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Voltar ao dashboard">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-fuchsia-400" /><h1 className="font-semibold text-base">Inteligência da Carteira</h1></div>
            <p className="text-xs text-muted-foreground mt-0.5">Mapeamento Mestre e prioridade de configuração</p>
          </div>
        </div>
        <div className="flex items-center gap-2"><button onClick={() => navigate("/manager/creative-analyst")} className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors" style={{ color: "#c4b5fd", borderColor: "rgba(167,139,250,0.35)", background: "rgba(124,58,237,0.10)" }}><Sparkles className="w-3.5 h-3.5" />Creative Analyst</button><button onClick={() => { mappingsQuery.refetch(); rankingQuery.refetch(); }} disabled={mappingsQuery.isFetching || rankingQuery.isFetching} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50">{mappingsQuery.isFetching || rankingQuery.isFetching ? "Atualizando..." : "Atualizar dados"}</button></div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-7 py-6 space-y-6">
        <section className="rounded-2xl p-5 md:p-6 border" style={{ background: "linear-gradient(120deg, rgba(126,34,206,0.18), rgba(14,116,144,0.12))", borderColor: "rgba(192,132,252,0.22)" }}>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: "rgba(217,70,239,0.15)", color: "#f0abfc" }}><Sparkles className="w-3 h-3" /> Etapa 1 da IA Meta Ads</span>
              <h2 className="text-xl md:text-2xl font-semibold mt-3">Primeiro, deixamos a base confiável.</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Antes de a IA recomendar orçamento, criativos ou otimizações, confirme em cada cliente a conta Meta, o quadro Monday, o canal de captação e as metas comerciais. O ranking abaixo mostra onde falta informação.</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="px-4 py-3 rounded-xl border bg-background/40 border-border min-w-24"><div className="text-xs text-muted-foreground">Prontos</div><div className="text-2xl font-semibold text-emerald-400">{summary.ready}</div></div>
              <div className="px-4 py-3 rounded-xl border bg-background/40 border-border min-w-24"><div className="text-xs text-muted-foreground">Parciais</div><div className="text-2xl font-semibold text-amber-300">{summary.partial}</div></div>
              <div className="px-4 py-3 rounded-xl border bg-background/40 border-border min-w-24"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-semibold text-rose-400">{summary.pending}</div></div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-border flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div><h2 className="font-semibold text-sm">Ranking de Prontidão</h2><p className="text-xs text-muted-foreground mt-1">Prioriza clientes com dados de ligação ou qualidade comercial ainda incompletos.</p></div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 pl-9 pr-3 rounded-lg text-sm bg-background border border-border outline-none focus:border-fuchsia-400/60 w-full sm:w-60" placeholder="Buscar cliente ou conta" /></div>
              <div className="flex gap-1 p-1 rounded-lg bg-background border border-border">
                {(["todos", "pendente", "parcial", "pronto"] as const).map((option) => <button key={option} onClick={() => setFilter(option)} className="px-2.5 py-1 text-xs rounded-md transition-colors" style={{ background: filter === option ? "rgba(217,70,239,0.18)" : "transparent", color: filter === option ? "#f0abfc" : "#94a3b8" }}>{option === "todos" ? "Todos" : statusStyle(option).label}</button>)}
              </div>
            </div>
          </div>

          {mappingsQuery.isLoading ? <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" /></div> : (
            <div className="divide-y divide-border">
              {filteredItems.map((item, index) => {
                const style = statusStyle(item.status);
                return <button key={item.clientId} onClick={() => openEditor(item)} className="w-full text-left px-4 md:px-5 py-4 hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-center text-sm font-semibold text-muted-foreground">{String(index + 1).padStart(2, "0")}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{item.clientName}</span><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: style.color, background: style.background, border: `1px solid ${style.border}` }}>{style.label}</span></div>
                      <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground">
                        <span className={item.metaAdAccountId ? "text-emerald-400" : "text-rose-400"}>Meta {item.metaAdAccountId ? "conectada" : "pendente"}</span>
                        <span className={item.mondayBoardId ? "text-emerald-400" : "text-rose-400"}>Monday {item.mondayBoardId ? "conectado" : "pendente"}</span>
                        <span className={item.salesRecordsCount ? "text-emerald-400" : "text-amber-300"}>{item.salesRecordsCount ? `${item.salesRecordsCount} registros CRM` : "Sem registros CRM"}</span>
                      </div>
                      {item.pendingFields.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground truncate">Falta: {item.pendingFields.join(", ")}</p>}
                    </div>
                    <div className="hidden sm:flex items-center gap-3"><div className="w-24"><div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Base</span><span>{item.readiness}%</span></div><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${item.readiness}%`, background: style.color }} /></div></div><ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" /></div>
                  </div>
                </button>;
              })}
              {filteredItems.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-border flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-300" /><h2 className="font-semibold text-sm">Ranking Diário de Oportunidades</h2></div>
              <p className="text-xs text-muted-foreground mt-1">Leitura individual, sem somar moedas ou alterar campanhas. Compara o período com as metas cadastradas.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap self-start xl:self-auto">
              <button onClick={() => { const today = formatDate(new Date()); applyRankingRange(today, today); }} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:border-emerald-400/50 hover:text-emerald-300">Hoje</button>
              <button onClick={() => { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 6); applyRankingRange(formatDate(start), formatDate(end)); }} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:border-emerald-400/50 hover:text-emerald-300">7 dias</button>
              <button onClick={() => { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 29); applyRankingRange(formatDate(start), formatDate(end)); }} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:border-emerald-400/50 hover:text-emerald-300">30 dias</button>
              <div className="flex items-center gap-1.5 rounded-lg p-1.5 bg-background border border-border">
                <input type="date" value={rankingRange.from} onChange={(event) => applyRankingRange(event.target.value, rankingRange.to)} aria-label="Data inicial do ranking" className="h-7 px-1.5 rounded text-xs bg-card border border-border text-foreground outline-none focus:border-emerald-400/60" />
                <span className="text-xs text-muted-foreground">até</span>
                <input type="date" value={rankingRange.to} onChange={(event) => applyRankingRange(rankingRange.from, event.target.value)} aria-label="Data final do ranking" className="h-7 px-1.5 rounded text-xs bg-card border border-border text-foreground outline-none focus:border-emerald-400/60" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border divide-x divide-border">
            <div className="p-3 md:p-4"><span className="text-[11px] text-muted-foreground">Atenção</span><p className="mt-1 text-xl font-semibold text-rose-400">{rankingSummary.attention}</p></div>
            <div className="p-3 md:p-4"><span className="text-[11px] text-muted-foreground">Oportunidades</span><p className="mt-1 text-xl font-semibold text-emerald-400">{rankingSummary.opportunity}</p></div>
            <div className="p-3 md:p-4"><span className="text-[11px] text-muted-foreground">Estáveis</span><p className="mt-1 text-xl font-semibold text-cyan-300">{rankingSummary.stable}</p></div>
            <div className="p-3 md:p-4"><span className="text-[11px] text-muted-foreground">Sem dados</span><p className="mt-1 text-xl font-semibold text-amber-300">{rankingSummary.incomplete}</p></div>
          </div>

          {rankingQuery.isLoading ? <div className="py-16 flex flex-col items-center gap-3"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /><p className="text-xs text-muted-foreground">Lendo os dados dos clientes mapeados...</p></div> : (
            <div className="divide-y divide-border">
              {rankingItems.map((item, index) => {
                const style = rankingStyle(item.category);
                const Icon = style.icon;
                return <article key={item.clientId} className="p-4 md:p-5">
                  <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold" style={{ color: style.color, background: style.background }}>{String(index + 1).padStart(2, "0")}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-sm">{item.clientName}</h3><span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full" style={{ color: style.color, background: style.background, border: `1px solid ${style.border}` }}><Icon className="w-3 h-3" />{style.label}</span><span className="text-[11px] text-muted-foreground capitalize">Prioridade {item.priority}</span></div>
                        <p className="text-xs text-muted-foreground mt-1">{rankingRange.from.split("-").reverse().join("/")} a {rankingRange.to.split("-").reverse().join("/")} · Canal: {item.leadChannel ?? "não definido"}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
                          <div className="rounded-lg p-2.5 bg-background/50 border border-border"><span className="block text-[10px] text-muted-foreground">Investimento</span><span className="block text-sm font-semibold mt-0.5">{formatNumber(item.metrics.investimento)}</span></div>
                          <div className="rounded-lg p-2.5 bg-background/50 border border-border"><span className="block text-[10px] text-muted-foreground">Leads</span><span className="block text-sm font-semibold mt-0.5">{item.metrics.leads}</span></div>
                          <div className="rounded-lg p-2.5 bg-background/50 border border-border"><span className="block text-[10px] text-muted-foreground">CPL {item.targets.cpl ? `(meta ${formatNumber(item.targets.cpl)})` : ""}</span><span className="block text-sm font-semibold mt-0.5">{formatNumber(item.cpl)}</span></div>
                          <div className="rounded-lg p-2.5 bg-background/50 border border-border"><span className="block text-[10px] text-muted-foreground">Consultas</span><span className="block text-sm font-semibold mt-0.5">{item.metrics.consultas}</span></div>
                          <div className="rounded-lg p-2.5 bg-background/50 border border-border"><span className="block text-[10px] text-muted-foreground">ROAS {item.targets.roas ? `(meta ${formatNumber(item.targets.roas)})` : ""}</span><span className="block text-sm font-semibold mt-0.5">{formatNumber(item.roas)}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="lg:w-80 rounded-xl p-3 border" style={{ background: style.background, borderColor: style.border }}><p className="text-xs font-semibold" style={{ color: style.color }}>Leitura automática</p><p className="text-xs mt-1.5 leading-relaxed text-foreground">{item.recommendation}</p>{item.evidence.length > 0 && <div className="mt-2 pt-2 border-t" style={{ borderColor: style.border }}>{item.evidence.map((text) => <p key={text} className="text-[11px] leading-relaxed text-muted-foreground">{text}</p>)}</div>}</div>
                  </div>
                </article>;
              })}
              {rankingItems.length === 0 && <div className="py-16 px-5 text-center"><p className="text-sm text-muted-foreground">Ainda não há clientes confirmados para analisar.</p><p className="text-xs text-muted-foreground mt-1">Conclua o Mapeamento Mestre de pelo menos um cliente e volte aqui.</p></div>}
            </div>
          )}
        </section>

        <section className="grid md:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-border bg-card"><Target className="w-4 h-4 text-cyan-300 mb-2" /><h3 className="font-medium text-sm">O que a IA vai usar</h3><p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Mídia, canal de lead, CRM e metas comerciais para separar volume de resultado real.</p></div>
          <div className="p-4 rounded-xl border border-border bg-card"><Database className="w-4 h-4 text-emerald-300 mb-2" /><h3 className="font-medium text-sm">O que já vem automático</h3><p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Conta Meta conectada, Instagram, quadro Monday e presença de registros comerciais.</p></div>
          <div className="p-4 rounded-xl border border-border bg-card"><CircleAlert className="w-4 h-4 text-amber-300 mb-2" /><h3 className="font-medium text-sm">O que precisa da sua confirmação</h3><p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Canal principal, metas, observações de atendimento e confirmação final da ligação dos dados.</p></div>
        </section>
      </main>

      {selected && <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onMouseDown={() => setSelected(null)}>
        <section className="w-full max-w-xl h-full overflow-y-auto bg-card border-l border-border shadow-2xl p-5 md:p-6" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-fuchsia-300 font-semibold uppercase tracking-wider">Mapeamento Mestre</p><h2 className="text-lg font-semibold mt-1">{selected.clientName}</h2><p className="text-xs text-muted-foreground mt-1">Preencha somente o que você tem certeza. Você poderá ajustar depois.</p></div><button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button></div>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl p-3 border border-border bg-background/40 grid grid-cols-2 gap-3 text-xs"><div><span className="text-muted-foreground">Conta Meta</span><p className="mt-1 font-medium break-all">{selected.metaAdAccountId ?? "Não conectada"}</p></div><div><span className="text-muted-foreground">Registros comerciais</span><p className="mt-1 font-medium">{selected.salesRecordsCount}</p></div><div><span className="text-muted-foreground">Instagram</span><p className="mt-1 font-medium">{selected.instagramUsername ? `@${selected.instagramUsername}` : "Não conectado"}</p></div><div><span className="text-muted-foreground">Configuração</span><p className="mt-1 font-medium">{selected.readiness}% pronta</p></div></div>

            <label className="block"><span className="text-xs font-medium">ID do quadro Monday</span><input value={form.mondayBoardId} onChange={(event) => setForm({ ...form, mondayBoardId: event.target.value })} placeholder="Ex.: 7171531533" className="mt-1.5 w-full h-10 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-fuchsia-400/60" /><span className="mt-1 block text-[11px] text-muted-foreground">Use o número que aparece na URL do quadro Gestão desse cliente.</span></label>

            <label className="block"><span className="text-xs font-medium">Canal principal de captação</span><select value={form.leadChannel} onChange={(event) => setForm({ ...form, leadChannel: event.target.value })} className="mt-1.5 w-full h-10 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-fuchsia-400/60"><option value="">Selecione o canal</option>{LEAD_CHANNELS.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}</select></label>

            <div><span className="text-xs font-medium">Tipos de campanha</span><div className="mt-2 flex flex-wrap gap-2">{CAMPAIGN_TYPES.map((type) => { const active = form.campaignTypes.includes(type.id); return <button key={type.id} type="button" onClick={() => toggleCampaignType(type.id)} className="px-3 py-2 rounded-lg text-xs font-medium transition-all border" style={{ background: active ? "rgba(6,182,212,0.15)" : "transparent", color: active ? "#67e8f9" : "#94a3b8", borderColor: active ? "rgba(6,182,212,0.38)" : "rgba(148,163,184,0.2)" }}>{type.emoji} {type.label}</button>; })}</div></div>

            <div><span className="text-xs font-medium">Metas de referência</span><div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5"><label><span className="text-[11px] text-muted-foreground">CPL (R$)</span><input value={form.targetCpl} onChange={(event) => setForm({ ...form, targetCpl: event.target.value })} inputMode="decimal" placeholder="Ex.: 20" className="mt-1 w-full h-10 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-fuchsia-400/60" /></label><label><span className="text-[11px] text-muted-foreground">Custo/consulta (R$)</span><input value={form.targetCostPerConsult} onChange={(event) => setForm({ ...form, targetCostPerConsult: event.target.value })} inputMode="decimal" placeholder="Ex.: 150" className="mt-1 w-full h-10 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-fuchsia-400/60" /></label><label><span className="text-[11px] text-muted-foreground">ROAS mínimo</span><input value={form.targetRoas} onChange={(event) => setForm({ ...form, targetRoas: event.target.value })} inputMode="decimal" placeholder="Ex.: 2,5" className="mt-1 w-full h-10 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-fuchsia-400/60" /></label></div></div>

            <label className="block"><span className="text-xs font-medium">Contexto de qualidade comercial</span><textarea value={form.mappingNotes} onChange={(event) => setForm({ ...form, mappingNotes: event.target.value })} placeholder="Ex.: lead ideal, gargalo no atendimento, procedimento prioritário, observações de equipe..." rows={5} className="mt-1.5 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-fuchsia-400/60 resize-y" /></label>

            <button type="button" onClick={() => setForm({ ...form, mappingConfirmed: !form.mappingConfirmed })} className="w-full flex items-start gap-3 text-left p-3 rounded-xl border transition-colors" style={{ borderColor: form.mappingConfirmed ? "rgba(16,185,129,0.38)" : "rgba(148,163,184,0.2)", background: form.mappingConfirmed ? "rgba(16,185,129,0.08)" : "transparent" }}><CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: form.mappingConfirmed ? "#34d399" : "#64748b" }} /><span><span className="block text-sm font-medium">Confirmo que este mapeamento está correto</span><span className="block mt-0.5 text-xs text-muted-foreground">A IA poderá usar essa configuração como contexto nas próximas análises.</span></span></button>
          </div>

          <div className="sticky bottom-0 mt-6 pt-4 bg-card border-t border-border flex gap-2"><button onClick={() => setSelected(null)} className="flex-1 h-10 rounded-lg text-sm border border-border hover:bg-muted">Cancelar</button><button onClick={handleSave} disabled={saveMapping.isPending} className="flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ background: "#c026d3", color: "white", opacity: saveMapping.isPending ? 0.65 : 1 }}><Save className="w-4 h-4" />{saveMapping.isPending ? "Salvando..." : "Salvar mapeamento"}</button></div>
        </section>
      </div>}
    </div>
  );
}
