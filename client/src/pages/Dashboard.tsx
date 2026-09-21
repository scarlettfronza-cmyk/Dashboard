import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { toast } from "sonner";
import { ReportModal } from "@/components/ReportModal";
import {
  RefreshCw, FileText, Settings, TrendingUp, TrendingDown, Minus, Instagram, Sparkles, Users,
  Heart, MessageCircle, Share2, Bookmark, Eye, Clock, ExternalLink, Search,
  DollarSign, Target, BarChart2, ShoppingCart, Star, UserPlus, MousePointer, Zap, Sun, Moon
} from "lucide-react";
import { ReportChatPanel } from "@/components/ReportChatPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CampanhasSplit {
  mensagens: { investimento: number; leads: number; custoPorLead: number };
  visitas: { investimento: number; alcance: number; custoPorVisita: number };
  formulario: { investimento: number; cliques: number; custoPorClique: number };
}

interface KpiData {
  investimento: number;
  leads: number;
  consultas?: number;
  vendas: number;
  totalEmVendas: number;
  totalCirurgias?: number;
  totalConsultas?: number;
  novosSeguidores: number;
  alcance?: number;
  cliquesEstimados?: number;
  custoPorClique?: number;
  custoPorLeadDireto?: number;
  campanhas?: CampanhasSplit;
  custoPorLead: number;
  taxaConversao: number;
  roas: number;
  custoPorVenda: number;
  custoPorConsulta: number;
  ticketMedio: number;
  // New messaging metrics
  novosContatos?: number;
  totalContatosMeta?: number;
  conversasRespondidas?: number;
  leadsInstagram?: number;
  leadsWhatsapp?: number;
}

interface DateRange {
  from: string;
  to: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function formatNumber(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v);
}
function formatNumberShort(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}
function formatPercent(v: number) {
  return `${v.toFixed(2)}%`;
}
function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function getDefaultRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  "fechado": "#16a34a",
  "agendado": "#2563eb",
  "compareceu": "#0891b2",
  "perdido": "#dc2626",
  "cancelado": "#ea580c",
  "não compareceu": "#ea580c",
  "em atendimento": "#d97706",
  "aguardando": "#ca8a04",
};
function getStatusColor(status: string) {
  const s = status.toLowerCase();
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (s.includes(key)) return color;
  }
  return "#6b7280";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ElementType;
  gradient?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`kpi-card flex flex-col gap-2 p-4 ${alert ? "ring-1 ring-amber-400/30" : ""}`}
      style={gradient ? { background: gradient, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" } : {}}
    >
      {Icon && (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={gradient
            ? { background: "rgba(255,255,255,0.2)" }
            : { background: "rgba(230,57,70,0.12)" }
          }
        >
          <Icon className="w-4 h-4" style={{ color: gradient ? "white" : "#E63946" }} />
        </div>
      )}
      <div>
        <div
          className="text-xs font-medium tracking-wide uppercase leading-tight"
          style={{ color: gradient ? "rgba(255,255,255,0.75)" : "oklch(0.70 0.010 30)" }}
        >
          {label}
        </div>
        <div
          className="text-xl font-bold tracking-tight leading-tight mt-0.5"
          style={{ color: gradient ? "white" : "oklch(0.95 0.005 30)" }}
        >
          {value}
        </div>
        {sub && (
          <div className="text-xs mt-0.5" style={{ color: gradient ? "rgba(255,255,255,0.65)" : "oklch(0.70 0.010 30)" }}>
            {sub}
          </div>
        )}
        {alert && (
          <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
            <TrendingDown className="w-3 h-3" />
            <span>Atenção</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <span className="text-sm font-semibold tracking-wide text-foreground">
        {title}
      </span>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(230,57,70,0.12)", color: "#E63946" }}>
          {badge}
        </span>
      )}
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────
function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const presets = [
    { label: "Hoje", fn: () => { const t = new Date().toISOString().slice(0, 10); return { from: t, to: t }; } },
    { label: "7 dias", fn: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 6); return { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) }; } },
    { label: "30 dias", fn: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 29); return { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) }; } },
    { label: "Mês", fn: () => { const t = new Date(); const firstDay = new Date(t.getFullYear(), t.getMonth() - 1, 1); const lastDay = new Date(t.getFullYear(), t.getMonth(), 0); return { from: firstDay.toISOString().slice(0, 10), to: lastDay.toISOString().slice(0, 10) }; } },
    { label: "3 meses", fn: () => { const t = new Date(); const f = new Date(t); f.setMonth(f.getMonth() - 3); return { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) }; } },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => onChange(p.fn())}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all border border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5 text-muted-foreground"
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 text-xs ml-1">
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50"
        />
        <span className="text-muted-foreground">→</span>
        <input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50"
        />
      </div>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="text-xs p-3 rounded-xl shadow-xl bg-card border border-border text-foreground">
      <div className="font-semibold mb-1.5 text-muted-foreground">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}: {typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Lead Row ────────────────────────────────────────────────────────────────
function LeadRow({ lead }: { lead: any }) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5 text-sm font-medium text-foreground">{lead.name || "—"}</td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">{lead.phone || "—"}</td>
      <td className="px-3 py-2.5">
        {lead.status ? (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `${getStatusColor(lead.status)}18`,
              color: getStatusColor(lead.status),
              border: `1px solid ${getStatusColor(lead.status)}40`
            }}
          >
            {lead.status}
          </span>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{lead.origin || "—"}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{lead.service || "—"}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{lead.consultDate ? formatDate(lead.consultDate) : "—"}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{lead.groupName || "—"}</td>
    </tr>
  );
}

