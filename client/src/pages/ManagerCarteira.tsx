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
import {
  avaliarCarteira, resumoCarteira, resumoSemaforo, semaforo, variacaoSemanal, ROTULO_SITUACAO, ROTULO_SEMAFORO, GERA_LEAD, custoPorLead,
  type Situacao, type LinhaCarteira, type CorSemaforo,
} from "@shared/carteira";

const T = {
  bg: "oklch(0.12 0.012 255)", bgCard: "oklch(0.16 0.012 255)", bgBorder: "oklch(0.24 0.012 255)",
  bgInput: "oklch(0.13 0.012 255)", textPrimary: "#fff", textSecondary: "oklch(0.80 0.010 240)", textMuted: "oklch(0.55 0.010 240)",
};
const MARCA = "#e63946";
const COR: Record<Situacao, string> = {
  acima: MARCA, sem_leads: MARCA, erro: "oklch(0.65 0.10 30)",
  atencao: "#eda100", dentro: "oklch(0.72 0.17 150)", sem_investimento: T.textMuted, sem_meta: T.textMuted,
};
const COR_SEMAFORO: Record<CorSemaforo, string> = { vermelho: MARCA, amarelo: "#eda100", verde: "oklch(0.72 0.17 150)", cinza: T.textMuted };
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
  const [varredura, setVarredura] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("manager_token");
    if (!t) { setLocation("/manager/login"); return; }
    setToken(t);
  }, [setLocation]);
  useEffect(() => { try { localStorage.setItem("carteira_meta", String(meta)); } catch { /* sem armazenamento */ } }, [meta]);

  const carteira = trpc.managers.visaoCarteira.useQuery(
    { token: token ?? "", from: iso(from), to: iso(to), varredura },
    { enabled: !!token, staleTime: 5 * 60_000, refetchOnWindowFocus: false },
  );

  const linhas = useMemo(() => avaliarCarteira(carteira.data?.clientes ?? [], meta), [carteira.data, meta]);
  const resumo = useMemo(() => resumoCarteira(linhas), [linhas]);
  const cores = useMemo(() => resumoSemaforo(linhas), [linhas]);
  const precisamAcao = resumo.acima + resumo.sem_leads;
  const temVarredura = linhas.some((l) => l.varredura);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg, height: "100vh", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-5 h-14 border-b flex-shrink-0 flex-wrap" style={{ borderColor: "oklch(0.22 0.012 255)", background: "oklch(0.13 0.012 255)" }}>
        <button onClick={() => setLocation("/manager/dashboard")} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: T.textMuted }}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="h-4 w-px" style={{ background: T.bgBorder }} />
        <span className="text-base font-semibold text-white">Carteira · Varredura</span>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: T.textMuted }} title="Além do CPL, consulta gasto de ontem, semana, saldo, status da conta e decisões">
            <input type="checkbox" checked={varredura} onChange={(e) => setVarredura(e.target.checked)} />
            Varredura matinal
          </label>
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
                <p className="text-[10.5px] uppercase font-bold m-0 mb-2" style={{ color: MARCA, letterSpacing: ".2em" }}>{temVarredura ? "Varredura de hoje" : "Resumo"}</p>
                <p className="text-xl md:text-2xl font-bold text-white m-0 mb-4" style={{ letterSpacing: "-.015em" }}>
                  {temVarredura
                    ? cores.vermelho === 0 && cores.amarelo === 0
                      ? `Todas as ${linhas.length} contas no verde. Manter e testar.`
                      : `${cores.vermelho} para agir hoje, ${cores.amarelo} para investigar, ${cores.verde} no verde.`
                    : precisamAcao === 0
                      ? `Nenhum cliente acima da meta de ${brl(meta)}.`
                      : `${precisamAcao} ${precisamAcao === 1 ? "cliente precisa" : "clientes precisam"} de teste ou otimização.`}
                </p>
                {temVarredura && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    {(["vermelho", "amarelo", "verde", "cinza"] as CorSemaforo[]).map((c) => (
                      <div key={c} className="rounded-xl p-3 flex items-center gap-3" style={{ background: T.bgCard, border: `1px solid ${T.bgBorder}` }}>
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COR_SEMAFORO[c] }} />
                        <div>
                          <p className="text-[10px] uppercase font-semibold m-0" style={{ color: T.textMuted, letterSpacing: ".14em" }}>{ROTULO_SEMAFORO[c]}</p>
                          <p className="text-2xl font-bold m-0" style={{ color: cores[c] > 0 ? COR_SEMAFORO[c] : T.textMuted }}>{cores[c]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                        <th className="text-left px-3 py-2.5 font-semibold">{temVarredura ? "Hoje" : "Situação"}</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Investimento</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Leads</th>
                        <th className="text-right px-3 py-2.5 font-semibold">CPL</th>
                        <th className="text-right px-3 py-2.5 font-semibold">vs. meta</th>
                        {temVarredura && (
                          <>
                            <th className="text-right px-3 py-2.5 font-semibold" title="Gasto de ontem">Ontem</th>
                            <th className="text-right px-3 py-2.5 font-semibold" title="Últimos 7 dias e variação contra os 7 anteriores">Semana</th>
                            <th className="text-right px-3 py-2.5 font-semibold" title="Campanhas com gasto ontem">Ativas</th>
                            <th className="text-right px-3 py-2.5 font-semibold" title="Saldo pré-pago">Saldo</th>
                            <th className="text-left px-3 py-2.5 font-semibold">Conta</th>
                            <th className="text-left px-4 py-2.5 font-semibold" title="Decisões em andamento / vencidas">Decisões</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => <Linha key={l.id} l={l} meta={meta} comVarredura={temVarredura} aberto={!!aberto[l.id]} alternar={() => setAberto((a) => ({ ...a, [l.id]: !a[l.id] }))} />)}
                    </tbody>
                  </table>
                </div>
              </section>

              <p className="text-[11px]" style={{ color: T.textMuted }}>
                CPL = investimento ÷ leads (mensagens iniciadas + formulários). Campanhas de vídeo e de visitas entram no investimento,
                mas não são julgadas pela meta. "Perto do limite" é até 25% acima da meta.
                {temVarredura && <> Vermelho: CPL estourado, gastou sem lead, conta com problema, saldo abaixo de R$ 50, parou de gastar ontem ou decisão vencida.
                Amarelo: CPL perto do limite, saldo abaixo de R$ 200, gasto da semana caiu mais de 40% ou falha na consulta.
                Saldo só aparece em contas pré-pagas. Clique na linha para ver os motivos e as campanhas.</>}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Linha({ l, meta, comVarredura, aberto, alternar }: { l: LinhaCarteira; meta: number; comVarredura: boolean; aberto: boolean; alternar: () => void }) {
  const a = l.avaliacao;
  const cor = COR[a.situacao];
  const sem = semaforo(l);
  const v = l.varredura;
  const temDetalhe = l.campanhas.length > 0 || a.acoes.length > 0 || !!l.erro || sem.motivos.length > 0;
  const variacao = v ? variacaoSemanal(v) : null;
  const corConta = v?.conta ? (v.conta.gravidade === "critico" ? COR_SEMAFORO.vermelho : v.conta.gravidade === "aviso" ? COR_SEMAFORO.amarelo : T.textMuted) : T.textMuted;
  return (
    <>
      <tr className="border-t cursor-pointer" style={{ borderColor: "oklch(0.20 0.012 255)" }} onClick={temDetalhe ? alternar : undefined}>
        <td className="px-4 py-2.5" style={{ color: T.textMuted }}>{temDetalhe ? (aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}</td>
        <td className="px-2 py-2.5 font-semibold text-white whitespace-nowrap">{l.nome}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {comVarredura ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" title={sem.motivos.join(" · ") || ROTULO_SITUACAO[a.situacao]}
              style={{ color: COR_SEMAFORO[sem.cor], background: `color-mix(in oklch, ${COR_SEMAFORO[sem.cor]} 15%, transparent)`, border: `1px solid color-mix(in oklch, ${COR_SEMAFORO[sem.cor]} 40%, transparent)` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: COR_SEMAFORO[sem.cor] }} />
              {ROTULO_SEMAFORO[sem.cor]}
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cor, background: `color-mix(in oklch, ${cor} 15%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 40%, transparent)` }}>
              {ROTULO_SITUACAO[a.situacao]}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: T.textSecondary }}>{l.investimento > 0 ? brl(l.investimento) : "—"}</td>
        <td className="px-3 py-2.5 text-right" style={{ color: T.textSecondary }}>{l.leads > 0 ? nf(l.leads) : "—"}</td>
        <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap" style={{ color: a.cpl != null ? cor : T.textMuted }}>{a.cpl != null ? brl(a.cpl) : "—"}</td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: a.desvio != null ? cor : T.textMuted }}>
          {a.desvio == null ? "—" : a.desvio <= 0 ? `${Math.round(-a.desvio)}% abaixo` : `+${Math.round(a.desvio)}%`}
        </td>
        {comVarredura && (
          <>
            <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: v && v.gastoOntem === 0 && v.gasto7 > 0 ? COR_SEMAFORO.vermelho : T.textSecondary }}>
              {v ? (v.gastoOntem > 0 ? brl(v.gastoOntem) : v.gasto7 > 0 ? "R$ 0" : "—") : "—"}
            </td>
            <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: T.textSecondary }}>
              {v && v.gasto7 > 0 ? brl(v.gasto7) : "—"}
              {variacao != null && (
                <span className="ml-1 text-[10px]" style={{ color: variacao <= -40 ? COR_SEMAFORO.amarelo : T.textMuted }}>
                  {variacao >= 0 ? "+" : ""}{Math.round(variacao)}%
                </span>
              )}
            </td>
            <td className="px-3 py-2.5 text-right" style={{ color: T.textSecondary }}>{v && v.campanhasAtivas > 0 ? nf(v.campanhasAtivas) : "—"}</td>
            <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: v?.saldo != null ? (v.saldo <= 50 ? COR_SEMAFORO.vermelho : v.saldo <= 200 ? COR_SEMAFORO.amarelo : T.textSecondary) : T.textMuted }}>
              {v?.saldo != null ? brl(v.saldo) : "—"}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-xs" style={{ color: corConta }}>{v?.conta?.rotulo ?? "—"}</td>
            <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: v && v.decisoes.vencida > 0 ? COR_SEMAFORO.vermelho : T.textSecondary }}>
              {v ? (v.decisoes.pendente + v.decisoes.vencida === 0 ? <span style={{ color: T.textMuted }}>nenhuma</span>
                : `${v.decisoes.pendente + v.decisoes.vencida} aberta${v.decisoes.pendente + v.decisoes.vencida === 1 ? "" : "s"}${v.decisoes.vencida > 0 ? ` · ${v.decisoes.vencida} vencida${v.decisoes.vencida === 1 ? "" : "s"}` : ""}`) : "—"}
            </td>
          </>
        )}
      </tr>
      {aberto && (
        <tr className="border-t" style={{ borderColor: "oklch(0.20 0.012 255)", background: "oklch(0.135 0.012 255)" }}>
          <td colSpan={comVarredura ? 13 : 7} className="px-4 py-3">
            {sem.motivos.length > 0 && (
              <p className="text-xs m-0 mb-2 font-semibold" style={{ color: COR_SEMAFORO[sem.cor] }}>
                {ROTULO_SEMAFORO[sem.cor]}: {sem.motivos.join(" · ")}.
              </p>
            )}
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
