import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Users, TrendingUp, Heart, MessageCircle, Share2, Bookmark, Eye, Clock,
  ExternalLink, Search, RefreshCw, Instagram, Target, Zap
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatNumber(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}
function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  "fechado": "oklch(0.55 0.18 145)",
  "agendado": "oklch(0.55 0.18 240)",
  "compareceu": "oklch(0.55 0.18 200)",
  "perdido": "oklch(0.50 0.15 20)",
  "cancelado": "oklch(0.50 0.12 30)",
  "não compareceu": "oklch(0.50 0.12 30)",
  "em atendimento": "oklch(0.55 0.18 60)",
  "aguardando": "oklch(0.55 0.12 60)",
};
function getStatusColor(status: string) {
  const s = status.toLowerCase();
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (s.includes(key)) return color;
  }
  return "oklch(0.45 0.010 240)";
}

// ─── Lead Row ────────────────────────────────────────────────────────────────
function LeadRow({ lead, matchMap }: { lead: any; matchMap: Record<string, any> }) {
  const normalizePhone = (p: string) => p.replace(/\D/g, "");
  const phone = normalizePhone(lead.phone ?? "");
  const suffix = phone.slice(-9);
  const match = matchMap[phone] ?? matchMap[suffix] ?? null;

  return (
    <tr className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: "oklch(0.25 0.012 255)" }}>
      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "oklch(0.85 0.010 240)" }}>
        {lead.name || "—"}
      </td>
      <td className="px-3 py-2.5 text-sm" style={{ color: "oklch(0.60 0.010 240)" }}>
        {lead.phone || "—"}
      </td>
      <td className="px-3 py-2.5">
        {lead.status ? (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: `${getStatusColor(lead.status)}22`, color: getStatusColor(lead.status), border: `1px solid ${getStatusColor(lead.status)}44` }}
          >
            {lead.status}
          </span>
        ) : <span style={{ color: "oklch(0.40 0.010 240)" }}>—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>
        {lead.origin || "—"}
      </td>
      {/* Campanha de origem (Meta Lead Ads) */}
      <td className="px-3 py-2.5">
        {match ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: "oklch(0.70 0.18 240)" }}>
              <Target className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[140px]" title={match.adName}>{match.adName || match.campaignName}</span>
            </span>
            {match.adName !== match.campaignName && match.campaignName && (
              <span className="text-[10px] truncate max-w-[140px]" style={{ color: "oklch(0.45 0.010 240)" }} title={match.campaignName}>
                {match.campaignName}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs" style={{ color: "oklch(0.35 0.010 240)" }}>—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>
        {lead.service || "—"}
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>
        {lead.consultDate ? formatDate(lead.consultDate) : "—"}
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>
        {lead.groupName || "—"}
      </td>
    </tr>
  );
}

