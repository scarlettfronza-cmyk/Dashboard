import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, Loader2, RefreshCw, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";

type RankingItem = {
  clientId: number; clientName: string; category: "atencao" | "oportunidade" | "estabilidade" | "dados_incompletos";
  priority: string; cpl: number; costPerConsult: number; roas: number;
  metrics: { investimento: number; leads: number; consultas: number; fechamentos: number; receita: number };
  targets: { cpl: number | null; costPerConsult: number | null; roas: number | null };
  evidence: string[]; recommendation: string;
};

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function initialRange() { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29); return { from: iso(from), to: iso(to) }; }
function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0); }
function planTitle(item: RankingItem) {
  if (item.category === "atencao") return "Plano de correção prioritário";
  if (item.category === "oportunidade") return "Plano de escala controlada";
  if (item.category === "estabilidade") return "Plano de manutenção e teste";
  return "Plano de configuração";
}
function testVariable(item: RankingItem) {
  if (item.category === "atencao") return "Criativo, hook ou oferta, mantendo público e orçamento estáveis.";
  if (item.category === "oportunidade") return "Aumentar investimento de forma gradual, mantendo o criativo vencedor como controle.";
  if (item.category === "estabilidade") return "Testar uma variação de criativo por vez, preservando a campanha atual como controle.";
  return "Completar a conexão Meta e as metas comerciais antes de qualquer teste.";
}

export default function ManagerCampaignAgent() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [range, setRange] = useState(initialRange);
  const [approved, setApproved] = useState<number[]>([]);
  useEffect(() => { const saved = localStorage.getItem("manager_token"); if (!saved) { navigate("/manager/login"); return; } setToken(saved); }, [navigate]);
  const rankingQuery = trpc.managers.getOpportunityRankingAsManager.useQuery({ token: token!, from: range.from, to: range.to }, { enabled: !!token });
  const items = (rankingQuery.data?.items ?? []) as RankingItem[];
  const ordered = useMemo(() => [...items].sort((a, b) => (a.category === "atencao" ? -1 : a.category === "oportunidade" ? 0 : 1) - (b.category === "atencao" ? -1 : b.category === "oportunidade" ? 0 : 1)), [items]);

  return <div className="min-h-screen bg-background text-foreground"><header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 md:px-7 py-4 border-b border-border bg-card/95 backdrop-blur"><div className="flex items-center gap-3"><button onClick={() => navigate("/manager/dashboard")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button><div><div className="flex items-center gap-2"><Target className="w-4 h-4 text-amber-300" /><h1 className="font-semibold text-base">Campaign Agent</h1></div><p className="text-xs text-muted-foreground mt-0.5">Planos de campanha com revisão humana obrigatória.</p></div></div><button onClick={() => rankingQuery.refetch()} className="h-9 px-3 rounded-lg border border-border text-xs font-semibold flex items-center gap-2 hover:bg-muted"><RefreshCw className={`w-3.5 h-3.5 ${rankingQuery.isFetching ? "animate-spin" : ""}`} />Atualizar</button></header>
    <main className="max-w-7xl mx-auto px-4 md:px-7 py-6 space-y-6"><section className="rounded-2xl p-5 md:p-6 border" style={{ background: "linear-gradient(120deg, rgba(245,158,11,0.14), rgba(14,165,233,0.10))", borderColor: "rgba(245,158,11,0.25)" }}><div className="flex gap-3"><ShieldCheck className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" /><div><h2 className="text-xl font-semibold">O que testar, manter ou corrigir hoje</h2><p className="text-sm text-muted-foreground mt-2 leading-relaxed">Os planos usam métricas reais, metas de CPL, custo por consulta e ROAS. O agente não cria, pausa ou altera campanhas na Meta.</p></div></div></section>
      <section className="rounded-xl border border-border bg-card p-4 md:p-5 flex flex-wrap items-end gap-3"><label><span className="text-xs font-medium">Início</span><input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className="mt-1.5 block h-10 px-3 rounded-lg text-sm bg-background border border-border" /></label><label><span className="text-xs font-medium">Fim</span><input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className="mt-1.5 block h-10 px-3 rounded-lg text-sm bg-background border border-border" /></label><div className="flex gap-2"><button onClick={() => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 6); setRange({ from: iso(from), to: iso(to) }); }} className="h-10 px-3 rounded-lg border border-border text-xs hover:bg-muted">7 dias</button><button onClick={() => setRange(initialRange())} className="h-10 px-3 rounded-lg border border-border text-xs hover:bg-muted">30 dias</button></div><div className="ml-auto text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Escolha o período de decisão</div></section>
      {rankingQuery.isLoading ? <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-amber-300" /></div> : ordered.length === 0 ? <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">Mapeie os clientes e conecte a Meta para gerar os primeiros planos.</div> : <section className="grid lg:grid-cols-2 gap-4">{ordered.map((item) => { const alert = item.category === "atencao"; const opportunity = item.category === "oportunidade"; const isApproved = approved.includes(item.clientId); return <article key={item.clientId} className={`rounded-xl border p-5 ${alert ? "border-rose-500/35 bg-rose-500/5" : opportunity ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}><div className="flex items-start justify-between gap-3"><div><p className={`text-[11px] font-semibold uppercase tracking-wide ${alert ? "text-rose-300" : opportunity ? "text-emerald-300" : "text-sky-300"}`}>{planTitle(item)}</p><h3 className="mt-1 font-semibold">{item.clientName}</h3></div>{alert ? <CircleAlert className="w-5 h-5 text-rose-300" /> : <TrendingUp className="w-5 h-5 text-emerald-300" />}</div><div className="grid grid-cols-3 gap-2 mt-4"><div className="rounded-lg border border-border/70 p-2"><p className="text-[10px] text-muted-foreground">Investimento</p><p className="text-xs font-semibold mt-1">{money(item.metrics.investimento)}</p></div><div className="rounded-lg border border-border/70 p-2"><p className="text-[10px] text-muted-foreground">Leads</p><p className="text-xs font-semibold mt-1">{item.metrics.leads}</p></div><div className="rounded-lg border border-border/70 p-2"><p className="text-[10px] text-muted-foreground">CPL</p><p className="text-xs font-semibold mt-1">{money(item.cpl)}</p></div></div><div className="mt-4 rounded-lg bg-background/55 p-3"><p className="text-[11px] font-semibold text-amber-200">Decisão recomendada</p><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.recommendation}</p></div><div className="mt-3"><p className="text-[11px] font-semibold text-sky-200">Variável de teste</p><p className="text-xs text-muted-foreground mt-1">{testVariable(item)}</p></div><ul className="mt-3 space-y-1">{item.evidence.slice(0, 2).map((evidence, index) => <li key={index} className="text-[11px] text-muted-foreground">• {evidence}</li>)}</ul><button onClick={() => setApproved((current) => current.includes(item.clientId) ? current : [...current, item.clientId])} className={`mt-4 h-9 w-full rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border ${isApproved ? "border-emerald-400/35 text-emerald-300 bg-emerald-500/10" : "border-amber-400/35 text-amber-200 hover:bg-amber-500/10"}`}>{isApproved ? <><CheckCircle2 className="w-3.5 h-3.5" />Plano revisado, aguardar execução manual</> : "Revisar plano antes de executar manualmente"}</button></article>; })}</section>}</main></div>;
}
