/**
 * Carteira: todos os clientes do período contra a meta de custo por lead.
 *
 * Responde "quem precisa de teste ou otimização?" sem abrir cliente por
 * cliente. O servidor consulta o Meta de cada um; a avaliação (shared/
 * carteira.ts) roda aqui, então mudar a meta recalcula na hora.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PeriodPicker } from "@/components/report/PeriodPicker";
import { avaliarCarteira, resumoCarteira, ROTULO_SITUACAO, GERA_LEAD, custoPorLead, type Situacao, type LinhaCarteira } from "@shared/carteira";

const T = {
  bg: "oklch(0.12 0.012 255)", bgCard: "oklch(0.16 0.012 255)", bgBorder: "oklch(0.24 0.012 255)",
  bgInput: "oklch(0.13 0.012 255)", textPrimary: "#fff", textSecondary: "oklch(0.80 0.010 240)", textMuted: "oklch(0.55 0.010 240)",
};
const MARCA = "#e63946";
const COR: Record<Situacao, string> = {
  acima: MARCA, sem_leads: MARCA, erro: "oklch(0.65 0.10 30)",
  atencao: "#eda100", dentro: "oklch(0.72 0.17 150)", sem_investimento: T.textMuted, sem_meta: T.textMuted,
};
const ROTULO_TIPO: Record<string, string> = { mensagens: "💬", formulario: "🔗", visitas: "👁", video: "🎬", outros: "❔" };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const nf = (v: number) => v.toLocaleString("pt-BR");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoje = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

function lerMeta(): number {
  try { const v = Number(localStorage.getItem("carteira_meta")); return v > 0 ? v : 20; } catch { return 20; }
}

export default function ManagerCarteira() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [from, setFrom] = useState<Date>(() => { const h = hoje(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const [to, setTo] = useState<Date>(hoje);
  const [meta, setMeta] = useState<number>(lerMeta);
  const [aberto, setAberto] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const t = localStorage.getItem("manager_token");
    if (!t) { setLocation("/manager/login"); return; }
    setToken(t);
  }, [setLocation]);
  useEffect(() => { try { localStorage.setItem("carteira_meta", String(meta)); } catch { /* sem armazenamento */ } }, [meta]);

  const carteira = trpc.managers.visaoCarteira.useQuery(
    { token: token ?? "", from: iso(from), to: iso(to) },
    { enabled: !!token, staleTime: 5 * 60_000, refetchOnWindowFocus: false },
  );

  const linhas = useMemo(() => avaliarCarteira(carteira.data?.clientes ?? [], meta), [carteira.data, meta]);
  const resumo = useMemo(() => resumoCarteira(linhas), [linhas]);
  const precisamAcao = resumo.acima + resumo.sem_leads;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg, height: "100vh", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-5 h-14 border-b flex-shrink-0 flex-wrap" style={{ borderColor: "oklch(0.22 0.012 255)", background: "oklch(0.13 0.012 255)" }}>
        <button onClick={() => setLocation("/manager/dashboard")} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: T.textMuted }}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="h-4 w-px" style={{ background: T.bgBorder }} />
        <span className="text-base font-semibold text-white">Carteira</span>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs" style={{ color: T.textMuted }}>
            Meta de CPL
            <span className="flex items-center rounded-lg px-2" style={{ background: T.bgInput, border: `1px solid ${T.bgBorder}` }}>
              <span className="text-xs" style={{ color: T.textMuted }}>R$</span>
              <input type="number" min={1} step={1} value={meta}
                onChange={(e) => setMeta(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 bg-transparent text-sm font-semibold text-white py-1.5 px-1 outline-none" />
            </span>
          </label>
          <PeriodPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} accentColor={MARCA} t={T} maxDate={hoje()} />
          <button onClick={() => carteira.refetch()} disabled={carteira.isFetching} title="Consultar de novo"
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50" style={{ background: T.bgInput, border: `1px solid ${T.bgBorder}`, color: T.textSecondary }}>
            <RefreshCw className={`w-3.5 h-3.5 ${carteira.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 max-w-6xl mx-auto space-y-5">
          {carteira.isLoading && (
            <div className="rounded-xl p-6 text-sm" style={{ background: T.bgCard, border: `1px solid ${T.bgBorder}`, color: T.textSecondary }}>
              <p className="font-semibold text-white">Consultando os clientes no Meta...</p>
              <p className="text-xs mt-1" style={{ color: T.textMuted }}>Um por um, alguns de cada vez. Com a carteira inteira leva em torno de um minuto.</p>
            </div>
          )}
          {carteira.error && (
            <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(230,57,70,0.10)", border: "1px solid rgba(230,57,70,0.35)", color: "#ff8a94" }}>{carteira.error.message}</div>
          )}

          {carteira.data && (
            <>
              <section>
                <p className="text-[10.5px] uppercase font-bold m-0 mb-2" style={{ color: MARCA, letterSpacing: ".2em" }}>Resumo</p>
                <p className="text-xl md:text-2xl font-bold text-white m-0 mb-4" style={{ letterSpacing: "-.015em" }}>
                  {precisamAcao === 0
                    ? `Nenhum cliente acima da meta de ${brl(meta)}.`
                    : `${precisamAcao} ${precisamAcao === 1 ? "cliente precisa" : "clientes precisam"} de teste ou otimização.`}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(["acima", "sem_leads", "atencao", "dentro", "sem_investimento", "sem_meta"] as Situacao[]).map((s) => (
                    <div key={s} className="rounded-xl p-3" style={{ background: T.bgCard, border: `1px solid ${T.bgBorder}` }}>
                      <p className="text-[10px] uppercase font-semibold m-0" style={{ color: T.textMuted, letterSpacing: ".14em" }}>{ROTULO_SITUACAO[s]}</p>
                      <p className="text-2xl font-bold m-0 mt-1" style={{ color: resumo[s] > 0 ? COR[s] : T.textMuted }}>{resumo[s]}</p>
                    </div>
                  ))}
                </div>
                {resumo.erro > 0 && <p className="text-xs mt-2" style={{ color: COR.erro }}>{resumo.erro} cliente(s) com falha na consulta — veja a linha para o motivo.</p>}
              </section>

              <section className="rounded-xl overflow-hidden" style={{ background: T.bgCard, border: `1px solid ${T.bgBorder}` }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <thead>
                      <tr className="text-[10px] uppercase" style={{ color: T.textMuted, letterSpacing: ".12em" }}>
                        <th className="text-left px-4 py-2.5 font-semibold w-6" />
                        <th className="text-left px-2 py-2.5 font-semibold">Cliente</th>
                        <th className="text-left px-3 py-2.5 font-semibold">Situação</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Investimento</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Leads</th>
                        <th className="text-right px-3 py-2.5 font-semibold">CPL</th>
                        <th className="text-right px-4 py-2.5 font-semibold">vs. meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => <Linha key={l.id} l={l} meta={meta} aberto={!!aberto[l.id]} alternar={() => setAberto((a) => ({ ...a, [l.id]: !a[l.id] }))} />)}
                    </tbody>
                  </table>
                </div>
              </section>

              <p className="text-[11px]" style={{ color: T.textMuted }}>
                CPL = investimento ÷ leads (mensagens iniciadas + formulários). Campanhas de vídeo e de visitas entram no investimento,
                mas não são julgadas pela meta. "Perto do limite" é até 25% acima da meta.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Linha({ l, meta, aberto, alternar }: { l: LinhaCarteira; meta: number; aberto: boolean; alternar: () => void }) {
  const a = l.avaliacao;
  const cor = COR[a.situacao];
  const temDetalhe = l.campanhas.length > 0 || a.acoes.length > 0 || !!l.erro;
  return (
    <>
      <tr className="border-t cursor-pointer" style={{ borderColor: "oklch(0.20 0.012 255)" }} onClick={temDetalhe ? alternar : undefined}>
        <td className="px-4 py-2.5" style={{ color: T.textMuted }}>{temDetalhe ? (aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}</td>
        <td className="px-2 py-2.5 font-semibold text-white whitespace-nowrap">{l.nome}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cor, background: `color-mix(in oklch, ${cor} 15%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 40%, transparent)` }}>
            {ROTULO_SITUACAO[a.situacao]}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: T.textSecondary }}>{l.investimento > 0 ? brl(l.investimento) : "—"}</td>
        <td className="px-3 py-2.5 text-right" style={{ color: T.textSecondary }}>{l.leads > 0 ? nf(l.leads) : "—"}</td>
        <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap" style={{ color: a.cpl != null ? cor : T.textMuted }}>{a.cpl != null ? brl(a.cpl) : "—"}</td>
        <td className="px-4 py-2.5 text-right whitespace-nowrap" style={{ color: a.desvio != null ? cor : T.textMuted }}>
          {a.desvio == null ? "—" : a.desvio <= 0 ? `${Math.round(-a.desvio)}% abaixo` : `+${Math.round(a.desvio)}%`}
        </td>
      </tr>
      {aberto && (
        <tr className="border-t" style={{ borderColor: "oklch(0.20 0.012 255)", background: "oklch(0.135 0.012 255)" }}>
          <td colSpan={7} className="px-4 py-3">
            <p className="text-sm m-0 mb-3" style={{ color: T.textSecondary }}>{a.resumo}</p>
            {a.acoes.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {a.acoes.map((ac, i) => {
                  const c = ac.gravidade === "alta" ? COR.acima : ac.gravidade === "media" ? COR.atencao : COR.dentro;
                  return (
                    <div key={i} className="flex gap-2 text-xs items-start">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                      <span style={{ color: T.textSecondary }}><span className="font-semibold text-white">{ac.campanha}</span> — {ac.texto}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {l.campanhas.length > 0 && (
              <table className="text-xs w-full max-w-3xl" style={{ fontVariantNumeric: "tabular-nums" }}>
                <thead><tr style={{ color: T.textMuted }}><th className="text-left py-1 font-semibold">Campanha</th><th className="text-right py-1 font-semibold">Investimento</th><th className="text-right py-1 font-semibold">Leads</th><th className="text-right py-1 font-semibold">CPL</th></tr></thead>
                <tbody>
                  {[...l.campanhas].sort((x, y) => y.investimento - x.investimento).map((c, i) => {
                    const cpl = GERA_LEAD.has(c.tipo) ? custoPorLead(c.investimento, c.leads) : null;
                    const corCpl = cpl == null ? T.textMuted : cpl <= meta ? COR.dentro : cpl <= meta * 1.25 ? COR.atencao : COR.acima;
                    return (
                      <tr key={i} className="border-t" style={{ borderColor: "oklch(0.20 0.012 255)", color: T.textSecondary }}>
                        <td className="py-1 pr-3 max-w-[360px] truncate" title={c.nome}>{ROTULO_TIPO[c.tipo]} {c.nome || "(sem nome)"}</td>
                        <td className="py-1 text-right whitespace-nowrap">{brl(c.investimento)}</td>
                        <td className="py-1 text-right">{GERA_LEAD.has(c.tipo) ? nf(c.leads) : <span style={{ color: T.textMuted }}>não conta</span>}</td>
                        <td className="py-1 text-right font-semibold whitespace-nowrap" style={{ color: corCpl }}>{cpl != null ? brl(cpl) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