// ─── Post Card ───────────────────────────────────────────────────────────────
function PostCard({ post }: { post: any }) {
  const ins = post.insights ?? {};
  const isReel = post.mediaType === "VIDEO";
  const thumb = post.thumbnailUrl ?? post.mediaUrl;

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.25 0.012 255)" }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-black overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="post" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: "oklch(0.40 0.010 240)" }}>
            <Instagram className="w-8 h-8" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: isReel ? "oklch(0.55 0.18 300 / 0.85)" : "oklch(0.55 0.18 240 / 0.85)", color: "white" }}
          >
            {isReel ? "REEL" : post.mediaType === "CAROUSEL_ALBUM" ? "CARROSSEL" : "FOTO"}
          </span>
        </div>
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 p-1 rounded-full"
          style={{ background: "oklch(0.12 0.012 255 / 0.8)" }}
        >
          <ExternalLink className="w-3 h-3" style={{ color: "oklch(0.70 0.010 240)" }} />
        </a>
      </div>

      {/* Caption */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-xs line-clamp-2" style={{ color: "oklch(0.55 0.010 240)" }}>
          {post.caption || "Sem legenda"}
        </p>
        <p className="text-xs mt-1" style={{ color: "oklch(0.38 0.010 240)" }}>
          {formatDate(post.timestamp)}
        </p>
      </div>

      {/* Metrics */}
      <div className="px-3 pb-3 mt-auto">
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {isReel && ins.views != null && (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5" style={{ background: "oklch(0.20 0.012 255)" }}>
              <Eye className="w-3 h-3" style={{ color: "oklch(0.55 0.18 240)" }} />
              <span className="text-xs font-bold" style={{ color: "oklch(0.85 0.010 240)" }}>{formatNumber(ins.views)}</span>
              <span className="text-[10px]" style={{ color: "oklch(0.45 0.010 240)" }}>views</span>
            </div>
          )}
          {!isReel && ins.reach != null && (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5" style={{ background: "oklch(0.20 0.012 255)" }}>
              <TrendingUp className="w-3 h-3" style={{ color: "oklch(0.55 0.18 240)" }} />
              <span className="text-xs font-bold" style={{ color: "oklch(0.85 0.010 240)" }}>{formatNumber(ins.reach)}</span>
              <span className="text-[10px]" style={{ color: "oklch(0.45 0.010 240)" }}>reach</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5" style={{ background: "oklch(0.20 0.012 255)" }}>
            <Heart className="w-3 h-3" style={{ color: "oklch(0.60 0.18 10)" }} />
            <span className="text-xs font-bold" style={{ color: "oklch(0.85 0.010 240)" }}>{formatNumber(ins.likes ?? 0)}</span>
            <span className="text-[10px]" style={{ color: "oklch(0.45 0.010 240)" }}>likes</span>
          </div>
          {ins.shares != null && ins.shares > 0 ? (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5" style={{ background: "oklch(0.20 0.012 255)" }}>
              <Share2 className="w-3 h-3" style={{ color: "oklch(0.60 0.18 145)" }} />
              <span className="text-xs font-bold" style={{ color: "oklch(0.85 0.010 240)" }}>{formatNumber(ins.shares)}</span>
              <span className="text-[10px]" style={{ color: "oklch(0.45 0.010 240)" }}>shares</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5" style={{ background: "oklch(0.20 0.012 255)" }}>
              <MessageCircle className="w-3 h-3" style={{ color: "oklch(0.60 0.18 60)" }} />
              <span className="text-xs font-bold" style={{ color: "oklch(0.85 0.010 240)" }}>{formatNumber(ins.comments ?? 0)}</span>
              <span className="text-[10px]" style={{ color: "oklch(0.45 0.010 240)" }}>coment.</span>
            </div>
          )}
          {isReel && ins.ig_reels_avg_watch_time != null && (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 col-span-3" style={{ background: "oklch(0.20 0.012 255)" }}>
              <Clock className="w-3 h-3" style={{ color: "oklch(0.60 0.18 300)" }} />
              <span className="text-xs font-bold" style={{ color: "oklch(0.85 0.010 240)" }}>{formatTime(ins.ig_reels_avg_watch_time)}</span>
              <span className="text-[10px]" style={{ color: "oklch(0.45 0.010 240)" }}>tempo médio</span>
            </div>
          )}
          {ins.saved != null && ins.saved > 0 && (
            <div className="flex flex-col items-center gap-0.5 rounded-lg py-1.5" style={{ background: "oklch(0.20 0.012 255)" }}>
              <Bookmark className="w-3 h-3" style={{ color: "oklch(0.60 0.18 200)" }} />
              <span className="text-xs font-bold" style={{ color: "oklch(0.85 0.010 240)" }}>{formatNumber(ins.saved)}</span>
              <span className="text-[10px]" style={{ color: "oklch(0.45 0.010 240)" }}>salvos</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────
export default function CRMPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeClient, setActiveClient] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"leads" | "posts">("leads");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [isAuthenticated, authLoading, navigate]);

  const { data: clients } = trpc.dashboard.getClients.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (clients && clients.length > 0 && !activeClient) {
      setActiveClient(clients[0].id);
    }
  }, [clients, activeClient]);

  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = (trpc as any).crm.getLeads.useQuery(
    { clientId: activeClient!, status: statusFilter || undefined, search: searchTerm || undefined },
    { enabled: !!activeClient && isAuthenticated && activeTab === "leads" }
  );

  const { data: matchMap = {}, refetch: refetchMatchMap } = (trpc as any).leadTracking.getMatchMap.useQuery(
    { clientId: activeClient! },
    { enabled: !!activeClient && isAuthenticated }
  );

  const syncLeadAdsMutation = (trpc as any).leadTracking.syncLeadAds.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Lead Ads sincronizados! ${data.synced} novos leads encontrados.`);
      refetchMatchMap();
    },
    onError: () => toast.error("Erro ao sincronizar Lead Ads"),
  });

  const sendCAPIMutation = (trpc as any).leadTracking.sendCAPIForClosedLeads.useMutation({
    onSuccess: (data: any) => {
      if (data.error === "capi_not_configured") {
        toast.error("Pixel ID e Token CAPI não configurados. Configure nas Configurações do cliente.");
      } else if (data.error === "monday_not_configured") {
        toast.error("Monday.com não configurado para este cliente");
      } else {
        const parts: string[] = [];
        if (data.sent > 0) parts.push(`${data.sent} Purchase`);
        if (data.scheduleSent > 0) parts.push(`${data.scheduleSent} Schedule`);
        if (parts.length > 0) {
          toast.success(`Meta CAPI: ${parts.join(" + ")} evento(s) enviados!`);
        } else {
          toast.info("Nenhum evento novo para enviar (todos já processados)");
        }
      }
    },
    onError: () => toast.error("Erro ao enviar conversões para o Meta"),
  });

  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = (trpc as any).crm.getTopPosts.useQuery(
    { clientId: activeClient!, limit: 20 },
    { enabled: !!activeClient && isAuthenticated && activeTab === "posts" }
  );

  const activeClientName = clients?.find(c => c.id === activeClient)?.name ?? "";

  // Filter leads by origin on frontend (to avoid extra backend call)
  const filteredLeads = useMemo(() => {
    if (!leadsData?.leads) return [];
    if (!originFilter) return leadsData.leads;
    return leadsData.leads.filter((l: any) =>
      l.origin.toLowerCase().includes(originFilter.toLowerCase())
    );
  }, [leadsData?.leads, originFilter]);

  const uniqueStatuses = useMemo(() => {
    if (!leadsData?.byStatus) return [];
    return Object.keys(leadsData.byStatus).sort();
  }, [leadsData?.byStatus]);

  const uniqueOrigins = useMemo(() => {
    if (!leadsData?.byOrigin) return [];
    return Object.keys(leadsData.byOrigin).sort();
  }, [leadsData?.byOrigin]);

  return (
    <div className="min-h-screen flex" style={{ background: "oklch(0.12 0.012 255)", color: "oklch(0.90 0.010 240)" }}>
      {/* Sidebar - client list */}
      <div className="w-56 shrink-0 border-r flex flex-col" style={{ borderColor: "oklch(0.22 0.012 255)", background: "oklch(0.13 0.012 255)" }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: "oklch(0.22 0.012 255)" }}>
          <button onClick={() => navigate("/dashboard")} className="text-xs flex items-center gap-1.5 mb-3 hover:opacity-80 transition-opacity" style={{ color: "oklch(0.55 0.010 240)" }}>
            ← Dashboard
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: "oklch(0.60 0.18 240)" }} />
            <span className="text-sm font-semibold">CRM & Conteúdo</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {clients?.map(client => (
            <button
              key={client.id}
              onClick={() => { setActiveClient(client.id); setSearchTerm(""); setStatusFilter(""); setOriginFilter(""); }}
              className="w-full text-left px-4 py-2.5 text-sm transition-all"
              style={{
                color: activeClient === client.id ? "oklch(0.85 0.010 240)" : "oklch(0.55 0.010 240)",
                background: activeClient === client.id ? "oklch(0.60 0.18 240 / 0.12)" : "transparent",
                borderLeft: activeClient === client.id ? "2px solid oklch(0.60 0.18 240)" : "2px solid transparent",
              }}
            >
              {client.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "oklch(0.22 0.012 255)" }}>
          <div>
            <h1 className="text-lg font-bold">{activeClientName}</h1>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.010 240)" }}>
              {activeTab === "leads" ? "Leads do Monday.com" : "Top Conteúdos do Instagram"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "leads" && (
              <>
                <button
                  onClick={() => syncLeadAdsMutation.mutate({ clientId: activeClient!, daysBack: 90 })}
                  disabled={syncLeadAdsMutation.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "oklch(0.55 0.18 240 / 0.15)", color: "oklch(0.70 0.18 240)", border: "1px solid oklch(0.55 0.18 240 / 0.30)" }}
                  title="Sincronizar leads do Meta Lead Ads para identificar campanha de origem"
                >
                  <Target className="w-3 h-3" />
                  {syncLeadAdsMutation.isPending ? "Sincronizando..." : "Sincronizar Lead Ads"}
                </button>
                <button
                  onClick={() => sendCAPIMutation.mutate({ clientId: activeClient! })}
                  disabled={sendCAPIMutation.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "oklch(0.55 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.55 0.18 145 / 0.30)" }}
                  title="Enviar fechamentos para a Meta Conversions API"
                >
                  <Zap className="w-3 h-3" />
                  {sendCAPIMutation.isPending ? "Enviando..." : "Enviar CAPI"}
                </button>
              </>
            )}
            <button
              onClick={() => activeTab === "leads" ? refetchLeads() : refetchPosts()}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "oklch(0.20 0.012 255)", color: "oklch(0.60 0.010 240)", border: "1px solid oklch(0.28 0.012 255)" }}
            >
              <RefreshCw className="w-3 h-3" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-4 border-b" style={{ borderColor: "oklch(0.22 0.012 255)" }}>
          <button
            onClick={() => setActiveTab("leads")}
            className="pb-3 text-sm font-medium transition-all border-b-2"
            style={{
              color: activeTab === "leads" ? "oklch(0.70 0.18 240)" : "oklch(0.50 0.010 240)",
              borderColor: activeTab === "leads" ? "oklch(0.70 0.18 240)" : "transparent",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Leads CRM
              {leadsData?.total != null && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.60 0.18 240)" }}>
                  {leadsData.total}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("posts")}
            className="pb-3 text-sm font-medium transition-all border-b-2"
            style={{
              color: activeTab === "posts" ? "oklch(0.70 0.18 300)" : "oklch(0.50 0.010 240)",
              borderColor: activeTab === "posts" ? "oklch(0.70 0.18 300)" : "transparent",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Instagram className="w-3.5 h-3.5" />
              Top Conteúdos
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ─── LEADS TAB ─── */}
          {activeTab === "leads" && (
            <div>
              {/* Alerts */}
              {leadsData?.pendingUpdate != null && leadsData.pendingUpdate > 0 && (
                <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "oklch(0.55 0.18 60 / 0.10)", border: "1px solid oklch(0.55 0.18 60 / 0.25)" }}>
                  <span className="text-lg">⚠️</span>
                  <div>
                    <span className="text-sm font-semibold" style={{ color: "oklch(0.75 0.18 60)" }}>
                      {leadsData.pendingUpdate} lead{leadsData.pendingUpdate > 1 ? "s" : ""} aguardando atualização
                    </span>
                    <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.010 240)" }}>
                      Leads com consulta agendada mas sem status de conversão
                    </p>
                  </div>
                </div>
              )}

              {/* Summary stats */}
              {leadsData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="rounded-xl px-4 py-3" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.25 0.012 255)" }}>
                    <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "oklch(0.50 0.010 240)" }}>Total Leads</div>
                    <div className="text-2xl font-bold" style={{ color: "oklch(0.70 0.18 240)" }}>{leadsData.total}</div>
                  </div>
                  {Object.entries(leadsData.byStatus ?? {}).slice(0, 3).map(([status, count]) => (
                    <div key={status} className="rounded-xl px-4 py-3" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.25 0.012 255)" }}>
                      <div className="text-xs uppercase tracking-wide mb-1 truncate" style={{ color: "oklch(0.50 0.010 240)" }}>{status}</div>
                      <div className="text-2xl font-bold" style={{ color: getStatusColor(status) }}>{count as number}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.28 0.012 255)" }}>
                  <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.50 0.010 240)" }} />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou telefone..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-transparent text-sm outline-none flex-1 placeholder:text-[oklch(0.40_0.010_240)]"
                    style={{ color: "oklch(0.85 0.010 240)" }}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.28 0.012 255)", color: "oklch(0.70 0.010 240)" }}
                >
                  <option value="">Todos os status</option>
                  {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={originFilter}
                  onChange={e => setOriginFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.28 0.012 255)", color: "oklch(0.70 0.010 240)" }}
                >
                  <option value="">Todas as origens</option>
                  {uniqueOrigins.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Table */}
              {leadsLoading ? (
                <div className="flex items-center justify-center py-20" style={{ color: "oklch(0.50 0.010 240)" }}>
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Carregando leads do Monday...
                </div>
              ) : leadsData?.error === "monday_not_configured" ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl" style={{ border: "1px dashed oklch(0.30 0.012 255)" }}>
                  <div className="text-sm font-medium" style={{ color: "oklch(0.55 0.010 240)" }}>Monday.com não configurado</div>
                  <div className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>Configure o board do Monday nas configurações do cliente</div>
                </div>
              ) : leadsData?.error === "no_board_id" ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl" style={{ border: "1px dashed oklch(0.30 0.012 255)" }}>
                  <div className="text-sm font-medium" style={{ color: "oklch(0.55 0.010 240)" }}>Board ID não configurado</div>
                  <div className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>Adicione o ID do board do Monday nas configurações</div>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl" style={{ border: "1px dashed oklch(0.30 0.012 255)" }}>
                  <div className="text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>Nenhum lead encontrado</div>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.25 0.012 255)" }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr style={{ background: "oklch(0.16 0.012 255)", borderBottom: "1px solid oklch(0.25 0.012 255)" }}>
                          {["Nome", "Telefone", "Status", "Origem", "Campanha", "Procedimento", "Consulta", "Grupo"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "oklch(0.50 0.010 240)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads.map((lead: any) => <LeadRow key={lead.mondayId} lead={lead} matchMap={matchMap} />)}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 text-xs" style={{ color: "oklch(0.40 0.010 240)", borderTop: "1px solid oklch(0.22 0.012 255)" }}>
                    Mostrando {filteredLeads.length} de {leadsData?.total ?? 0} leads
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── POSTS TAB ─── */}
          {activeTab === "posts" && (
            <div>
              {postsLoading ? (
                <div className="flex items-center justify-center py-20" style={{ color: "oklch(0.50 0.010 240)" }}>
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Carregando posts do Instagram...
                </div>
              ) : postsData?.error === "instagram_not_configured" ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl" style={{ border: "1px dashed oklch(0.30 0.012 255)" }}>
                  <Instagram className="w-8 h-8" style={{ color: "oklch(0.50 0.010 240)" }} />
                  <div className="text-sm font-medium" style={{ color: "oklch(0.55 0.010 240)" }}>Instagram não conectado</div>
                  <div className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>Conecte o Instagram deste cliente nas configurações</div>
                </div>
              ) : postsData?.posts?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl" style={{ border: "1px dashed oklch(0.30 0.012 255)" }}>
                  <div className="text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>Nenhum post encontrado</div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.60 0.18 300)" }} />
                    <span className="text-sm font-medium" style={{ color: "oklch(0.70 0.010 240)" }}>
                      Top {postsData?.posts?.length ?? 0} posts por engajamento
                    </span>
                    <span className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>— ordenados por interações + compartilhamentos + salvamentos</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {postsData?.posts?.map((post: any) => <PostCard key={post.id} post={post} />)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
