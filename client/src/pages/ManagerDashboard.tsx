import { useEffect, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { RECURSOS_IA_ATIVOS } from "@/lib/recursosOcultos";
import { EnviarWhatsApp } from "@/components/report/EnviarWhatsApp";
import { shouldAutoSyncMonday } from "@/lib/mondaySync";
import { calculateRate, calculateRevenueConcentration } from "@/lib/executiveMetrics";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  RefreshCw, Settings, TrendingUp, TrendingDown, Minus, Instagram, Sparkles, Users,
  Heart, MessageCircle, Share2, Bookmark, Eye, Clock, ExternalLink, Search,
  DollarSign, Target, BarChart2, ShoppingCart, Star, UserPlus, MousePointer, Zap, Sun, Moon,
  FileText, LogOut, PlusCircle, TestTube2, Image as ImageIcon, ImagePlus
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/contexts/ThemeContext";
import { clearManagerSession } from "@/lib/managerSession";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CampanhasSplit {
  mensagens: { investimento: number; leads: number; custoPorLead: number };
  visitas: { investimento: number; alcance: number; custoPorVisita: number };
  formulario: { investimento: number; cliques: number; custoPorClique: number };
  video?: { investimento: number; visualizacoes: number; custoPorVisualizacao: number };
  outros?: { investimento: number };
}
type TipoCampanha = "mensagens" | "formulario" | "visitas" | "video" | "outros";
interface CampanhaDetalhe {
  nome: string; tipo: TipoCampanha; objective: string | null; investimento: number;
  conversas: number; leadsFormulario: number; visualizacoes: number; alcance: number; cliques: number;
}
const ROTULO_TIPO: Record<TipoCampanha, string> = {
  mensagens: "💬 Mensagens", formulario: "🔗 Formulário", visitas: "👁 Visitas", video: "🎬 Vídeo", outros: "❔ Outras",
};
interface KpiData {
  investimento: number; leads: number; consultas?: number; vendas: number;
  totalEmVendas: number; totalCirurgias?: number; totalConsultas?: number;
  receitaTotal?: number;
  revenueLineage?: { type: string; label: string; updatedAt: string | null; roasFormula: string };
  novosSeguidores: number; alcance?: number; cliquesEstimados?: number;
  custoPorClique?: number; custoPorLeadDireto?: number; campanhas?: CampanhasSplit; campanhasDetalhe?: CampanhaDetalhe[];
  custoPorLead: number; taxaConversao: number; roas: number;
  custoPorVenda: number; custoPorConsulta: number; ticketMedio: number;
}
interface DateRange { from: string; to: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCurrency(v: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v); }
function formatNumber(v: number) { return new Intl.NumberFormat("pt-BR").format(v); }
function formatNumberShort(v: number) { if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`; if (v >= 1000) return `${(v / 1000).toFixed(1)}K`; return String(v); }
function formatPercent(v: number) { return `${v.toFixed(2)}%`; }
function formatTime(ms: number) { const s = Math.round(ms / 1000); if (s < 60) return `${s}s`; return `${Math.floor(s / 60)}m${s % 60}s`; }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
function getDefaultRange(): DateRange {
  const now = new Date();
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}
const STATUS_COLORS: Record<string, string> = {
  "fechado": "#16a34a", "agendado": "#2563eb", "compareceu": "#0891b2",
  "perdido": "#dc2626", "cancelado": "#ea580c", "não compareceu": "#ea580c",
  "em atendimento": "#d97706", "aguardando": "#ca8a04",
};
function getStatusColor(status: string) {
  const s = status.toLowerCase();
  for (const [key, color] of Object.entries(STATUS_COLORS)) { if (s.includes(key)) return color; }
  return "#6b7280";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, gradient, alert }: {
  label: string; value: string; sub?: string; icon?: React.ElementType; gradient?: string; alert?: boolean;
}) {
  return (
    <div className={`kpi-card flex flex-col gap-2 p-4 ${alert ? "ring-1 ring-amber-400/30" : ""}`}
      style={gradient ? { background: gradient, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" } : {}}>
      {Icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={gradient ? { background: "rgba(255,255,255,0.2)" } : { background: "rgba(230,57,70,0.12)" }}>
          <Icon className="w-4 h-4" style={{ color: gradient ? "white" : "#E63946" }} />
        </div>
      )}
      <div>
        <div className="text-xs font-medium tracking-wide uppercase leading-tight"
          style={{ color: gradient ? "rgba(255,255,255,0.75)" : "oklch(0.70 0.010 30)" }}>{label}</div>
        <div className="text-xl font-bold tracking-tight leading-tight mt-0.5"
          style={{ color: gradient ? "white" : "oklch(0.95 0.005 30)" }}>{value}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: gradient ? "rgba(255,255,255,0.65)" : "oklch(0.70 0.010 30)" }}>{sub}</div>}
        {alert && <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5"><TrendingDown className="w-3 h-3" /><span>Atenção</span></div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <span className="text-sm font-semibold tracking-wide text-foreground">{title}</span>
      {badge && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(230,57,70,0.12)", color: "#E63946" }}>{badge}</span>}
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

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
        <button key={p.label} onClick={() => onChange(p.fn())}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all border border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5 text-muted-foreground">
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 text-xs ml-1">
        <input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50" />
        <span className="text-muted-foreground">→</span>
        <input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50" />
      </div>
    </div>
  );
}

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

function LeadRow({ lead }: { lead: any }) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5 text-sm font-medium text-foreground">{lead.name || "—"}</td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">{lead.phone || "—"}</td>
      <td className="px-3 py-2.5">
        {lead.status ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: `${getStatusColor(lead.status)}18`, color: getStatusColor(lead.status), border: `1px solid ${getStatusColor(lead.status)}40` }}>
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

function PostCard({ post }: { post: any }) {
  const ins = post.insights ?? {};
  const isReel = post.mediaType === "VIDEO";
  const thumb = post.thumbnailUrl ?? post.mediaUrl;
  return (
    <div className="kpi-card overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-muted overflow-hidden">
        {thumb ? <img src={thumb} alt="post" className="w-full h-full object-cover" /> : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Instagram className="w-8 h-8" /></div>
        )}
        <div className="absolute top-2 left-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: isReel ? "rgba(230,57,70,0.85)" : "oklch(0.55 0.22 25 / 0.85)" }}>
            {isReel ? "REEL" : post.mediaType === "CAROUSEL_ALBUM" ? "CARROSSEL" : "FOTO"}
          </span>
        </div>
        <a href={post.permalink} target="_blank" rel="noopener noreferrer"
          className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors">
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [managerName, setManagerName] = useState<string>("");
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const [activeClient, setActiveClient] = useState<number | null>(null);
  const [showClientSidebar, setShowClientSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState<"kpis" | "crm" | "conteudos" | "criativos">("kpis");
  const [showRightPanel, setShowRightPanel] = useState(RECURSOS_IA_ATIVOS);
  const [reportAnalysis, setReportAnalysis] = useState<string | null>(null);
  const [reportAnalysisLoading, setReportAnalysisLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mondayAutoSyncing, setMondayAutoSyncing] = useState(false);

  // CRM state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [crmDateField, setCrmDateField] = useState<"any" | "consult" | "conversion">("any");
  const [crmDateFrom, setCrmDateFrom] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); });
  const [crmDateTo, setCrmDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Modals
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("manager_token");
    const n = localStorage.getItem("manager_name") || "";
    if (!t) { navigate("/manager/login"); return; }
    setToken(t);
    setManagerName(n);
  }, [navigate]);

  useEffect(() => {
    setSearchTerm(""); setStatusFilter(""); setOriginFilter(""); setCrmDateField("any");
    setChatMessages([]); setChatInput("");
    const now = new Date();
    setCrmDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
    setCrmDateTo(now.toISOString().slice(0, 10));
  }, [activeClient]);

  const { data: clientsData, isLoading: clientsLoading, error: clientsError, refetch: refetchClients } = trpc.managers.myClients.useQuery(
    { token: token! }, { enabled: !!token }
  );
  const clients = clientsData?.clients ?? [];

  useEffect(() => {
    if (clientsError?.data?.code !== "UNAUTHORIZED") return;
    clearManagerSession(localStorage);
    toast.info("Sua sessão expirou. Entre novamente para continuar.");
    navigate("/manager/login", { replace: true });
  }, [clientsError, navigate]);

  useEffect(() => {
    if (clients.length > 0 && !activeClient) setActiveClient(clients[0].id);
  }, [clients, activeClient]);

  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpi } = trpc.managers.getKpisAsManager.useQuery(
    { token: token!, clientId: activeClient!, from: dateRange.from, to: dateRange.to },
    { enabled: !!token && !!activeClient }
  );

  const mondayAutoSyncMutation = trpc.monday.syncBoardAsManager.useMutation();

  useEffect(() => {
    const client = clients.find((item) => item.id === activeClient);
    if (!shouldAutoSyncMonday({ managerToken: token, clientId: activeClient, mondayBoardId: client?.mondayBoardId })) return;

    setMondayAutoSyncing(true);
    mondayAutoSyncMutation.mutate(
      {
        clientId: activeClient!,
        boardId: client!.mondayBoardId!,
        managerToken: token!,
      },
      {
        onSuccess: () => {
          setMondayAutoSyncing(false);
          void refetchKpi();
        },
        onError: () => setMondayAutoSyncing(false),
      }
    );
    // Sincroniza quando o cliente ou o período do dashboard for alterado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient, dateRange.from, dateRange.to, token]);

  const { data: igInsights } = trpc.managers.getInsightsAsManager.useQuery(
    { token: token!, clientId: activeClient!, since: dateRange.from, until: dateRange.to },
    { enabled: !!token && !!activeClient }
  );

  const { data: trendData } = trpc.managers.getTrendsAsManager.useQuery(
    { token: token!, clientId: activeClient! }, { enabled: !!token && !!activeClient }
  );

  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = trpc.managers.getLeadsAsManager.useQuery(
    { token: token!, clientId: activeClient!, status: statusFilter || undefined, search: searchTerm || undefined, dateFrom: crmDateFrom || undefined, dateTo: crmDateTo || undefined, dateField: crmDateField },
    { enabled: !!activeClient && !!token && activeTab === "crm" }
  );

  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = trpc.managers.getTopPostsAsManager.useQuery(
    { token: token!, clientId: activeClient!, limit: 20 }, { enabled: !!activeClient && !!token && activeTab === "conteudos" }
  );

  const { data: creativesData, isLoading: creativesLoading, refetch: refetchCreatives } = trpc.managers.getCreativesAsManager.useQuery(
    { token: token!, clientId: activeClient!, from: dateRange.from, to: dateRange.to },
    { enabled: !!activeClient && !!token && activeTab === "criativos" }
  );

  const generateReportMutation = trpc.managers.generateReportAsManager.useMutation();

  const createClient = trpc.managers.createClientAsManager.useMutation({
    onSuccess: () => { toast.success("Cliente criado!"); setShowNewClient(false); setNewClientName(""); refetchClients(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteClient = trpc.managers.deleteClientAsManager.useMutation({
    onSuccess: () => { toast.success("Cliente excluído!"); setDeleteConfirm(null); refetchClients(); },
    onError: (err) => toast.error(err.message),
  });

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

  const activeClientName = clients.find((c) => c.id === activeClient)?.name ?? "Cliente";
  const activeClientToken = clients.find((c) => c.id === activeClient)?.publicToken;
  const activeClientWhatsappGroupId = clients.find((c) => c.id === activeClient)?.whatsappGroupId;
  const activeClientCampaignTypesRaw = clients.find((c) => c.id === activeClient)?.campaignTypes;
  const activeClientCampaignTypes: string[] = (() => {
    try { return activeClientCampaignTypesRaw ? JSON.parse(activeClientCampaignTypesRaw) : []; } catch { return []; }
  })();
  const CAMPAIGN_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
    lead: { label: "Engajamento / Lead", emoji: "🎯", color: "oklch(0.60 0.18 240 / 0.18)" },
    profile_visit: { label: "Visitas ao Perfil", emoji: "👤", color: "oklch(0.72 0.18 145 / 0.18)" },
    awareness: { label: "Reconhecimento", emoji: "📢", color: "oklch(0.75 0.18 60 / 0.18)" },
  };

  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user'|'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const editReportWithChatMutation = trpc.managers.editReportWithChat.useMutation();

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading || !reportAnalysis) return;
    if (!token) { toast.error('Sessão expirada. Faça login novamente.'); navigate('/manager/login'); return; }
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      const result = await editReportWithChatMutation.mutateAsync({
        token: token,
        currentAnalysis: reportAnalysis,
        instruction: userMsg,
        clientName: activeClientName,
      });
      const newAnalysis = result?.analysis ?? reportAnalysis;
      setReportAnalysis(newAnalysis);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '✅ Análise atualizada!' }]);
    } catch (e: any) {
      console.error('[Chat] editReportWithChat error:', e);
      const errMsg = e?.message || '';
      if (errMsg.includes('expirado') || errMsg.includes('inválido')) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '❌ Sessão expirada. Faça login novamente.' }]);
        setTimeout(() => navigate('/manager/login'), 2000);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${errMsg || 'Tente novamente.'}` }]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    if (!leadsData?.leads) return [];
    if (!originFilter) return leadsData.leads;
    return leadsData.leads.filter((l: any) => l.origin.toLowerCase().includes(originFilter.toLowerCase()));
  }, [leadsData?.leads, originFilter]);

  const uniqueStatuses = useMemo(() => {
    if (!leadsData?.leads) return [];
    return Array.from(new Set(leadsData.leads.map((l: any) => l.status).filter(Boolean))) as string[];
  }, [leadsData?.leads]);

  const uniqueOrigins = useMemo(() => {
    if (!leadsData?.leads) return [];
    return Array.from(new Set(leadsData.leads.map((l: any) => l.origin).filter(Boolean))) as string[];
  }, [leadsData?.leads]);

  // Auto-generate analysis when right panel opens
  useEffect(() => {
    if (!showRightPanel || !activeClient || !token) return;
    setReportAnalysis(null);
    setReportAnalysisLoading(true);
    generateReportMutation.mutate(
      { token: token!, clientId: activeClient, from: dateRange.from, to: dateRange.to, clientName: activeClientName },
      {
        onSuccess: (data) => { setReportAnalysis(typeof data.analysis === 'string' ? data.analysis : null); setReportAnalysisLoading(false); },
        onError: () => { setReportAnalysis(null); setReportAnalysisLoading(false); },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRightPanel, activeClient, dateRange.from, dateRange.to]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refetchKpi(); toast.success("Dados sincronizados!"); }
    catch { toast.error("Falha na sincronização"); }
    finally { setRefreshing(false); }
  };

  const copyPublicLink = () => {
    if (!activeClientToken) { toast.error("Este cliente não tem link público configurado."); return; }
    const url = `${window.location.origin}/r/${activeClientToken}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copiado: " + url));
  };

  const handleLogout = () => {
    clearManagerSession(localStorage);
    navigate("/manager/login");
  };

  if (!token) return null;

  if (clientsError) {
    const sessionExpired = clientsError.data?.code === "UNAUTHORIZED";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">
            {sessionExpired ? "Sessão expirada. Faça login novamente." : "Não foi possível carregar seus clientes agora."}
          </p>
          <Button onClick={() => sessionExpired ? navigate("/manager/login") : void refetchClients()}>
            {sessionExpired ? "Fazer login" : "Tentar novamente"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 md:px-6 py-3 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => setShowClientSidebar(o => !o)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm md:text-base font-bold tracking-tight text-foreground">ADS</span>
          <span className="hidden md:inline text-base font-bold tracking-tight text-foreground">Dashboard</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(230,57,70,0.12)", color: "#E63946" }}>
            {activeClientName}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleRefresh} disabled={refreshing}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'oklch(0.78 0.01 60)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Sincronizando..." : "Sincronizar"}
          </button>
          {activeClientToken && (
            <>
              <button onClick={() => window.open(`/r/${activeClientToken}`, "_blank")}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.4)' }}>
                <span className="hidden sm:inline">📊 Ver Relatório</span>
                <span className="sm:hidden">📊</span>
              </button>
              <button onClick={copyPublicLink}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(6,182,212,0.18)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.4)' }}>
                🔗 Copiar Link
              </button>
              <button
                onClick={() => setShowWhatsapp(true)}
                title={activeClientWhatsappGroupId ? "Enviar relatório no grupo de WhatsApp" : "Configure o grupo de WhatsApp nas configurações"}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: activeClientWhatsappGroupId ? 'rgba(37,211,102,0.18)' : 'rgba(255,255,255,0.06)',
                  color: activeClientWhatsappGroupId ? '#25D366' : 'oklch(0.45 0.010 240)',
                  border: activeClientWhatsappGroupId ? '1px solid rgba(37,211,102,0.4)' : '1px solid rgba(255,255,255,0.12)',
                }}>
                <span>💬</span>
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            </>
          )}
          {RECURSOS_IA_ATIVOS && activeClient && (
            <button onClick={() => setShowRightPanel(p => !p)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: showRightPanel ? 'rgba(230,57,70,0.28)' : 'rgba(230,57,70,0.15)', color: '#ff8a94', border: `1px solid rgba(230,57,70,${showRightPanel ? '0.55' : '0.38'})` }}>
              <Sparkles className="w-3.5 h-3.5" />
              {showRightPanel ? 'Fechar' : 'IA + Relatório'}
            </button>
          )}
          {toggleTheme && (
            <button onClick={toggleTheme}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-80"
              style={{ background: theme === 'dark' ? 'rgba(250,204,21,0.15)' : 'rgba(99,102,241,0.15)', color: theme === 'dark' ? '#fbbf24' : '#818cf8', border: `1px solid ${theme === 'dark' ? 'rgba(250,204,21,0.3)' : 'rgba(99,102,241,0.3)'}` }}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
          <button onClick={handleLogout}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:opacity-80 text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {showClientSidebar && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setShowClientSidebar(false)} />}

        {/* Client Sidebar */}
        <aside className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-52 flex-shrink-0 flex flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out ${showClientSidebar ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Clientes</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {clientsLoading && <div className="px-4 py-3 text-xs text-muted-foreground animate-pulse">Carregando...</div>}
            {clients.map((c) => (
              <button key={c.id} onClick={() => { setActiveClient(c.id); setShowClientSidebar(false); }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium transition-all rounded-none"
                style={{ color: activeClient === c.id ? "#E63946" : "oklch(0.60 0.010 30)", background: activeClient === c.id ? "rgba(230,57,70,0.08)" : "transparent", borderLeft: activeClient === c.id ? "2px solid #E63946" : "2px solid transparent" }}>
                {c.name}
              </button>
            ))}
            {!clientsLoading && clients.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">Nenhum cliente</div>}
          </div>
          <div className="p-3 border-t border-border flex flex-col gap-2">
            <button onClick={() => setShowNewClient(true)}
              className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all border border-border hover:border-primary/30 hover:bg-muted/50"
              style={{ color: "#E63946" }}>
              <PlusCircle className="w-3.5 h-3.5" />
              Novo Cliente
            </button>
            <button onClick={() => navigate("/manager/carteira")}
              className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all text-muted-foreground border border-border hover:text-foreground hover:border-primary/30 hover:bg-muted/50">
              <TrendingUp className="w-3.5 h-3.5" />
              Carteira · CPL
            </button>
            <button onClick={() => navigate("/manager/settings")}
              className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all text-muted-foreground border border-border hover:text-foreground hover:border-primary/30 hover:bg-muted/50">
              <Settings className="w-3.5 h-3.5" />
              Configurações
            </button>
            {RECURSOS_IA_ATIVOS && (
              <>
                <button onClick={() => navigate("/manager/intelligence")}
                  className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all text-muted-foreground border border-border hover:text-fuchsia-300 hover:border-fuchsia-400/30 hover:bg-fuchsia-500/5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Inteligência
                </button>
                <button onClick={() => navigate("/manager/creative-analyst")}
                  className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all text-muted-foreground border border-border hover:text-violet-300 hover:border-violet-400/30 hover:bg-violet-500/5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Creative Analyst
                </button>
                <button onClick={() => navigate("/manager/creative-agent")}
                  className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all text-muted-foreground border border-border hover:text-fuchsia-300 hover:border-fuchsia-400/30 hover:bg-fuchsia-500/5">
                  <TestTube2 className="w-3.5 h-3.5" />
                  Creative Agent
                </button>
                <button onClick={() => navigate("/manager/campaign-agent")}
                  className="w-full flex items-center gap-2 text-xs font-medium py-2 px-3 rounded-lg transition-all text-muted-foreground border border-border hover:text-amber-200 hover:border-amber-400/30 hover:bg-amber-500/5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Campaign Agent
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-row">
          <main className="flex-1 overflow-hidden flex flex-col">
            {/* Date range + Tabs bar */}
            <div className="px-3 md:px-6 pt-3 pb-0 border-b border-border bg-card/50">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                <div className="text-xs text-muted-foreground">{dateRange.from} → {dateRange.to}</div>
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                {[
                  { id: "kpis" as const, label: "Dashboard", icon: "📊" },
                  { id: "crm" as const, label: "CRM", icon: "👥", count: leadsData?.total },
                  { id: "conteudos" as const, label: "Conteúdos", icon: "📸" },
                  { id: "criativos" as const, label: "Criativos", icon: "🎨" },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-xs md:text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0"
                    style={{ color: activeTab === tab.id ? "#E63946" : "oklch(0.65 0.010 30)", borderColor: activeTab === tab.id ? "#E63946" : "transparent", background: "transparent" }}>
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count != null && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(230,57,70,0.12)", color: "#E63946" }}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 flex flex-col gap-4 md:gap-6">

              {/* ═══ TAB: DASHBOARD (KPIs) ═══ */}
              {activeTab === "kpis" && (
                <>
                  {kpiLoading ? (
                    <>
                      <SectionHeader title="Principais Indicadores" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {Array.from({ length: 12 }).map((_, i) => <div key={i} className="kpi-card animate-pulse h-24" />)}
                      </div>
                    </>
                  ) : (
                    <>
                      {(() => {
                        const consultas = kpi.consultas ?? 0;
                        const cirurgias = kpi.totalCirurgias ?? 0;
                        const receitaConsultas = kpi.totalConsultas ?? kpi.totalEmVendas ?? 0;
                        const receitaTotal = kpi.receitaTotal ?? (receitaConsultas + cirurgias);
                        const receitaCirurgiasPct = calculateRevenueConcentration(receitaConsultas, cirurgias);
                        const mensagensIniciadas = kpi.campanhas?.mensagens?.leads ?? 0;
                        const custoPorMensagem = kpi.campanhas?.mensagens?.custoPorLead ?? 0;
                        const taxaClique = calculateRate(kpi.cliquesEstimados ?? 0, kpi.alcance ?? 0);
                        const taxaLead = calculateRate(kpi.leads, kpi.cliquesEstimados ?? 0);
                        const taxaConsulta = calculateRate(consultas, kpi.leads);
                        const taxaFechamento = calculateRate(kpi.vendas, consultas);
                        const funil = [
                          { label: "Alcance", value: kpi.alcance ?? 0, note: taxaClique > 0 ? `${formatPercent(taxaClique)} clicaram` : "" },
                          { label: "Cliques no link", value: kpi.cliquesEstimados ?? 0, note: taxaLead > 0 ? `${formatPercent(taxaLead)} viraram lead` : "" },
                          { label: "Leads", value: kpi.leads, note: taxaConsulta > 0 ? `${formatPercent(taxaConsulta)} agendaram consulta` : "" },
                          { label: "Consultas", value: consultas, note: taxaFechamento > 0 ? `${formatPercent(taxaFechamento)} fecharam` : "" },
                          { label: "Fechamentos", value: kpi.vendas, note: taxaFechamento > 0 ? "etapa de conversão comercial" : "" },
                        ];
                        const maxFunil = Math.max(...funil.map((item) => item.value), 1);
                        const instagram = igInsights?.connected ? {
                          alcance: igInsights.totals?.reach ?? (kpi.alcance ?? 0),
                          cliques: igInsights.totals?.profileViews ?? (kpi.cliquesEstimados ?? 0),
                          seguidores: igInsights.totals?.newFollowers ?? kpi.novosSeguidores,
                          totalSeguidores: igInsights.totalFollowers ?? 0,
                        } : { alcance: kpi.alcance ?? 0, cliques: kpi.cliquesEstimados ?? 0, seguidores: kpi.novosSeguidores, totalSeguidores: 0 };
                        return <>
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div><SectionHeader title="Visão executiva" badge="AO VIVO" /><p className="text-xs text-muted-foreground mt-1">{formatDate(dateRange.from)} a {formatDate(dateRange.to)}</p></div>
                            {mondayAutoSyncing && <span className="flex items-center gap-1.5 text-xs text-violet-400 animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" />Atualizando Monday...</span>}
                          </div>
                          {activeClientCampaignTypes.length > 0 && <div className="flex gap-1.5 flex-wrap">{activeClientCampaignTypes.map((type) => { const info = CAMPAIGN_TYPE_LABELS[type]; return info ? <span key={type} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: info.color, color: "oklch(0.85 0.010 240)", border: "1px solid oklch(0.40 0.010 240 / 0.3)" }}><span>{info.emoji}</span><span>{info.label}</span></span> : null; })}</div>}

                          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 rounded-xl overflow-hidden border border-border bg-card">
                            <div className="p-5 border-b sm:border-b-0 sm:border-r border-border"><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Investido</p><p className="text-2xl md:text-3xl font-semibold mt-2">{formatCurrency(kpi.investimento)}</p><p className="text-xs text-muted-foreground mt-2">{formatCurrency(kpi.investimento / Math.max(1, Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) + 1))} por dia</p></div>
                            <div className="p-5 border-b xl:border-b-0 sm:border-r border-border"><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Mensagens iniciadas</p><p className="text-2xl md:text-3xl font-semibold mt-2">{formatNumber(mensagensIniciadas)}</p><p className="text-xs text-muted-foreground mt-2">{custoPorMensagem > 0 ? `${formatCurrency(custoPorMensagem)} por mensagem` : "sem campanha de mensagens"}</p></div>
                            <div className="p-5 border-b sm:border-b-0 sm:border-r border-border"><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Receita comercial</p><p className="text-2xl md:text-3xl font-semibold mt-2 text-emerald-300">{formatCurrency(receitaTotal)}</p><p className="text-xs text-muted-foreground mt-2">{kpi.revenueLineage?.label ?? "origem não declarada"}</p></div>
                            <div className="p-5"><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Cada R$ 1 virou</p><p className="text-2xl md:text-3xl font-semibold mt-2" style={{ color: kpi.roas >= 2 ? "#fb7185" : "#fbbf24" }}>{kpi.roas.toFixed(2)}x</p><p className="text-xs text-muted-foreground mt-2">ROAS do período</p></div>
                          </section>

                          <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span><strong className="text-foreground">Receita:</strong> {kpi.revenueLineage?.label ?? "origem não declarada"}{kpi.revenueLineage?.updatedAt ? ` · atualização ${new Date(kpi.revenueLineage.updatedAt).toLocaleString("pt-BR")}` : ""}</span>
                            <span><strong className="text-foreground">ROAS:</strong> {kpi.revenueLineage?.roasFormula ?? "fórmula não declarada"}</span>
                          </div>

                          {cirurgias > 0 && receitaCirurgiasPct >= 50 && <div className="rounded-xl border p-4 flex gap-3" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.32)" }}><span className="text-amber-300 mt-0.5">●</span><p className="text-sm leading-relaxed text-foreground"><strong className="text-amber-200">{formatPercent(receitaCirurgiasPct)} do retorno vem de fechamentos.</strong> O resultado é positivo, mas a receita ainda está concentrada em vendas de maior ticket. Acompanhe o volume de consultas e a taxa de fechamento.</p></div>}

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <section className="rounded-xl border border-border bg-card p-5"><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-5">Do anúncio à conversão</p><div className="space-y-4">{funil.map((item, index) => <div key={item.label}><div className="flex items-baseline justify-between gap-3"><span className="text-sm font-medium">{item.label}</span><strong className="text-sm">{formatNumber(item.value)}</strong></div><div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(7, (item.value / maxFunil) * 100)}%`, background: index === funil.length - 1 ? "#6ee7b7" : "#fb4364" }} /></div>{item.note && <p className="text-[11px] text-muted-foreground mt-1.5">{item.note}{index === funil.length - 1 ? " · aqui está o gargalo comercial" : ""}</p>}</div>)}</div></section>
                            <section className="rounded-xl border border-border bg-card p-5"><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-5">De onde vem o faturamento</p><div className="flex flex-col sm:flex-row items-center gap-6 h-full justify-center"><div className="w-36 h-36 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#6ee7b7 0 ${receitaCirurgiasPct}%, #fb4364 ${receitaCirurgiasPct}% 100%)` }}><div className="w-24 h-24 rounded-full bg-card flex flex-col items-center justify-center"><span className="text-xl font-semibold">{formatPercent(receitaCirurgiasPct)}</span><span className="text-[10px] text-muted-foreground">fechamentos</span></div></div><div className="space-y-3 text-sm"><p><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-300 mr-2" />Fechamentos <strong className="ml-2">{formatCurrency(cirurgias)}</strong> · {formatNumber(kpi.vendas)} venda(s)</p><p><span className="inline-block w-2.5 h-2.5 rounded-sm mr-2" style={{ background: "#fb4364" }} />Consultas <strong className="ml-2">{formatCurrency(receitaConsultas)}</strong> · {formatNumber(consultas)} consulta(s)</p></div></div></section>
                          </div>

                          <section><SectionHeader title="Custo de aquisição" /><div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden border border-border bg-card">{[{ label: "Por lead", value: formatCurrency(kpi.custoPorLead), sub: "métrica de mídia" }, { label: "Por consulta", value: formatCurrency(kpi.custoPorConsulta), sub: `${formatNumber(consultas)} consultas` }, { label: "Por clique", value: formatCurrency(kpi.custoPorClique ?? 0), sub: `${formatNumber(kpi.cliquesEstimados ?? 0)} cliques` }, { label: "Por fechamento", value: formatCurrency(kpi.custoPorVenda), sub: `${formatNumber(kpi.vendas)} venda(s)` }].map((item) => <div key={item.label} className="p-4 border-b lg:border-b-0 border-r last:border-r-0 border-border"><p className="text-[11px] text-muted-foreground">{item.label}</p><p className="text-lg font-semibold mt-1">{item.value}</p><p className="text-[11px] text-muted-foreground mt-1">{item.sub}</p></div>)}</div></section>

                          <section><SectionHeader title="Receita" /><div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden border border-border bg-card">{[{ label: "Em consultas", value: formatCurrency(receitaConsultas) }, { label: "Em fechamentos", value: formatCurrency(cirurgias) }, { label: "Ticket médio", value: formatCurrency(kpi.ticketMedio) }, { label: "Total", value: formatCurrency(receitaTotal) }].map((item) => <div key={item.label} className="p-4 border-b lg:border-b-0 border-r last:border-r-0 border-border"><p className="text-[11px] text-muted-foreground">{item.label}</p><p className="text-lg font-semibold mt-1">{item.value}</p></div>)}</div></section>

                          {(instagram.alcance > 0 || instagram.seguidores > 0) && <section><SectionHeader title="Presença no Instagram" /><div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden border border-border bg-card">{[{ label: "Alcance", value: formatNumber(instagram.alcance) }, { label: "Visitas / cliques", value: formatNumber(instagram.cliques) }, { label: "Novos seguidores", value: formatNumber(instagram.seguidores) }, { label: "Total de seguidores", value: formatNumber(instagram.totalSeguidores) }].map((item) => <div key={item.label} className="p-4 border-b lg:border-b-0 border-r last:border-r-0 border-border"><p className="text-[11px] text-muted-foreground">{item.label}</p><p className="text-lg font-semibold mt-1">{item.value}</p></div>)}</div></section>}
                        </>;
                      })()}

                      {/* Campaign breakdown */}
                      {kpi.campanhas && (
                        <>
                          <SectionHeader title="Breakdown por Tipo de Campanha" />
                          <div className="flex gap-6 flex-wrap">
                            {kpi.campanhas.mensagens.investimento > 0 && (
                              <div className="shrink-0">
                                <div className="flex items-center gap-2 mb-2"><span className="text-xs font-semibold text-muted-foreground">💬 Mensagens (WPP)</span></div>
                                <div className="grid grid-cols-3 gap-2">
                                  <KpiCard label="Investimento" value={formatCurrency(kpi.campanhas.mensagens.investimento)} icon={DollarSign} gradient="linear-gradient(135deg, #E63946, #c1121f)" />
                                  <KpiCard label="Leads" value={formatNumber(kpi.campanhas.mensagens.leads)} icon={Users} />
                                  <KpiCard label="Custo/Lead" value={formatCurrency(kpi.campanhas.mensagens.custoPorLead)} icon={Target} alert={kpi.campanhas.mensagens.custoPorLead > 100} />
                                </div>
                              </div>
                            )}
                            {kpi.campanhas.visitas.investimento > 0 && (
                              <div className="shrink-0">
                                <div className="flex items-center gap-2 mb-2"><span className="text-xs font-semibold text-muted-foreground">👁 Visitas ao Perfil</span></div>
                                <div className="grid grid-cols-3 gap-2">
                                  <KpiCard label="Investimento" value={formatCurrency(kpi.campanhas.visitas.investimento)} icon={DollarSign} gradient="linear-gradient(135deg, #E63946, #c1121f)" />
                                  <KpiCard label="Alcance" value={formatNumber(kpi.campanhas.visitas.alcance)} icon={Eye} />
                                  {kpi.campanhas.visitas.custoPorVisita > 0 ? <KpiCard label="Custo/Visita" value={formatCurrency(kpi.campanhas.visitas.custoPorVisita)} icon={Target} /> : <div />}
                                </div>
                              </div>
                            )}
                            {kpi.campanhas.formulario.investimento > 0 && (
                              <div className="shrink-0">
                                <div className="flex items-center gap-2 mb-2"><span className="text-xs font-semibold text-muted-foreground">🔗 Formulário / Link</span></div>
                                <div className="grid grid-cols-3 gap-2">
                                  <KpiCard label="Investimento" value={formatCurrency(kpi.campanhas.formulario.investimento)} icon={DollarSign} gradient="linear-gradient(135deg, #E63946, #c1121f)" />
                                  <KpiCard label="Cliques" value={formatNumber(kpi.campanhas.formulario.cliques)} icon={MousePointer} />
                                  {kpi.campanhas.formulario.custoPorClique > 0 ? <KpiCard label="Custo/Clique" value={formatCurrency(kpi.campanhas.formulario.custoPorClique)} icon={Target} /> : <div />}
                                </div>
                              </div>
                            )}
                            {(kpi.campanhas.video?.investimento ?? 0) > 0 && (
                              <div className="shrink-0">
                                <div className="flex items-center gap-2 mb-2"><span className="text-xs font-semibold text-muted-foreground">🎬 Vídeo</span></div>
                                <div className="grid grid-cols-3 gap-2">
                                  <KpiCard label="Investimento" value={formatCurrency(kpi.campanhas.video!.investimento)} icon={DollarSign} gradient="linear-gradient(135deg, #E63946, #c1121f)" />
                                  <KpiCard label="Visualizações" value={formatNumber(kpi.campanhas.video!.visualizacoes)} icon={Eye} />
                                  {kpi.campanhas.video!.custoPorVisualizacao > 0 ? <KpiCard label="Custo/View" value={formatCurrency(kpi.campanhas.video!.custoPorVisualizacao)} icon={Target} /> : <div />}
                                </div>
                              </div>
                            )}
                            {(kpi.campanhas.outros?.investimento ?? 0) > 0 && (
                              <div className="shrink-0">
                                <div className="flex items-center gap-2 mb-2"><span className="text-xs font-semibold text-muted-foreground">❔ Outras (sem tipo reconhecido)</span></div>
                                <div className="grid grid-cols-1 gap-2">
                                  <KpiCard label="Investimento" value={formatCurrency(kpi.campanhas.outros!.investimento)} icon={DollarSign} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Uma linha por campanha: é aqui que a gestora confere se cada
                              uma caiu na gaveta certa. O tipo vem do nome, do objetivo no
                              Meta ou do resultado gerado, nessa ordem. */}
                          {(kpi.campanhasDetalhe?.length ?? 0) > 0 && (
                            <div className="rounded-xl border border-border overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-border flex items-baseline justify-between gap-3 flex-wrap">
                                <p className="text-xs font-semibold">Campanhas do período · como cada uma foi classificada</p>
                                <p className="text-[11px] text-muted-foreground">O tipo sai do nome da campanha; se o nome não diz, do objetivo no Meta; senão, do que ela gerou.</p>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                                  <thead>
                                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                      <th className="text-left px-4 py-2 font-semibold">Campanha</th>
                                      <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                                      <th className="text-left px-3 py-2 font-semibold">Objetivo (Meta)</th>
                                      <th className="text-right px-3 py-2 font-semibold">Investimento</th>
                                      <th className="text-right px-3 py-2 font-semibold">Conversas</th>
                                      <th className="text-right px-3 py-2 font-semibold">Leads form.</th>
                                      <th className="text-right px-3 py-2 font-semibold">Views</th>
                                      <th className="text-right px-4 py-2 font-semibold">Alcance</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {kpi.campanhasDetalhe!.map((c, i) => (
                                      <tr key={`${c.nome}-${i}`} className="border-t border-border/60">
                                        <td className="px-4 py-2 max-w-[320px] truncate" title={c.nome}>{c.nome || "(sem nome)"}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{ROTULO_TIPO[c.tipo] ?? c.tipo}</td>
                                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.objective?.replace(/^OUTCOME_/, "").toLowerCase() ?? "—"}</td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(c.investimento)}</td>
                                        <td className="px-3 py-2 text-right">{c.conversas ? formatNumber(c.conversas) : "—"}</td>
                                        <td className="px-3 py-2 text-right">{c.leadsFormulario ? formatNumber(c.leadsFormulario) : "—"}</td>
                                        <td className="px-3 py-2 text-right">{c.visualizacoes ? formatNumber(c.visualizacoes) : "—"}</td>
                                        <td className="px-4 py-2 text-right">{c.alcance ? formatNumber(c.alcance) : "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Charts */}
                      {trendData && trendData.length > 0 && (
                        <>
                          <SectionHeader title="Tendências Históricas" />
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="kpi-card p-5">
                              <div className="text-xs font-semibold uppercase tracking-wide mb-4 text-muted-foreground">Investimento vs Vendas</div>
                              <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={trendData}>
                                  <defs>
                                    <linearGradient id="gradBlue2" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#E63946" stopOpacity={0.20} /><stop offset="95%" stopColor="#E63946" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradGreen2" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#E63946" stopOpacity={0.20} /><stop offset="95%" stopColor="#E63946" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 6" stroke="oklch(0.20 0.008 20)" />
                                  <XAxis dataKey="date" tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 10 }} />
                                  <YAxis tick={{ fill: "oklch(0.45 0.010 60)", fontSize: 10 }} />
                                  <Tooltip content={<ChartTooltip />} />
                                  <Area type="monotone" dataKey="investimento" name="Investimento" stroke="oklch(0.55 0.22 25)" fill="url(#gradBlue2)" strokeWidth={2} />
                                  <Area type="monotone" dataKey="totalEmVendas" name="Total Vendas" stroke="#E63946" fill="url(#gradGreen2)" strokeWidth={2} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="kpi-card p-5">
                              <div className="text-xs font-semibold uppercase tracking-wide mb-4 text-muted-foreground">Leads vs Vendas</div>
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

                      {!activeClient && !kpiLoading && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border-2 border-dashed border-border">
                          <div className="text-sm font-medium text-muted-foreground">Nenhum cliente selecionado</div>
                        </div>
                      )}
                      <div className="text-xs text-center pt-4 border-t border-border text-muted-foreground/60">
                        ADS Dashboard · Meta Ads API + Planilha de Vendas
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ═══ TAB: CRM ═══ */}
              {activeTab === "crm" && (
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-card border border-border">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
                    <select value={crmDateField} onChange={e => setCrmDateField(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-lg text-xs outline-none bg-background border border-border text-foreground">
                      <option value="any">Consulta ou Conversão</option>
                      <option value="consult">Data de Consulta</option>
                      <option value="conversion">Data de Conversão</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <input type="date" value={crmDateFrom} onChange={e => setCrmDateFrom(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs outline-none bg-background border border-border text-foreground" />
                      <span className="text-xs text-muted-foreground">até</span>
                      <input type="date" value={crmDateTo} onChange={e => setCrmDateTo(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs outline-none bg-background border border-border text-foreground" />
                    </div>
                    {[0, 1, 2].map(offset => {
                      const d = new Date(); d.setMonth(d.getMonth() - offset);
                      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
                      const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
                      const to = offset === 0 ? new Date().toISOString().slice(0, 10) : new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
                      const isActive = crmDateFrom === from && crmDateTo === to;
                      return (
                        <button key={offset} onClick={() => { setCrmDateFrom(from); setCrmDateTo(to); }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border"
                          style={{ background: isActive ? "rgba(230,57,70,0.12)" : "transparent", borderColor: isActive ? "rgba(230,57,70,0.40)" : "oklch(0.22 0.008 20)", color: isActive ? "#E63946" : "oklch(0.70 0.010 30)" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {leadsData && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      <div className="kpi-card px-4 py-3"><div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Total no Período</div><div className="text-2xl font-bold text-primary">{leadsData.total}</div></div>
                      <div className="kpi-card px-4 py-3"><div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Com Consulta</div><div className="text-2xl font-bold" style={{ color: "#c1121f" }}>{(leadsData as any).withConsult ?? 0}</div></div>
                      <div className="kpi-card px-4 py-3"><div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Convertidos</div><div className="text-2xl font-bold" style={{ color: "#E63946" }}>{(leadsData as any).withConversion ?? 0}</div></div>
                      <div className="kpi-card px-4 py-3"><div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">Taxa Conversão</div><div className="text-2xl font-bold" style={{ color: "oklch(0.65 0.18 55)" }}>{(leadsData as any).withConsult > 0 ? `${(((leadsData as any).withConversion / (leadsData as any).withConsult) * 100).toFixed(0)}%` : "—"}</div></div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48 bg-card border border-border">
                      <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <input type="text" placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground/50" />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none bg-card border border-border text-foreground">
                      <option value="">Todos os status</option>
                      {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={originFilter} onChange={e => setOriginFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none bg-card border border-border text-foreground">
                      <option value="">Todas as origens</option>
                      {uniqueOrigins.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <button onClick={() => refetchLeads()} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30">
                      <RefreshCw className="w-3 h-3" /> Atualizar
                    </button>
                  </div>
                  {leadsLoading ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Carregando leads...</div>
                  ) : filteredLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border-2 border-dashed border-border"><div className="text-sm text-muted-foreground">Nenhum lead encontrado</div></div>
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
                          <tbody>{filteredLeads.map((lead: any) => <LeadRow key={lead.mondayId} lead={lead} />)}</tbody>
                        </table>
                      </div>
                      <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">Mostrando {filteredLeads.length} de {leadsData?.total ?? 0} leads</div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ TAB: CONTEÚDOS ═══ */}
              {activeTab === "conteudos" && (
                <div>
                  {postsLoading ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Carregando posts...</div>
                  ) : postsData?.error === "instagram_not_configured" ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-border">
                      <Instagram className="w-8 h-8 text-muted-foreground" />
                      <div className="text-sm font-medium text-muted-foreground">Instagram não conectado</div>
                      <div className="text-xs text-muted-foreground/70">Configure o Instagram deste cliente nas configurações</div>
                    </div>
                  ) : postsData?.posts?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border-2 border-dashed border-border"><div className="text-sm text-muted-foreground">Nenhum post encontrado</div></div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">Top {postsData?.posts?.length ?? 0} posts por engajamento</span>
                        </div>
                        <button onClick={() => refetchPosts()} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30">
                          <RefreshCw className="w-3 h-3" /> Atualizar
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {postsData?.posts?.map((post: any) => <PostCard key={post.id} post={post} />)}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ═══ TAB: CRIATIVOS ═══ */}
              {activeTab === "criativos" && (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎨</span>
                      <span className="text-sm font-semibold text-foreground">Criativos Ativos no Tráfego</span>
                      <span className="text-xs text-muted-foreground">{dateRange.from} → {dateRange.to}</span>
                    </div>
                    <button onClick={() => refetchCreatives()} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30">
                      <RefreshCw className="w-3 h-3" /> Atualizar
                    </button>
                  </div>
                  {creativesLoading ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Buscando criativos...</div>
                  ) : creativesData?.error === "meta_not_configured" ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-border">
                      <span className="text-3xl">📷</span>
                      <div className="text-sm font-medium text-muted-foreground">Meta Ads não conectado</div>
                    </div>
                  ) : !creativesData?.creatives?.length ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border-2 border-dashed border-border"><div className="text-sm text-muted-foreground">Nenhum criativo ativo encontrado</div></div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {creativesData.creatives.map((cr: any) => (
                        <div key={cr.adId} className="kpi-card overflow-hidden">
                          <div className="relative aspect-square bg-muted overflow-hidden">
                            {cr.thumbnailUrl ? <img src={cr.thumbnailUrl} alt={cr.adName} className="w-full h-full object-contain" loading="lazy" /> : (
                              <div className="w-full h-full flex items-center justify-center text-3xl text-muted-foreground">{cr.format === "video" ? "🎥" : cr.format === "carousel" ? "📷" : "🖼️"}</div>
                            )}
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

          {/* Right Panel: Análise IA */}
          {RECURSOS_IA_ATIVOS && showRightPanel && activeClient && (
            <div className="hidden lg:flex flex-col w-[420px] xl:w-[480px] flex-shrink-0 border-l border-border bg-card/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
                <div>
                  <p className="text-xs font-semibold text-foreground">{activeClientName}</p>
                  <p className="text-[10px] text-muted-foreground">{dateRange.from} até {dateRange.to}</p>
                </div>
                <button
                  onClick={() => {
                    if (!activeClient || !token) return;
                    setReportAnalysis(null);
                    setReportAnalysisLoading(true);
                    generateReportMutation.mutate(
                      { token: token!, clientId: activeClient, from: dateRange.from, to: dateRange.to, clientName: activeClientName },
                      {
                        onSuccess: (data) => { setReportAnalysis(typeof data.analysis === 'string' ? data.analysis : null); setReportAnalysisLoading(false); },
                        onError: () => { setReportAnalysis(null); setReportAnalysisLoading(false); },
                      }
                    );
                  }}
                  disabled={reportAnalysisLoading}
                  className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-white/50 hover:bg-primary/20 hover:text-primary transition-colors border border-white/10 disabled:opacity-40">
                  {reportAnalysisLoading ? '⏳ Gerando...' : '🔄 Regerar'}
                </button>
              </div>
              <div className="overflow-y-auto p-4" style={{ flex: '0 0 55%', borderBottom: '1px solid oklch(0.25 0.01 30)' }}>
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
                    <button onClick={() => { navigator.clipboard.writeText(reportAnalysis ?? ''); toast.success('Análise copiada!'); }}
                      className="text-[10px] px-3 py-1.5 rounded-full bg-white/5 text-white/50 hover:bg-primary/20 hover:text-primary transition-colors border border-white/10 w-full">
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
              {/* Chat IA para editar análise */}
              <div className="flex-1 flex flex-col overflow-hidden border-t border-border">
                <div className="px-4 py-2 flex-shrink-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Personalizar Relatório</p>
                  <p className="text-[10px] text-muted-foreground/60">{activeClientName}</p>
                </div>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
                  {chatMessages.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/50 text-center py-4">
                      {reportAnalysis ? 'Peça para ajustar o texto, mudar o tom, adicionar perguntas...' : 'Gere a análise primeiro para poder editar.'}
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] text-[11px] rounded-xl px-3 py-1.5 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}>{msg.content}</div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted text-foreground text-[11px] rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Atualizando...</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Input */}
                <div className="px-3 pb-3 flex-shrink-0">
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                      placeholder={reportAnalysis ? 'Ex: reescreve mais curto, adiciona perguntinhas...' : 'Gere a análise primeiro...'}
                      disabled={!reportAnalysis || chatLoading}
                      className="flex-1 text-[11px] bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={!reportAnalysis || chatLoading || !chatInput.trim()}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: prévia e envio do relatório no WhatsApp */}
      {activeClient && token && (
        <EnviarWhatsApp
          open={showWhatsapp}
          onClose={() => setShowWhatsapp(false)}
          managerToken={token}
          clientId={activeClient}
          clientName={activeClientName}
          from={dateRange.from}
          to={dateRange.to}
          onConfigurarGrupo={() => { setShowWhatsapp(false); navigate(`/manager/client/${activeClient}`); }}
        />
      )}

      {/* Modal: Novo Cliente */}
      <Dialog open={showNewClient} onOpenChange={setShowNewClient}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome do cliente</Label>
              <Input placeholder="Ex: Dr. João Silva" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newClientName.trim() && token) createClient.mutate({ token, name: newClientName.trim() }); }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClient(false)}>Cancelar</Button>
            <Button disabled={!newClientName.trim() || createClient.isPending}
              onClick={() => { if (token && newClientName.trim()) createClient.mutate({ token, name: newClientName.trim() }); }}>
              {createClient.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir cliente</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Tem certeza que deseja excluir <strong>{deleteConfirm?.name}</strong>? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteClient.isPending}
              onClick={() => { if (token && deleteConfirm) deleteClient.mutate({ token, clientId: deleteConfirm.id }); }}>
              {deleteClient.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
