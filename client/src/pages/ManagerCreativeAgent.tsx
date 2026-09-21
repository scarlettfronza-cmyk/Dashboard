import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, Check, ClipboardCopy, FileText, Lightbulb, Loader2, Sparkles, TestTube2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { normalizeRankingDateRange } from "@/lib/rankingDateRange";
import { toast } from "sonner";

type Client = { id: number; name: string };
type BriefStatus = "draft" | "approved" | "rejected" | "tested";
type Brief = {
  id: number;
  title: string;
  objective: string;
  targetAudience: string | null;
  hypothesis: string;
  hook: string;
  angle: string;
  coreMessage: string;
  visualDirection: string;
  script: string;
  primaryText: string;
  headline: string;
  callToAction: string;
  format: string;
  variableToTest: string;
  successMetric: string;
  status: BriefStatus;
  priority: number;
  reviewNotes: string | null;
};

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function initialRange() { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29); return { from: isoDate(from), to: isoDate(to) }; }
function statusStyle(status: BriefStatus) {
  if (status === "approved") return { label: "Aprovado", color: "#6ee7b7", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.30)" };
  if (status === "rejected") return { label: "Descartado", color: "#fda4af", bg: "rgba(244,63,94,0.10)", border: "rgba(244,63,94,0.30)" };
  if (status === "tested") return { label: "Em teste", color: "#93c5fd", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.30)" };
  return { label: "Para revisão", color: "#fcd34d", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)" };
}