// ─── Post Card ───────────────────────────────────────────────────────────────
function PostCard({ post }: { post: any }) {
  const ins = post.insights ?? {};
  const isReel = post.mediaType === "VIDEO";
  const thumb = post.thumbnailUrl ?? post.mediaUrl;

  return (
    <div className="kpi-card overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-muted overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="post" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Instagram className="w-8 h-8" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: isReel ? "rgba(230,57,70,0.85)" : "oklch(0.55 0.22 25 / 0.85)" }}
          >
            {isReel ? "REEL" : post.mediaType === "CAROUSEL_ALBUM" ? "CARROSSEL" : "FOTO"}
          </span>
        </div>
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
        >
          <ExternalLink className="w-3 h-3 text-white" />
        </a>
      </div>
      <div className="px-3 pt-2 pb-1">
        <p className="text-xs line-clamp-2 text-muted-foreground">{post.caption || "Sem legenda"}</p>
        <p className="text-xs mt-1 text-muted-foreground/60">{formatDate(post.timestamp)}</p>
      </div>
      <div className="px-3 pb-3 mt-auto">
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {isReel && ins.views != null && (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 bg-muted/50">
              <Eye className="w-3 h-3 text-primary" />
              <span className="text-xs font-bold text-foreground">{formatNumberShort(ins.views)}</span>
              <span className="text-[10px] text-muted-foreground">views</span>
            </div>
          )}
          {!isReel && ins.reach != null && (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 bg-muted/50">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-xs font-bold text-foreground">{formatNumberShort(ins.reach)}</span>
              <span className="text-[10px] text-muted-foreground">reach</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 bg-muted/50">
            <Heart className="w-3 h-3 text-rose-500" />
            <span className="text-xs font-bold text-foreground">{formatNumberShort(ins.likes ?? 0)}</span>
            <span className="text-[10px] text-muted-foreground">likes</span>
          </div>
          {ins.shares != null && ins.shares > 0 ? (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 bg-muted/50">
              <Share2 className="w-3 h-3 text-emerald-500" />
              <span className="text-xs font-bold text-foreground">{formatNumberShort(ins.shares)}</span>
              <span className="text-[10px] text-muted-foreground">shares</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 bg-muted/50">
              <MessageCircle className="w-3 h-3 text-amber-500" />
              <span className="text-xs font-bold text-foreground">{formatNumberShort(ins.comments ?? 0)}</span>
              <span className="text-[10px] text-muted-foreground">coment.</span>
            </div>
          )}
          {isReel && ins.ig_reels_avg_watch_time != null && (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 col-span-3 bg-muted/50">
              <Clock className="w-3 h-3 text-violet-500" />
              <span className="text-xs font-bold text-foreground">{formatTime(ins.ig_reels_avg_watch_time)}</span>
              <span className="text-[10px] text-muted-foreground">tempo médio</span>
            </div>
          )}
          {ins.saved != null && ins.saved > 0 && (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 bg-muted/50">
              <Bookmark className="w-3 h-3 text-cyan-500" />
              <span className="text-xs font-bold text-foreground">{formatNumberShort(ins.saved)}</span>
              <span className="text-[10px] text-muted-foreground">salvos</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const [refreshing, setRefreshing] = useState(false);
  const [mondaySyncingAll, setMondaySyncingAll] = useState(false);
  const [activeClient, setActiveClient] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"report" | "chat">("report");
  const [reportAnalysis, setReportAnalysis] = useState<string | null>(null);
  const [reportAnalysisLoading, setReportAnalysisLoading] = useState(false);
  const [showClientSidebar, setShowClientSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState<"kpis" | "crm" | "conteudos" | "criativos">("kpis");

  // CRM state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [crmDateField, setCrmDateField] = useState<"any" | "consult" | "conversion">("any");
  const [crmDateFrom, setCrmDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [crmDateTo, setCrmDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [isAuthenticated, authLoading, navigate]);

  const { data: clients } = trpc.dashboard.getClients.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (clients && clients.length > 0 && !activeClient) setActiveClient(clients[0].id);
  }, [clients, activeClient]);

  useEffect(() => {
    setSearchTerm("");
    setStatusFilter("");
    setOriginFilter("");
    setCrmDateField("any");
    const now = new Date();
    setCrmDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
    setCrmDateTo(now.toISOString().slice(0, 10));
  }, [activeClient]);

  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpi } = trpc.dashboard.getKpis.useQuery(
    { clientId: activeClient!, from: dateRange.from, to: dateRange.to },
    { enabled: !!activeClient && isAuthenticated }
  );

  const { data: trendData } = trpc.dashboard.getTrends.useQuery(
    { clientId: activeClient! },
    { enabled: !!activeClient && isAuthenticated }
  );
  const { data: igInsights } = trpc.instagram.getInsights.useQuery(
    { clientId: activeClient!, since: dateRange.from, until: dateRange.to },
    { enabled: !!activeClient && isAuthenticated }
  );

  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = (trpc as any).crm.getLeads.useQuery(
    {
      clientId: activeClient!,
      status: statusFilter || undefined,
      search: searchTerm || undefined,
      dateFrom: crmDateFrom || undefined,
      dateTo: crmDateTo || undefined,
      dateField: crmDateField,
    },
    { enabled: !!activeClient && isAuthenticated && activeTab === "crm" }
  );

  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = (trpc as any).crm.getTopPosts.useQuery(
    { clientId: activeClient!, limit: 20 },
    { enabled: !!activeClient && isAuthenticated && activeTab === "conteudos" }
  );

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - tRPC type inference limit exceeded (>34 procedures)
  const { data: creativesData, isLoading: creativesLoading, refetch: refetchCreatives } = (trpc.dashboard as any).getCreatives.useQuery(
    { clientId: activeClient!, from: dateRange.from, to: dateRange.to },
    { enabled: !!activeClient && isAuthenticated && activeTab === "criativos" }
  );

  const filteredLeads = useMemo(() => {
    if (!leadsData?.leads) return [];
    if (!originFilter) return leadsData.leads;
    return leadsData.leads.filter((l: any) => l.origin.toLowerCase().includes(originFilter.toLowerCase()));
  }, [leadsData?.leads, originFilter]);

  const uniqueStatuses = useMemo(() => {
    if (!leadsData?.byStatus) return [];
    return Object.keys(leadsData.byStatus).sort();
  }, [leadsData?.byStatus]);

  const uniqueOrigins = useMemo(() => {
    if (!leadsData?.byOrigin) return [];
    return Object.keys(leadsData.byOrigin).sort();
  }, [leadsData?.byOrigin]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchKpi();
      toast.success("Dados sincronizados com sucesso");
    } catch {
      toast.error("Falha na sincronização");
    } finally {
      setRefreshing(false);
    }
  };

  const mondayAutoSyncMutation = trpc.monday.syncBoard.useMutation();
  const generateReportMutation = trpc.dashboard.generateReport.useMutation();
  const [mondayAutoSyncing, setMondayAutoSyncing] = useState(false);

  const { data: autoSyncStatus } = trpc.system.getMondayAutoSyncStatus.useQuery(
    undefined,
    { refetchInterval: 60_000 }
  );

  function formatLastSync(ts: number | null | undefined): string {
    if (!ts) return "Nunca";
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "Agora mesmo";
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `há ${diffH}h`;
    return new Date(ts).toLocaleDateString("pt-BR");
  }

  useEffect(() => {
    if (!activeClient || !clients) return;
    const client = clients.find((c) => c.id === activeClient);
    if (!client?.mondayBoardId) return;
    setMondayAutoSyncing(true);
    mondayAutoSyncMutation.mutate(
      {
        clientId: activeClient,
        boardId: client.mondayBoardId,
        startDate: new Date(dateRange.from + "T00:00:00"),
        endDate: new Date(dateRange.to + "T23:59:59"),
      },
      {
        onSuccess: (data) => {
          setMondayAutoSyncing(false);
          if (!data.reason) utils.dashboard.getKpis.invalidate();
        },
        onError: () => setMondayAutoSyncing(false),
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient, dateRange.from, dateRange.to]);

  const handleMondaySyncClient = async () => {
    if (!activeClient) return;
    const client = clients?.find((c) => c.id === activeClient);
    if (!client?.mondayBoardId) { toast.error("Este cliente não tem Monday.com configurado."); return; }
    setMondaySyncingAll(true);
    const toastId = toast.loading(`Sincronizando Monday.com de ${client.name}...`);
    try {
      const result = await mondayAutoSyncMutation.mutateAsync({
        clientId: activeClient,
        boardId: client.mondayBoardId,
        startDate: new Date(dateRange.from + "T00:00:00"),
        endDate: new Date(dateRange.to + "T23:59:59"),
      });
      toast.dismiss(toastId);
      if (result.reason) {
        toast.info(`Monday.com: ${result.reason}`);
      } else {
        toast.success(`Monday.com sincronizado! ${result.synced ?? 0} registros atualizados.`);
        await utils.dashboard.getKpis.invalidate();
      }
    } catch (err: unknown) {
      toast.dismiss(toastId);
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("timeout") || msg.includes("504") || msg.includes("Gateway")) {
        toast.error("Sincronização demorou demais (timeout). O board tem muitos itens. Tente novamente ou use um período menor.", { duration: 6000 });
      } else {
        toast.error("Falha ao sincronizar Monday.com: " + (msg || "erro desconhecido"));
      }
    } finally {
      setMondaySyncingAll(false);
    }
  };

  const utils = trpc.useUtils();

  const kpi: KpiData = useMemo(() => {
    const d = (kpiData ?? { investimento: 0, leads: 0, vendas: 0, totalEmVendas: 0, novosSeguidores: 0 }) as Partial<KpiData> & { investimento: number; leads: number; vendas: number; totalEmVendas: number; novosSeguidores: number };
    return {
      ...d,
      custoPorLead: (d.custoPorLeadDireto ?? 0) > 0 ? (d.custoPorLeadDireto ?? 0) : (d.leads > 0 ? d.investimento / d.leads : 0),
      taxaConversao: (d.taxaConversao !== undefined && d.taxaConversao > 0) ? d.taxaConversao : (d.leads > 0 ? ((d.consultas ?? 0) / d.leads) * 100 : 0),
      roas: d.roas !== undefined ? d.roas : (d.investimento > 0 ? ((d.totalConsultas ?? d.totalEmVendas) + (d.totalCirurgias ?? 0)) / d.investimento : 0),
      custoPorVenda: (d.custoPorVenda !== undefined && d.custoPorVenda > 0) ? d.custoPorVenda : (d.vendas > 0 ? d.investimento / d.vendas : 0),
      custoPorConsulta: (d.custoPorConsulta !== undefined && d.custoPorConsulta > 0) ? d.custoPorConsulta : ((d.consultas ?? 0) > 0 ? d.investimento / (d.consultas ?? 1) : 0),
      ticketMedio: (d.ticketMedio !== undefined && d.ticketMedio > 0) ? d.ticketMedio : ((d.consultas ?? 0) > 0 ? ((d.totalConsultas ?? d.totalEmVendas) + (d.totalCirurgias ?? 0)) / (d.consultas ?? 1) : 0),
    };
  }, [kpiData]);

  const activeClientName = clients?.find((c) => c.id === activeClient)?.name ?? "Cliente";
  const activeClientToken = clients?.find((c) => c.id === activeClient)?.publicToken;
  const activeClientWhatsappGroupId = clients?.find((c) => c.id === activeClient)?.whatsappGroupId;
  const activeClientCampaignTypesRaw = clients?.find((c) => c.id === activeClient)?.campaignTypes;
  const activeClientCampaignTypes: string[] = (() => {
    try { return activeClientCampaignTypesRaw ? JSON.parse(activeClientCampaignTypesRaw) : []; } catch { return []; }
  })();
  const CAMPAIGN_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
    lead: { label: "Engajamento / Lead", emoji: "🎯", color: "oklch(0.60 0.18 240 / 0.18)" },
    profile_visit: { label: "Visitas ao Perfil", emoji: "👤", color: "oklch(0.72 0.18 145 / 0.18)" },
    awareness: { label: "Reconhecimento", emoji: "📢", color: "oklch(0.75 0.18 60 / 0.18)" },
  };
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const sendWhatsappReport = trpc.whatsapp.sendReport.useMutation({
    onSuccess: () => { toast.success("Relatório enviado no WhatsApp!"); setSendingWhatsapp(false); },
    onError: (e: any) => { toast.error(e.message || "Erro ao enviar WhatsApp"); setSendingWhatsapp(false); },
  });
  const handleSendWhatsapp = () => {
    if (!activeClient || !activeClientWhatsappGroupId) {
      toast.error("Grupo de WhatsApp não configurado. Configure nas Configurações do cliente.");
      return;
    }
    setSendingWhatsapp(true);
    sendWhatsappReport.mutate({
      clientId: activeClient,
      from: dateRange.from,
      to: dateRange.to,
      reportText: reportAnalysis || undefined,
      origin: window.location.origin,
    });
  };

  // Auto-generate analysis when right panel is open on report tab
  useEffect(() => {
    if (!showRightPanel || rightPanelTab !== 'report' || !activeClient) return;
    setReportAnalysis(null);
    setReportAnalysisLoading(true);
    generateReportMutation.mutate(
      { clientId: activeClient, from: dateRange.from, to: dateRange.to, clientName: activeClientName },
      {
        onSuccess: (data) => { setReportAnalysis(data.analysis); setReportAnalysisLoading(false); },
        onError: () => { setReportAnalysis(null); setReportAnalysisLoading(false); },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRightPanel, rightPanelTab, activeClient, dateRange.from, dateRange.to]);

  const copyPublicLink = () => {
    if (!activeClientToken) { toast.error("Este cliente não tem link público configurado."); return; }
    const url = `${window.location.origin}/r/${activeClientToken}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copiado: " + url));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm font-medium text-primary animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 md:px-6 py-3 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile hamburger for client sidebar */}
          <button
            onClick={() => setShowClientSidebar(o => !o)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
            aria-label="Clientes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="w-2 h-2 rounded-full bg-emerald-500 status-online" />
          <span className="text-sm md:text-base font-bold tracking-tight text-foreground">ADS</span>
          <span className="hidden md:inline text-base font-bold tracking-tight text-foreground">Dashboard</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(230,57,70,0.12)", color: "#E63946" }}>
            {activeClientName}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Monday Sync — hidden on mobile */}
          <button
            onClick={handleMondaySyncClient}
            disabled={mondaySyncingAll || mondayAutoSyncing}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-60" style={{ background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(mondaySyncingAll || mondayAutoSyncing) ? "animate-spin" : ""}`} />
            {(mondaySyncingAll || mondayAutoSyncing) ? "Monday..." : "🟣 Monday"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all" style={{ background: 'rgba(255,255,255,0.08)', color: 'oklch(0.78 0.01 60)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Sincronizando..." : "Sincronizar"}
          </button>
          {activeClientToken && (
            <>
              <button
                onClick={() => window.open(`/r/${activeClientToken}`, "_blank")}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all" style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.4)' }}
                title="Ver Relatório"
              >
                <span className="hidden sm:inline">📊 Ver Relatório</span>
                <span className="sm:hidden">📊</span>
              </button>
              <button
                onClick={copyPublicLink}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all" style={{ background: 'rgba(6,182,212,0.18)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.4)' }}
              >
                🔗 Copiar Link
              </button>
              <button
                onClick={handleSendWhatsapp}
                disabled={sendingWhatsapp}
                title={activeClientWhatsappGroupId ? "Enviar relatório no grupo de WhatsApp" : "Configure o grupo de WhatsApp nas configurações"}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: activeClientWhatsappGroupId ? 'rgba(37,211,102,0.18)' : 'rgba(255,255,255,0.06)',
                  color: activeClientWhatsappGroupId ? '#25D366' : 'oklch(0.45 0.010 240)',
                  border: activeClientWhatsappGroupId ? '1px solid rgba(37,211,102,0.4)' : '1px solid rgba(255,255,255,0.12)',
                  opacity: sendingWhatsapp ? 0.7 : 1,
                  cursor: sendingWhatsapp ? 'not-allowed' : 'pointer',
                }}
              >
                {sendingWhatsapp ? (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : <span>💬</span>}
                <span className="hidden sm:inline">{sendingWhatsapp ? 'Enviando...' : 'WhatsApp'}</span>
              </button>
            </>
          )}
          {activeClient && (
            <button
              onClick={() => setShowRightPanel(p => !p)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: showRightPanel ? 'rgba(230,57,70,0.28)' : 'rgba(230,57,70,0.15)',
                color: '#ff8a94',
                border: `1px solid rgba(230,57,70,${showRightPanel ? '0.55' : '0.38'})`,
              }}
              title={showRightPanel ? 'Fechar painel' : 'Abrir relatório + IA'}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {showRightPanel ? 'Fechar' : 'IA + Relatório'}
            </button>
          )}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-80"
              style={{ background: theme === 'dark' ? 'rgba(250,204,21,0.15)' : 'rgba(99,102,241,0.15)', color: theme === 'dark' ? '#fbbf24' : '#818cf8', border: `1px solid ${theme === 'dark' ? 'rgba(250,204,21,0.3)' : 'rgba(99,102,241,0.3)'}` }}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

        </div>
      </header>



      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay for client sidebar */}
        {showClientSidebar && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setShowClientSidebar(false)}
          />
        )}
        {/* Client Sidebar */}
        <aside className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-auto
          w-52 flex-shrink-0 flex flex-col border-r border-border bg-card
          transition-transform duration-300 ease-in-out
          ${showClientSidebar ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}>
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Clientes
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {clients?.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveClient(c.id); setShowClientSidebar(false); }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium transition-all rounded-none"
                style={{
                  color: activeClient === c.id ? "#E63946" : "oklch(0.60 0.010 30)",
                  background: activeClient === c.id ? "rgba(230,57,70,0.08)" : "transparent",
                  borderLeft: activeClient === c.id ? "2px solid #E63946" : "2px solid transparent",
                }}
              >
                {c.name}
              </button>
            ))}
            {(!clients || clients.length === 0) && (
              <div className="px-4 py-3 text-xs text-muted-foreground">Nenhum cliente</div>
            )}
          </div>
          <div className="p-3 border-t border-border flex flex-col gap-2">
            <button
              onClick={() => navigate("/settings")}
              className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all text-primary border border-primary/30 hover:bg-primary/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
              Novo Cliente
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all text-muted-foreground border border-border hover:text-foreground hover:border-primary/30 hover:bg-muted/50"
            >
              <Settings className="w-3.5 h-3.5" />
              Configurações
            </button>
          </div>
        </aside>

        {/* Main Content — split view */}
        <div className="flex-1 overflow-hidden flex flex-row">
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Date range + Tabs bar */}
          <div className="px-3 md:px-6 pt-3 pb-0 border-b border-border bg-card/50">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <div className="text-xs text-muted-foreground">
                {dateRange.from} → {dateRange.to}
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {[
                { id: "kpis" as const, label: "Dashboard", icon: "📊" },
                { id: "crm" as const, label: "CRM", icon: "👥", count: leadsData?.total },
                { id: "conteudos" as const, label: "Conteúdos", icon: "📸" },
                { id: "criativos" as const, label: "Criativos", icon: "🎨" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-xs md:text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0"
                  style={{
                    color: activeTab === tab.id ? "#E63946" : "oklch(0.65 0.010 30)",
                    borderColor: activeTab === tab.id ? "#E63946" : "transparent",
                    background: "transparent",
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.count != null && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(230,57,70,0.12)", color: "#E63946" }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3 md:p-6 flex flex-col gap-4 md:gap-6">

            {/* ═══════════════ TAB: DASHBOARD (KPIs) ═══════════════ */}
            {activeTab === "kpis" && (
              <>
                {/* KPI Grid */}
                {kpiLoading ? (
                  <>
                    <SectionHeader title="Principais Indicadores" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="kpi-card animate-pulse h-24" />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
            <div className="flex items-center gap-3 mb-1">
              <SectionHeader title="Principais Indicadores" badge="AO VIVO" />
              {activeClientCampaignTypes.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {activeClientCampaignTypes.map((type) => {
                    const info = CAMPAIGN_TYPE_LABELS[type];
                    if (!info) return null;
                    return (
                      <span key={type} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: info.color, color: "oklch(0.85 0.010 240)", border: "1px solid oklch(0.40 0.010 240 / 0.3)" }}
                      >
                        <span>{info.emoji}</span>
                        <span>{info.label}</span>
                      </span>
                    );
                  })}
                </div>
              )}
                      {mondayAutoSyncing && (
                        <span className="flex items-center gap-1.5 text-xs text-violet-600 animate-pulse">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Atualizando Monday...
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground" title={autoSyncStatus?.lastSync ? `Última sincronização automática do Monday: ${new Date(autoSyncStatus.lastSync).toLocaleString('pt-BR')}` : 'Monday ainda não foi sincronizado automaticamente'}>
                        🟣 Monday: {formatLastSync(autoSyncStatus?.lastSync)}
                      </span>
                    </div>

                    {/* Primary KPI row — gradient cards (2 linhas de 3) */}
                    <div className="grid grid-cols-3 gap-3">
                      <KpiCard
                        label="Investimento"
                        value={formatCurrency(kpi.investimento)}
                        icon={DollarSign}
                        gradient="linear-gradient(135deg, #E63946, #c1121f)"
                      />
                      <KpiCard
                        label="Leads"
                        value={formatNumber(kpi.leads)}
                        icon={Users}
                        gradient="linear-gradient(135deg, #c1121f, #a10f1a)"
                      />
                      <KpiCard
                        label="Custo por Lead"
                        value={formatCurrency(kpi.custoPorLead)}
                        icon={Target}
                        gradient={kpi.custoPorLead > 100
                          ? "linear-gradient(135deg, oklch(0.65 0.18 55), oklch(0.72 0.16 65))"
                          : "linear-gradient(135deg, #E63946, #c1121f)"}
                        alert={kpi.custoPorLead > 100}
                      />
                      <KpiCard
                        label="Taxa de Conversão"
                        value={formatPercent(kpi.taxaConversao)}
                        sub="Leads → Consultas"
                        icon={TrendingUp}
                        gradient="linear-gradient(135deg, #E63946, #c1121f)"
                      />
                      <KpiCard
                        label="ROAS"
                        value={kpi.roas.toFixed(2)}
                        icon={BarChart2}
                        gradient={kpi.roas < 2 && kpi.investimento > 0
                          ? "linear-gradient(135deg, oklch(0.55 0.22 20), oklch(0.60 0.22 35))"
                          : "linear-gradient(135deg, #E63946, #c1121f)"}
                        alert={kpi.roas < 2 && kpi.investimento > 0}
                      />
                      <KpiCard
                        label="Consultas"
                        value={formatNumber(kpi.consultas ?? 0)}
                        icon={Star}
                        gradient="linear-gradient(135deg, #E63946, #c1121f)"
                      />
                    </div>

                    {/* Secondary KPI row — white cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <KpiCard label="Fechamentos" value={formatNumber(kpi.vendas)} icon={ShoppingCart} />
                      {(kpi.consultas ?? 0) > 0 ? (
                        <KpiCard label="Custo por Consulta" value={formatCurrency(kpi.custoPorConsulta)} icon={MousePointer} />
                      ) : (
                        <KpiCard label="Custo por Venda" value={formatCurrency(kpi.custoPorVenda)} icon={MousePointer} />
                      )}
                      {(kpi.totalCirurgias ?? 0) > 0 ? (
                        <>
                          <KpiCard label="Total em Consultas" value={formatCurrency(kpi.totalEmVendas)} icon={DollarSign} />
                          <KpiCard label="Total em Fechamentos" value={formatCurrency(kpi.totalCirurgias ?? 0)} icon={DollarSign} />
                          <KpiCard label="Total Geral" value={formatCurrency(kpi.totalEmVendas + (kpi.totalCirurgias ?? 0))} icon={Zap} />
                        </>
                      ) : (
                        <KpiCard label="Total em Vendas" value={formatCurrency(kpi.totalEmVendas)} icon={DollarSign} />
                      )}
                      <KpiCard label="Ticket Médio" value={formatCurrency(kpi.ticketMedio)} icon={Star} />
                      {(kpi.alcance ?? 0) > 0 && (
                        <KpiCard label="Alcance" value={formatNumber(kpi.alcance ?? 0)} icon={Eye} />
                      )}
                      {(kpi.cliquesEstimados ?? 0) > 0 && (
                        <KpiCard label="Cliques no Link" value={formatNumber(kpi.cliquesEstimados ?? 0)} icon={MousePointer} />
                      )}
                      {(kpi.custoPorClique ?? 0) > 0 && (
                        <KpiCard label="Custo por Clique" value={formatCurrency(kpi.custoPorClique ?? 0)} icon={Target} />
                      )}
                      {(kpi.novosSeguidores ?? 0) > 0 && !(igInsights?.connected && (igInsights.totals?.newFollowers ?? 0) > 0) && (
                        <KpiCard label="Novos Seguidores" value={formatNumber(kpi.novosSeguidores ?? 0)} icon={UserPlus} />
                      )}
                      {/* Messaging destination breakdown */}
                      {((kpi.leadsInstagram ?? 0) > 0 || (kpi.leadsWhatsapp ?? 0) > 0) && (
                        <>
                          {(kpi.leadsInstagram ?? 0) > 0 && (
                            <KpiCard label="Leads → Instagram" value={formatNumber(kpi.leadsInstagram ?? 0)} icon={Instagram} />
                          )}
                          {(kpi.leadsWhatsapp ?? 0) > 0 && (
                            <KpiCard label="Leads → WhatsApp" value={formatNumber(kpi.leadsWhatsapp ?? 0)} icon={MessageCircle} />
                          )}
                        </>
                      )}
                      {(kpi.novosContatos ?? 0) > 0 && (
                        <KpiCard label="Novos Contatos" value={formatNumber(kpi.novosContatos ?? 0)} icon={UserPlus} sub="Primeiro contato via anúncio" />
                      )}
                      {(kpi.totalContatosMeta ?? 0) > 0 && (
                        <KpiCard label="Total de Contatos" value={formatNumber(kpi.totalContatosMeta ?? 0)} icon={Users} sub="Total de interações via mensagem" />
                      )}
                      {(kpi.conversasRespondidas ?? 0) > 0 && (
                        <KpiCard label="Conversas Respondidas" value={formatNumber(kpi.conversasRespondidas ?? 0)} icon={MessageCircle} />
                      )}
                      {igInsights?.connected && (() => {
                        const igEngaged = igInsights.totals?.interactions ?? 0;
                        const igProfileViews = igInsights.totals?.profileViews ?? 0;
                        const igFollows = igInsights.totals?.newFollowers ?? 0;
                        const igFollowers = igInsights.totalFollowers ?? 0;
                        return (
                          <>
                            {igEngaged > 0 && <KpiCard label="Contas Engajadas" value={formatNumber(igEngaged)} icon={Heart} />}
                            {igProfileViews > 0 && <KpiCard label="Visitas ao Perfil" value={formatNumber(igProfileViews)} icon={Eye} />}
                            {igFollows > 0 && <KpiCard label="Novos Seguidores" value={formatNumber(igFollows)} icon={UserPlus} />}
                            {igFollowers > 0 && <KpiCard label="Total Seguidores" value={formatNumber(igFollowers)} icon={Users} />}
                          </>
                        );
                      })()}
                    </div>

                    {/* Campaign breakdown */}
                    {kpi.campanhas && (
                      <>
                        <SectionHeader title="Breakdown por Tipo de Campanha" />
                        <div className="flex gap-6 flex-wrap">
                          {kpi.campanhas.mensagens.investimento > 0 && (
                            <div className="shrink-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-muted-foreground">💬 Mensagens (WPP)</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <KpiCard label="Investimento" value={formatCurrency(kpi.campanhas.mensagens.investimento)} icon={DollarSign} gradient="linear-gradient(135deg, #E63946, #c1121f)" />
                                <KpiCard label="Leads" value={formatNumber(kpi.campanhas.mensagens.leads)} icon={Users} />
                                <KpiCard label="Custo/Lead" value={formatCurrency(kpi.campanhas.mensagens.custoPorLead)} icon={Target} alert={kpi.campanhas.mensagens.custoPorLead > 100} />
                              </div>
                            </div>
                          )}
                          {kpi.campanhas.visitas.investimento > 0 && (
                            <div className="shrink-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-muted-foreground">👁 Visitas ao Perfil</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <KpiCard label="Investimento" value={formatCurrency(kpi.campanhas.visitas.investimento)} icon={DollarSign} gradient="linear-gradient(135deg, #E63946, #c1121f)" />
                                <KpiCard label="Alcance" value={formatNumber(kpi.campanhas.visitas.alcance)} icon={Eye} />
                                {kpi.campanhas.visitas.custoPorVisita > 0 ? (
                                  <KpiCard label="Custo/Visita" value={formatCurrency(kpi.campanhas.visitas.custoPorVisita)} icon={Target} />
                                ) : <div />}
                              </div>
                            </div>
                          )}
                          {kpi.campanhas.formulario.investimento > 0 && (
                            <div className="shrink-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-muted-foreground">🔗 Formulário / Link</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <KpiCard label="Investimento" value={formatCurrency(kpi.campanhas.formulario.investimento)} icon={DollarSign} gradient="linear-gradient(135deg, #E63946, #c1121f)" />
                                <KpiCard label="Cliques" value={formatNumber(kpi.campanhas.formulario.cliques)} icon={MousePointer} />
                                {kpi.campanhas.formulario.custoPorClique > 0 ? (
                                  <KpiCard label="Custo/Clique" value={formatCurrency(kpi.campanhas.formulario.custoPorClique)} icon={Target} />
                                ) : <div />}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Charts */}
                    {trendData && trendData.length > 0 && (
                      <>
                        <SectionHeader title="Tendências Históricas" />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="kpi-card p-5">
                            <div className="text-xs font-semibold uppercase tracking-wide mb-4 text-muted-foreground">
                              Investimento vs Vendas
                            </div>
                            <ResponsiveContainer width="100%" height={180}>
                              <AreaChart data={trendData}>
                                <defs>
                                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#E63946" stopOpacity={0.20} />
                                    <stop offset="95%" stopColor="#E63946" stopOpacity={0} />
                                  </linearGradient>
                                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#E63946" stopOpacity={0.20} />
                                    <stop offset="95%" stopColor="#E63946" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 6" stroke="oklch(0.20 0.008 20)" />
                                <XAxis dataKey="date" tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 10 }} />
                                <YAxis tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 10 }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="investimento" name="Investimento" stroke="oklch(0.55 0.22 25)" fill="url(#gradBlue)" strokeWidth={2} />
                                <Area type="monotone" dataKey="totalEmVendas" name="Total Vendas" stroke="#E63946" fill="url(#gradGreen)" strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="kpi-card p-5">
                            <div className="text-xs font-semibold uppercase tracking-wide mb-4 text-muted-foreground">
                              Leads vs Vendas
                            </div>
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 6" stroke="oklch(0.20 0.008 20)" />
                                <XAxis dataKey="date" tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 10 }} />
                                <YAxis tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 10 }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="leads" name="Leads" fill="oklch(0.55 0.22 25 / 0.80)" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="vendas" name="Vendas" fill="#E63946cc" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Instagram Insights */}
                    {igInsights && igInsights.connected && (() => {
                      const totals = igInsights.totals;
                      const daily = igInsights.daily;
                      const getDaily = (key: string) => (daily?.[key] ?? []) as Array<{ date: string; value: number }>;
                      const pctChange = (arr: Array<{ date: string; value: number }>) => {
                        if (arr.length < 2) return null;
                        const mid = Math.floor(arr.length / 2);
                        const first = arr.slice(0, mid).reduce((s, v) => s + v.value, 0);
                        const second = arr.slice(mid).reduce((s, v) => s + v.value, 0);
                        if (first === 0) return null;
                        return ((second - first) / first) * 100;
                      };
                      const fmtDate = (d: string) => {
                        const dt = new Date(d + "T00:00:00");
                        return `${dt.toLocaleString("pt-BR", { month: "short" })} ${dt.getDate()}`;
                      };
                      // Benchmarks de referência para barra de progresso (valores mensais típicos para clínicas)
                      const BENCHMARKS: Record<string, number> = {
                        views: 200000,
                        reach: 50000,
                        accounts_engaged: 5000,
                        profile_views: 3000,
                      };
                      const IgChartCard = ({ title, metricKey, total, color, icon: CardIcon, labelFn }: { title: string; metricKey: string; total: number; color: string; icon?: React.ElementType; labelFn?: (v: number) => string }) => {
                        const data = getDaily(metricKey).map(d => ({ date: fmtDate(d.date), value: d.value }));
                        const hasDaily = data.length > 1;
                        const pct = pctChange(getDaily(metricKey));
                        const fmt = labelFn ?? formatNumber;
                        const benchmark = BENCHMARKS[metricKey] ?? 0;
                        const progress = benchmark > 0 ? Math.min((total / benchmark) * 100, 100) : 0;
                        const progressLabel = benchmark > 0 ? `${Math.round(progress)}% da meta mensal` : null;
                        return (
                          <div className="kpi-card p-5 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
                              {CardIcon && (
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                                  <CardIcon className="w-3.5 h-3.5" style={{ color }} />
                                </div>
                              )}
                            </div>
                            <div className="flex items-end gap-3">
                              <div className="text-3xl font-bold tracking-tight" style={{ color: "oklch(0.95 0.005 30)" }}>{fmt(total)}</div>
                              {pct !== null && (
                                <div className={`flex items-center gap-0.5 text-xs font-medium mb-1 ${pct > 0 ? "text-emerald-400" : pct < 0 ? "text-red-400" : "text-slate-400"}`}>
                                  {pct > 0 ? <TrendingUp className="w-3 h-3" /> : pct < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                  {Math.abs(pct).toFixed(1)}%
                                </div>
                              )}
                            </div>
                            {hasDaily ? (
                              <ResponsiveContainer width="100%" height={80}>
                                <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 6" stroke="oklch(0.20 0.008 20)" />
                                  <XAxis dataKey="date" tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                  <YAxis tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                                  <Tooltip content={<ChartTooltip />} />
                                  <Line type="monotone" dataKey="value" name={title} stroke={color} strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            ) : benchmark > 0 ? (
                              <div className="flex flex-col gap-1.5 mt-1">
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.008 20)" }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${progress}%`,
                                      background: progress >= 80
                                        ? `linear-gradient(90deg, ${color}, #ff6b6b)`
                                        : progress >= 50
                                        ? `linear-gradient(90deg, ${color}99, ${color})`
                                        : `linear-gradient(90deg, ${color}55, ${color}88)`,
                                    }}
                                  />
                                </div>
                                {progressLabel && (
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>{progressLabel}</span>
                                    <span style={{ color }}>{formatNumberShort(benchmark)} meta</span>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      };
                      return (
                        <>
                          <SectionHeader title="Instagram Insights" badge="API" />
                          {igInsights.username && (
                            <div className="text-xs mb-1 text-muted-foreground">
                              @{igInsights.username} · {formatNumber(igInsights.totalFollowers)} seguidores totais
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <IgChartCard title="Views" metricKey="views" total={totals?.impressions ?? 0} color="#E63946" icon={Eye} />
                            <IgChartCard title="Reach" metricKey="reach" total={totals?.reach ?? 0} color="#c1121f" icon={Users} />
                            <IgChartCard title="Interações" metricKey="accounts_engaged" total={totals?.interactions ?? 0} color="#E63946" icon={Heart} />
                            <IgChartCard title="Visitas ao Perfil" metricKey="profile_views" total={totals?.profileViews ?? 0} color="#E63946" icon={MousePointer} />
                            <div className="kpi-card p-5 flex flex-col gap-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follows</div>
                              <div className="flex items-end gap-3">
                                <div className="text-2xl font-bold text-foreground">{formatNumber(totals?.newFollowers ?? 0)}</div>
                                {(() => {
                                  const arr = igInsights.daily?.follows_and_unfollows ?? [];
                                  if (arr.length < 2) return null;
                                  const mid = Math.floor(arr.length / 2);
                                  const first = arr.slice(0, mid).reduce((s: number, v: {value: number}) => s + v.value, 0);
                                  const second = arr.slice(mid).reduce((s: number, v: {value: number}) => s + v.value, 0);
                                  if (first === 0) return null;
                                  const pct = ((second - first) / first) * 100;
                                  return (
                                    <div className={`flex items-center gap-0.5 text-xs font-medium mb-0.5 ${pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-500" : "text-slate-400"}`}>
                                      {pct > 0 ? <TrendingUp className="w-3 h-3" /> : pct < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                      {Math.abs(pct).toFixed(1)}%
                                    </div>
                                  );
                                })()}
                              </div>
                              {(igInsights.daily?.follows_and_unfollows ?? []).length > 0 ? (
                                <ResponsiveContainer width="100%" height={110}>
                                  <LineChart data={(igInsights.daily?.follows_and_unfollows ?? []).map((d: {date: string; value: number}) => ({ date: fmtDate(d.date), value: d.value }))} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 6" stroke="oklch(0.20 0.008 20)" />
                                    <XAxis dataKey="date" tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Line type="monotone" dataKey="value" name="Follows" stroke="oklch(0.55 0.22 25)" strokeWidth={2} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="text-xs text-center py-6 text-muted-foreground">Sem dados no período</div>
                              )}
                              {(() => {
                                const ago30 = new Date();
                                ago30.setDate(ago30.getDate() - 29);
                                const ago30Str = ago30.toISOString().substring(0, 10);
                                return dateRange.from < ago30Str ? (
                                  <div className="text-xs text-muted-foreground/60">Dados disponíveis a partir de {ago30Str} (limite da API)</div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {igInsights && !igInsights.connected && activeClient && (
                      <div className="flex flex-col items-center justify-center py-8 gap-3 rounded-xl border-2 border-dashed border-border">
                        <Instagram className="w-6 h-6 text-muted-foreground" />
                        <div className="text-sm font-medium text-muted-foreground">Instagram não conectado</div>
                        <div className="text-xs text-muted-foreground/70">Conecte o Instagram deste cliente nas configurações</div>
                        <button
                          onClick={() => navigate("/settings")}
                          className="text-xs font-medium px-4 py-1.5 rounded-lg transition-all"
                          style={{ background: "rgba(230,57,70,0.12)", color: "#E63946", border: "1px solid rgba(230,57,70,0.25)" }}
                        >
                          Ir para Configurações
                        </button>
                      </div>
                    )}

                    {/* Empty state */}
                    {!activeClient && !kpiLoading && (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border-2 border-dashed border-border">
                        <div className="text-sm font-medium text-muted-foreground">Nenhum cliente configurado</div>
                        <button
                          onClick={() => navigate("/settings")}
                          className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg text-white transition-all hover:opacity-90"
                          style={{ background: "linear-gradient(135deg, oklch(0.48 0.22 25), oklch(0.55 0.22 15))" }}
                        >
                          <Settings className="w-4 h-4" />
                          Configurar cliente
                        </button>
                      </div>
                    )}

                    <div className="text-xs text-center pt-4 border-t border-border text-muted-foreground/60">
                      ADS Dashboard · Meta Ads API + Planilha de Vendas
                    </div>
                  </>
                )}
              </>
            )}

            {/* ═══════════════ TAB: CRM ═══════════════ */}
            {activeTab === "crm" && (
              <div>
                {/* Period filter bar */}
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-card border border-border">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
                  <select
                    value={crmDateField}
                    onChange={e => setCrmDateField(e.target.value as "any" | "consult" | "conversion")}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none bg-background border border-border text-foreground"
                  >
                    <option value="any">Consulta ou Conversão</option>
                    <option value="consult">Data de Consulta</option>
                    <option value="conversion">Data de Conversão</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={crmDateFrom}
                      onChange={e => setCrmDateFrom(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg text-xs outline-none bg-background border border-border text-foreground"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <input
                      type="date"
                      value={crmDateTo}
                      onChange={e => setCrmDateTo(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg text-xs outline-none bg-background border border-border text-foreground"
                    />
                  </div>
                  {/* Quick month shortcuts */}
                  {[0, 1, 2].map(offset => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - offset);
                    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
                    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
                    const to = offset === 0
                      ? new Date().toISOString().slice(0, 10)
                      : new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
                    const isActive = crmDateFrom === from && crmDateTo === to;
                    return (
                      <button
                        key={offset}
                        onClick={() => { setCrmDateFrom(from); setCrmDateTo(to); }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border"
                        style={{
                          background: isActive ? "rgba(230,57,70,0.12)" : "transparent",
                          borderColor: isActive ? "rgba(230,57,70,0.40)" : "oklch(0.22 0.008 20)",
                          color: isActive ? "#E63946" : "oklch(0.70 0.010 30)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Alerts */}
                {leadsData?.pendingUpdate != null && leadsData.pendingUpdate > 0 && (
                  <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <span className="text-sm font-semibold text-amber-700">
                        {leadsData.pendingUpdate} lead{leadsData.pendingUpdate > 1 ? "s" : ""} aguardando atualização
                      </span>
                      <p className="text-xs mt-0.5 text-amber-600/70">
                        Leads com consulta agendada mas sem status de conversão
                      </p>
                    </div>
                  </div>
                )}

                {/* Summary stats */}
                {leadsData && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="kpi-card px-4 py-3">
                      <div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Total no Período</div>
                      <div className="text-2xl font-bold text-primary">{leadsData.total}</div>
                    </div>
                    <div className="kpi-card px-4 py-3">
                      <div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Com Consulta</div>
                      <div className="text-2xl font-bold" style={{ color: "#c1121f" }}>{(leadsData as any).withConsult ?? 0}</div>
                    </div>
                    <div className="kpi-card px-4 py-3">
                      <div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Convertidos</div>
                      <div className="text-2xl font-bold" style={{ color: "#E63946" }}>{(leadsData as any).withConversion ?? 0}</div>
                    </div>
                    <div className="kpi-card px-4 py-3">
                      <div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Taxa Conversão</div>
                      <div className="text-2xl font-bold" style={{ color: "oklch(0.65 0.18 55)" }}>
                        {(leadsData as any).withConsult > 0
                          ? `${(((leadsData as any).withConversion / (leadsData as any).withConsult) * 100).toFixed(0)}%`
                          : "—"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48 bg-card border border-border">
                    <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou telefone..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm outline-none bg-card border border-border text-foreground"
                  >
                    <option value="">Todos os status</option>
                    {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    value={originFilter}
                    onChange={e => setOriginFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm outline-none bg-card border border-border text-foreground"
                  >
                    <option value="">Todas as origens</option>
                    {uniqueOrigins.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <button
                    onClick={() => refetchLeads()}
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Atualizar
                  </button>
                </div>

                {/* Table */}
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Carregando leads do Monday...
                  </div>
                ) : leadsData?.error === "monday_not_configured" ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-border">
                    <div className="text-sm font-medium text-muted-foreground">Monday.com não configurado</div>
                    <div className="text-xs text-muted-foreground/70">Configure o board do Monday nas configurações do cliente</div>
                  </div>
                ) : leadsData?.error === "no_board_id" ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-border">
                    <div className="text-sm font-medium text-muted-foreground">Board ID não configurado</div>
                    <div className="text-xs text-muted-foreground/70">Adicione o ID do board do Monday nas configurações</div>
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border-2 border-dashed border-border">
                    <div className="text-sm text-muted-foreground">Nenhum lead encontrado</div>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border">
                            {["Nome", "Telefone", "Status", "Origem", "Procedimento", "Consulta", "Grupo"].map(h => (
                              <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeads.map((lead: any) => <LeadRow key={lead.mondayId} lead={lead} />)}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                      Mostrando {filteredLeads.length} de {leadsData?.total ?? 0} leads
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════ TAB: CONTEÚDOS ═══════════════ */}
            {activeTab === "conteudos" && (
              <div>
                {postsLoading ? (
                  <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Carregando posts do Instagram...
                  </div>
                ) : postsData?.error === "instagram_not_configured" ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-border">
                    <Instagram className="w-8 h-8 text-muted-foreground" />
                    <div className="text-sm font-medium text-muted-foreground">Instagram não conectado</div>
                    <div className="text-xs text-muted-foreground/70">Conecte o Instagram deste cliente nas configurações</div>
                    <button
                      onClick={() => navigate("/settings")}
                      className="text-xs font-medium px-4 py-1.5 rounded-lg transition-all"
                      style={{ background: "rgba(230,57,70,0.12)", color: "#E63946", border: "1px solid rgba(230,57,70,0.25)" }}
                    >
                      Ir para Configurações
                    </button>
                  </div>
                ) : postsData?.posts?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border-2 border-dashed border-border">
                    <div className="text-sm text-muted-foreground">Nenhum post encontrado</div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">
                          Top {postsData?.posts?.length ?? 0} posts por engajamento
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ordenados por interações + compartilhamentos + salvamentos
                        </span>
                      </div>
                      <button
                        onClick={() => refetchPosts()}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Atualizar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {postsData?.posts?.map((post: any) => <PostCard key={post.id} post={post} />)}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══════════════ TAB: CRIATIVOS ═══════════════ */}
            {activeTab === "criativos" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎨</span>
                    <span className="text-sm font-semibold text-foreground">Criativos Ativos no Tráfego</span>
                    <span className="text-xs text-muted-foreground">{dateRange.from} → {dateRange.to}</span>
                  </div>
                  <button onClick={() => refetchCreatives()}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30">
                    <RefreshCw className="w-3 h-3" /> Atualizar
                  </button>
                </div>

                {creativesLoading ? (
                  <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Buscando criativos na Meta API...
                  </div>
                ) : creativesData?.error === "meta_not_configured" ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-border">
                    <span className="text-3xl">📷</span>
                    <div className="text-sm font-medium text-muted-foreground">Meta Ads não conectado</div>
                    <div className="text-xs text-muted-foreground/70">Configure o token Meta Ads deste cliente nas configurações</div>
                  </div>
                ) : !creativesData?.creatives?.length ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border-2 border-dashed border-border">
                    <div className="text-sm text-muted-foreground">Nenhum criativo ativo encontrado</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {creativesData.creatives.map((cr: any) => (
                      <div key={cr.adId} className="kpi-card overflow-hidden">
                        {/* Thumbnail only */}
                        <div className="relative aspect-square bg-muted overflow-hidden">
                          {cr.thumbnailUrl ? (
                            <img src={cr.thumbnailUrl} alt={cr.adName} className="w-full h-full object-contain" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl text-muted-foreground">
                              {cr.format === "video" ? "🎥" : cr.format === "carousel" ? "📷" : "🖼️"}
                            </div>
                          )}
                          {/* Format badge */}
                          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/60 text-white">
                            {cr.format === "video" ? "🎥" : cr.format === "carousel" ? "📷" : "🖼️"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>

        {/* Right Panel: Análise IA + Chat embaixo */}
        {showRightPanel && activeClient && (
          <div className="hidden lg:flex flex-col w-[420px] xl:w-[480px] flex-shrink-0 border-l border-border bg-card/30 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
              <div>
                <p className="text-xs font-semibold text-foreground">{activeClientName}</p>
                <p className="text-[10px] text-muted-foreground">{dateRange.from} até {dateRange.to}</p>
              </div>
              <button
                onClick={() => {
                  if (!activeClient) return;
                  setReportAnalysis(null);
                  setReportAnalysisLoading(true);
                  generateReportMutation.mutate(
                    { clientId: activeClient, from: dateRange.from, to: dateRange.to, clientName: activeClientName },
                    {
                      onSuccess: (data) => { setReportAnalysis(data.analysis); setReportAnalysisLoading(false); },
                      onError: () => { setReportAnalysis(null); setReportAnalysisLoading(false); },
                    }
                  );
                }}
                disabled={reportAnalysisLoading}
                className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-white/50 hover:bg-primary/20 hover:text-primary transition-colors border border-white/10 disabled:opacity-40"
              >
                {reportAnalysisLoading ? '⏳ Gerando...' : '🔄 Regerar'}
              </button>
            </div>

            {/* Analysis section - scrollable, takes ~55% height */}
            <div className="overflow-y-auto" style={{ flex: '0 0 55%', borderBottom: '1px solid oklch(0.25 0.01 30)' }}>
              <div className="p-4">
                {reportAnalysisLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-muted-foreground">Gerando análise com IA...</p>
                  </div>
                ) : reportAnalysis ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Análise da Scarlett</span>
                    </div>
                    <div className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">{reportAnalysis}</div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(reportAnalysis ?? ''); toast.success('Análise copiada!'); }}
                      className="text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/50 hover:bg-primary/20 hover:text-primary transition-colors border border-white/10 w-full"
                    >
                      📋 Copiar análise
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <Sparkles className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Aguardando dados...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chat section - takes remaining ~45% height */}
            <div className="flex-1 overflow-hidden">
              <ReportChatPanel clientId={activeClient} clientName={activeClientName} />
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