export default function ManagerCreativeAgent() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [range, setRange] = useState(initialRange);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { const saved = localStorage.getItem("manager_token"); if (!saved) { navigate("/manager/login"); return; } setToken(saved); }, [navigate]);
  const clientsQuery = trpc.managers.myClients.useQuery({ token: token! }, { enabled: !!token });
  const clients = (clientsQuery.data?.clients ?? []) as Client[];
  useEffect(() => { if (!clientId && clients.length) setClientId(clients[0].id); }, [clientId, clients]);

  const briefsQuery = trpc.managers.getCreativeBriefsAsManager.useQuery(
    { token: token!, clientId: clientId!, from: range.from, to: range.to },
    { enabled: !!token && !!clientId }
  );
  const generateMutation = trpc.managers.generateCreativeBriefsAsManager.useMutation({
    onSuccess: async (data) => { await briefsQuery.refetch(); toast.success(`${data.briefs.length} briefs criados a partir de ${data.sourcesUsed} criativo(s) de referência.`); },
    onError: (error) => toast.error(error.message || "Não foi possível gerar os briefs."),
  });
  const statusMutation = trpc.managers.updateCreativeBriefStatusAsManager.useMutation({
    onSuccess: async () => { await briefsQuery.refetch(); toast.success("Status do brief atualizado."); },
    onError: (error) => toast.error(error.message || "Não foi possível atualizar o brief."),
  });

  const briefs = (briefsQuery.data?.briefs ?? []) as Brief[];
  const counts = useMemo(() => ({ draft: briefs.filter((brief) => brief.status === "draft").length, approved: briefs.filter((brief) => brief.status === "approved").length, tested: briefs.filter((brief) => brief.status === "tested").length }), [briefs]);

  function updateRange(from: string, to: string) { const normalized = normalizeRankingDateRange(from, to); if (normalized) setRange(normalized); }
  function selectPreset(days: number) { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - (days - 1)); updateRange(isoDate(from), isoDate(to)); }
  function updateStatus(brief: Brief, status: BriefStatus) { if (!token || !clientId) return; statusMutation.mutate({ token, clientId, briefId: brief.id, status }); }
  function copyBrief(brief: Brief) {
    const text = `BRIEF: ${brief.title}\n\nObjetivo: ${brief.objective}\nPúblico: ${brief.targetAudience ?? "Não informado"}\n\nHipótese: ${brief.hypothesis}\n\nHook: ${brief.hook}\nÂngulo: ${brief.angle}\nMensagem central: ${brief.coreMessage}\nFormato: ${brief.format}\n\nDireção visual:\n${brief.visualDirection}\n\nRoteiro:\n${brief.script}\n\nTexto principal:\n${brief.primaryText}\n\nHeadline: ${brief.headline}\nCTA: ${brief.callToAction}\n\nVariável do teste: ${brief.variableToTest}\nMétrica de sucesso: ${brief.successMetric}`;
    navigator.clipboard.writeText(text).then(() => toast.success("Brief copiado para a área de transferência.")).catch(() => toast.error("Não foi possível copiar o brief."));
  }
  function generate() { if (!token || !clientId) return; generateMutation.mutate({ token, clientId, from: range.from, to: range.to }); }

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 md:px-7 py-4 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0"><button onClick={() => navigate("/manager/creative-analyst")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted" title="Voltar para Creative Analyst"><ArrowLeft className="w-4 h-4" /></button><div><div className="flex items-center gap-2"><TestTube2 className="w-4 h-4 text-fuchsia-300" /><h1 className="font-semibold text-base">Creative Agent</h1></div><p className="text-xs text-muted-foreground mt-0.5">Briefs de testes criados a partir de padrões aprovados.</p></div></div>
      <button onClick={() => briefsQuery.refetch()} disabled={briefsQuery.isFetching} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50">{briefsQuery.isFetching ? "Atualizando..." : "Atualizar"}</button>
    </header>

    <main className="max-w-7xl mx-auto px-4 md:px-7 py-6 space-y-6">
      <section className="rounded-2xl p-5 md:p-6 border" style={{ background: "linear-gradient(120deg, rgba(192,38,211,0.15), rgba(79,70,229,0.12))", borderColor: "rgba(232,121,249,0.28)" }}>
        <div className="flex flex-col xl:flex-row gap-5 xl:items-end xl:justify-between"><div className="max-w-2xl"><span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: "rgba(232,121,249,0.15)", color: "#f5d0fe" }}><Sparkles className="w-3 h-3" /> Nível 3 da IA Meta Ads</span><h2 className="text-xl md:text-2xl font-semibold mt-3">Transforme referências em testes executáveis.</h2><p className="text-sm text-muted-foreground mt-2 leading-relaxed">O agente usa criativos classificados como referência para criar três briefs. Você revisa, aprova ou descarta cada ideia antes de qualquer produção ou publicação.</p></div><button onClick={generate} disabled={!clientId || generateMutation.isPending} className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 text-white disabled:opacity-55" style={{ background: "#c026d3" }}>{generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{generateMutation.isPending ? "Criando briefs..." : "Gerar 3 briefs de teste"}</button></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-5"><div className="grid lg:grid-cols-[minmax(220px,1fr)_auto] gap-4 lg:items-end"><label className="block"><span className="text-xs font-medium">Cliente</span><select value={clientId ?? ""} onChange={(event) => setClientId(Number(event.target.value))} className="mt-1.5 w-full h-10 px-3 rounded-lg text-sm bg-background border border-border outline-none focus:border-fuchsia-400/60"><option value="" disabled>Selecione um cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><div className="flex flex-wrap gap-2 items-center"><button onClick={() => selectPreset(7)} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:border-fuchsia-400/50">7 dias</button><button onClick={() => selectPreset(30)} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:border-fuchsia-400/50">30 dias</button><div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-border bg-background"><CalendarDays className="w-3.5 h-3.5 text-fuchsia-300 ml-1" /><input type="date" value={range.from} onChange={(event) => updateRange(event.target.value, range.to)} className="h-7 px-1 text-xs bg-card border border-border rounded outline-none focus:border-fuchsia-400/60" /><span className="text-xs text-muted-foreground">até</span><input type="date" value={range.to} onChange={(event) => updateRange(range.from, event.target.value)} className="h-7 px-1 text-xs bg-card border border-border rounded outline-none focus:border-fuchsia-400/60" /></div></div></div></section>

      <section className="grid grid-cols-3 gap-3"><div className="rounded-xl p-4 border border-border bg-card"><span className="text-[11px] text-muted-foreground">Para revisão</span><p className="mt-1 text-xl font-semibold text-amber-300">{counts.draft}</p></div><div className="rounded-xl p-4 border border-border bg-card"><span className="text-[11px] text-muted-foreground">Aprovados</span><p className="mt-1 text-xl font-semibold text-emerald-300">{counts.approved}</p></div><div className="rounded-xl p-4 border border-border bg-card"><span className="text-[11px] text-muted-foreground">Em teste</span><p className="mt-1 text-xl font-semibold text-sky-300">{counts.tested}</p></div></section>

      <section className="rounded-xl border border-border bg-card overflow-hidden"><div className="p-4 md:p-5 border-b border-border"><h2 className="font-semibold text-sm">Plano de testes criativos</h2><p className="text-xs text-muted-foreground mt-1">Cada brief testa uma variável principal. Aprove um plano antes de enviar para criação.</p></div>{briefsQuery.isLoading ? <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-fuchsia-300" /></div> : briefs.length === 0 ? <div className="py-16 px-5 text-center"><FileText className="w-8 h-8 mx-auto text-muted-foreground/60" /><p className="text-sm text-muted-foreground mt-3">Nenhum brief criado neste período.</p><p className="text-xs text-muted-foreground mt-1">Analise os criativos no Creative Analyst e clique em “Gerar 3 briefs de teste”.</p></div> : <div className="grid lg:grid-cols-3 gap-4 p-4 md:p-5">{briefs.map((brief) => { const status = statusStyle(brief.status); const open = expanded === brief.id; return <article key={brief.id} className="rounded-xl border border-border bg-background/40 flex flex-col"><div className="p-4"><div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold px-2 py-1 rounded-full border" style={{ color: status.color, background: status.bg, borderColor: status.border }}>{status.label}</span><span className="text-xs text-muted-foreground">Prioridade {brief.priority}</span></div><h3 className="font-semibold text-sm mt-3 leading-snug">{brief.title}</h3><p className="text-xs text-muted-foreground mt-2 line-clamp-3">{brief.hypothesis}</p><div className="mt-3 flex flex-wrap gap-1.5"><span className="text-[11px] px-2 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-400/20">Hook: {brief.hook}</span><span className="text-[11px] px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-200 border border-cyan-400/20">Ângulo: {brief.angle}</span></div><div className="mt-3 p-3 rounded-lg border border-border bg-card"><p className="text-[10px] text-muted-foreground">Variável do teste</p><p className="text-xs mt-1 font-medium">{brief.variableToTest}</p><p className="text-[10px] text-muted-foreground mt-2">Métrica de sucesso</p><p className="text-xs mt-1 font-medium">{brief.successMetric}</p></div><button onClick={() => setExpanded(open ? null : brief.id)} className="mt-3 text-xs text-fuchsia-300 hover:text-fuchsia-200 font-semibold">{open ? "Ocultar brief completo" : "Ver brief completo"}</button>{open && <div className="mt-3 space-y-3 pt-3 border-t border-border"><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Direção visual</p><p className="text-xs leading-relaxed mt-1">{brief.visualDirection}</p></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Roteiro</p><p className="text-xs whitespace-pre-line leading-relaxed mt-1">{brief.script}</p></div><div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Copy</p><p className="text-xs whitespace-pre-line leading-relaxed mt-1">{brief.primaryText}</p><p className="text-xs font-semibold mt-2">{brief.headline}</p><p className="text-xs text-muted-foreground mt-1">CTA: {brief.callToAction} · Formato: {brief.format}</p></div></div>}</div><div className="mt-auto p-3 border-t border-border grid grid-cols-3 gap-2"><button onClick={() => updateStatus(brief, "approved")} disabled={statusMutation.isPending} className="h-8 rounded-lg text-[11px] font-semibold border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 flex items-center justify-center gap-1"><Check className="w-3 h-3" />Aprovar</button><button onClick={() => updateStatus(brief, "rejected")} disabled={statusMutation.isPending} className="h-8 rounded-lg text-[11px] font-semibold border border-rose-400/30 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 flex items-center justify-center gap-1"><X className="w-3 h-3" />Descartar</button><button onClick={() => copyBrief(brief)} className="h-8 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"><ClipboardCopy className="w-3 h-3" /></button></div></article>; })}</div>}</section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-5"><div className="flex gap-3"><Lightbulb className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" /><div><h2 className="font-semibold text-sm">Como usar o Creative Agent</h2><p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Aprove apenas os briefs que fazem sentido para o cliente. Depois de aprovado, copie o brief para sua equipe de criação. Quando a peça começar a rodar, marque-a como “Em teste” na próxima revisão. O agente organiza ideias, mas não cria anúncios nem altera campanhas automaticamente.</p></div></div></section>
    </main>
  </div>;
}
