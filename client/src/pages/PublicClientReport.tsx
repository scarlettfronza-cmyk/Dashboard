import { useState, useMemo, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { InstagramProfile } from "@/components/report/InstagramProfile";
import { TopContent } from "@/components/report/TopContent";
import { Trafego, Comercial, Bloco } from "@/components/report/ResultsMetrics";
import { Capa, Eyebrow, Statement, Texto, Destaque } from "@/components/report/ReportNarrative";
import { PrintStyles } from "@/components/report/PrintStyles";
import { lerPeriodo } from "@/lib/analiseRelatorio";
import { PeriodPicker } from "@/components/report/PeriodPicker";
import { lerPeriodoDaUrl } from "@shared/whatsappRelatorio";

const AGENCIA = "Digital Escarlate";
const GESTORA = "Scarlett Fronza";
const SITE = "digitalescarlate.com";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
  chart: "#3987e5",
};
type ReportTheme = typeof DARK_THEME;

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, prefix = "") {
  if (n == null || isNaN(n as number)) return "—";
  if (prefix === "R$") return `R$ ${(n as number).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (n as number).toLocaleString("pt-BR");
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PublicClientReport() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const managerToken = typeof window !== "undefined" ? localStorage.getItem("manager_token") ?? undefined : undefined;

  const now = new Date();
  // O link mandado no WhatsApp traz o período analisado (?de=&ate=); sem
  // ele, ou se vier inválido, abre no mês atual como sempre.
  const periodoDaUrl = typeof window !== "undefined" ? lerPeriodoDaUrl(window.location.search, now) : null;
  const [fromDate, setFromDate] = useState<Date>(() => periodoDaUrl?.from ?? new Date(now.getFullYear(), now.getMonth(), 1));
  const [toDate, setToDate] = useState<Date>(() => periodoDaUrl?.to ?? startOfDay(now));
  const dateRange = useMemo(() => ({ from: formatDate(fromDate), to: formatDate(toDate) }), [fromDate, toDate]);

  const [mondayAutoSyncing, setMondayAutoSyncing] = useState(false);
  const syncBoardMutation = trpc.monday.syncBoardAsManager.useMutation();
  const utils = trpc.useUtils();

  const { data: _clientInfoRaw, isLoading: loadingClient, error: clientError } =
    trpc.public.getClientByToken.useQuery({ token, managerToken }, { enabled: !!token });
  const clientInfo = _clientInfoRaw as (typeof _clientInfoRaw & { logoUrl?: string | null; brandColor?: string | null; proximosPassos?: string | null }) | undefined;

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
    { enabled: !!clientInfo?.igUsername }
  );
  const { data: igInsights, isLoading: igInsightsLoading } = (trpc as any).public.getPublicInstagramInsights.useQuery(
    { token, from: dateRange.from, to: dateRange.to, managerToken },
    { enabled: !!clientInfo?.igUsername }
  );
  const { data: publicCreativesData, isLoading: publicCreativesLoading } = (trpc as any).public.getPublicCreatives.useQuery(
    { token, from: dateRange.from, to: dateRange.to, managerToken },
    { enabled: !!clientInfo?.id }
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
  // Um único visual, o da agência: fundo preto, vermelho escarlate e
  // branco/cinza. A cor e o tema por cliente que existiam antes saíram
  // para o relatório ser reconhecível como peça da Digital Escarlate.
  const theme: ReportTheme = DARK_THEME;
  const accentColor = theme.accentHex;

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

  // Manchete: o número mais forte do período. Com dado de mídia, o retorno;
  // sem ele, a receita — prometer ROAS sem investimento seria inventar.
  const manchete = (() => {
    const temMidia = Boolean(d?.mediaDataAvailable) && (d?.investimento ?? 0) > 0;
    if (temMidia && roas > 0) {
      return { linha1: `${fmt(totalVendas, "R$")} em receita,`, linha2: `${roas.toFixed(2).replace(".", ",")}x de retorno.` };
    }
    if (totalVendas > 0) {
      return { linha1: `${fmt(d?.vendas ?? 0)} procedimentos fechados,`, linha2: `${fmt(totalVendas, "R$")} em receita.` };
    }
    return { linha1: `${fmt(d?.consultas ?? 0)} consultas agendadas`, linha2: "no período." };
  })();

  const leitura = lerPeriodo({
    investimento: d?.investimento, leads: d?.leads, consultas: d?.consultas,
    vendas: d?.vendas, receitaTotal: totalVendas, roas, ticketMedio,
    custoPorLead, custoPorVenda: d?.custoPorVenda, novosSeguidores: d?.novosSeguidores,
    alcance: d?.alcance, mediaDataAvailable: d?.mediaDataAvailable,
    campanhas: d?.campanhas,
  });

  const periodLabel = (() => {
    const f = fromDate; const t = toDate;
    if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
      return `${MONTHS_FULL[f.getMonth()]} ${f.getFullYear()}`;
    }
    return `${MONTHS_CAL[f.getMonth()]} – ${MONTHS_CAL[t.getMonth()]} ${t.getFullYear()}`;
  })();

  const consultas = d?.consultas ?? 0;
  const leads = d?.leads ?? 0;
  const vendas = d?.vendas ?? 0;
  const geradoEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(now);

  return (
    <div className="min-h-screen" style={{ background: theme.bg, fontFamily: "'Inter', sans-serif" }}>
      <PrintStyles fundo={theme.bg} />

      {/* ── Cabeçalho: marca da agência e período ──────────────────────────
          É a "cabeça" do PDF aprovado: o nome da agência à esquerda, a
          gestora embaixo, o período à direita. Na tela o período é o botão
          do calendário; no papel vira só o texto. */}
      <header className="sticky top-0 z-30" style={{ background: theme.bgHeader, borderBottom: `1px solid ${theme.bgBorder}` }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 gap-3">
            <div className="min-w-0 leading-tight">
              <p className="text-[11px] sm:text-[12px] font-bold uppercase m-0 whitespace-nowrap truncate" style={{ color: theme.textPrimary, letterSpacing: ".18em" }}>
                {AGENCIA}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase m-0" style={{ color: theme.textMuted, letterSpacing: ".18em" }}>{GESTORA}</p>
                {mondayAutoSyncing && (
                  <span data-print="hide" className="flex items-center gap-1 text-[10px] animate-pulse" style={{ color: theme.accent }}>
                    <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Atualizando...
                  </span>
                )}
              </div>
            </div>

            <div data-print="hide" className="flex-shrink-0">
              <PeriodPicker
                from={fromDate}
                to={toDate}
                onChange={(f, t) => { setFromDate(f); setToDate(t); }}
                accentColor={accentColor}
                maxDate={startOfDay(now)}
                t={theme}
              />
            </div>
            <p data-print="only" className="text-xs m-0" style={{ color: theme.textMuted }}>{periodLabel}</p>
          </div>
        </div>
      </header>

      {/* ── Conteúdo: um fluxo só, na ordem do PDF ─────────────────────────
          Sem abas: o cliente lê de cima a baixo e o "salvar em PDF" do
          navegador pega tudo. Capa → resultado comercial → tráfego →
          perfil → conteúdos → funil → investimento → análise →
          recomendação → próximos passos → anúncios no ar. */}
      <main className="max-w-5xl mx-auto px-4 pt-8 pb-6" data-print="page" style={{ color: theme.textPrimary }}>
        {loadingDash ? (
          <div className="space-y-4">
            <div className="h-10 w-2/3 rounded-xl animate-pulse" style={{ background: theme.bgInput }} />
            <div className="h-10 w-1/2 rounded-xl animate-pulse" style={{ background: theme.bgInput }} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6">
              {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: theme.bgInput }} />)}
            </div>
          </div>
        ) : d ? (
          <div className="space-y-12">
            <Capa
              manchete={manchete.linha1}
              destaque={manchete.linha2}
              subtitulo={`Leitura de ${periodLabel}, com os resultados de mídia, perfil e comercial.`}
              cliente={clientInfo.name}
              periodo={periodLabel}
              accentColor={accentColor}
              t={theme}
            />

            <Comercial
              roas={roas}
              receita={totalVendas}
              ticketMedio={ticketMedio}
              consultasAgendadas={consultas}
              vendas={vendas}
              accentColor={accentColor}
              t={theme}
            />

            <Trafego
              investimento={d.investimento ?? 0}
              leads={leads}
              leadsMensagem={d.campanhas?.mensagens?.leads ?? 0}
              leadsFormulario={d.campanhas?.formulario?.leads ?? 0}
              cplMensagem={d.campanhas?.mensagens?.custoPorLead ?? custoPorLead}
              cplFormulario={d.campanhas?.formulario?.custoPorLead ?? 0}
              alcance={d.alcance ?? 0}
              cliquesNoLink={d.cliquesEstimados ?? 0}
              accentColor={accentColor}
              t={theme}
            />

            {clientInfo.igUsername && (igInsightsLoading || postsLoading) && (
              <div className="grid gap-3 md:grid-cols-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: theme.bgInput }} />)}
              </div>
            )}
            {!igInsightsLoading && igInsights?.connected && igInsights?.totals && (
              <InstagramProfile totals={igInsights.totals} username={igInsights.username} accentColor={accentColor} periodLabel={periodLabel} t={theme} />
            )}
            {!postsLoading && postsData?.posts?.length > 0 && (
              <TopContent posts={postsData.posts} accentColor={accentColor} t={theme} />
            )}

            {(leads > 0 || consultas > 0) && (
              <Bloco eyebrow="Funil" frase={`De cada 100 leads, ${leads > 0 ? Math.round((consultas / leads) * 100) : 0} viraram consulta.`}
                nota="Resumo agregado, sem expor contatos nem informações pessoais do CRM." accentColor={accentColor} t={theme}>
                <div className="rounded-xl p-5 space-y-4" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                  {[
                    { label: "Leads captados", value: leads, width: 100, detail: "Base do funil" },
                    { label: "Consultas agendadas", value: consultas, width: leads > 0 ? (consultas / leads) * 100 : 0, detail: leads > 0 ? `${((consultas / leads) * 100).toFixed(1).replace(".", ",")}% dos leads` : "Sem base de leads" },
                    { label: "Vendas fechadas", value: vendas, width: leads > 0 ? (vendas / leads) * 100 : 0, detail: consultas > 0 ? `${((vendas / consultas) * 100).toFixed(1).replace(".", ",")}% das consultas` : "Sem consultas registradas" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-semibold m-0" style={{ color: theme.textSecondary }}>{item.label}</p>
                          <p className="text-[11px] m-0 mt-0.5" style={{ color: theme.textMuted }}>{item.detail}</p>
                        </div>
                        <p className="text-lg font-bold m-0" style={{ color: theme.textPrimary, fontVariantNumeric: "tabular-nums" }}>{fmt(item.value)}</p>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: theme.bgInput }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(item.width, item.value > 0 ? 2 : 0)}%`, background: accentColor }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Bloco>
            )}

            {campanhaData.length > 0 && (
              <Bloco eyebrow="Investimento" frase="Onde a verba foi aplicada." nota="Por tipo de campanha, no período." accentColor={accentColor} t={theme}>
                <div className="rounded-xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.bgBorder}` }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={campanhaData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: theme.axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: theme.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => `R$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`} />
                      <Tooltip content={<CustomTooltip t={theme} />} cursor={{ fill: theme.bgHover }} />
                      <Bar dataKey="investimento" name="Investimento" radius={[6, 6, 0, 0]} fill={theme.chart} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Bloco>
            )}

            {leitura.analise.length > 0 && (
              <section>
                <Eyebrow accentColor={accentColor}>Análise</Eyebrow>
                <Statement t={theme}>O que os números dizem.</Statement>
                <Texto paragrafos={leitura.analise} t={theme} />
              </section>
            )}

            <section>
              <Eyebrow accentColor={accentColor}>Recomendação</Eyebrow>
              <Statement t={theme}>Para onde olhar agora.</Statement>
              <Destaque paragrafos={leitura.recomendacao} accentColor={accentColor} t={theme} />
            </section>

            {clientInfo.proximosPassos && (
              <section>
                <Eyebrow accentColor={accentColor}>Próximos passos</Eyebrow>
                <Texto paragrafos={[clientInfo.proximosPassos]} t={theme} />
              </section>
            )}

            {publicCreativesData?.creatives?.length > 0 && (
              <Bloco eyebrow="Anúncios no ar" frase="As peças veiculadas em nome da clínica." nota="Ordenadas pelo investimento no período." accentColor={accentColor} t={theme}>
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
              </Bloco>
            )}
          </div>
        ) : (
          <div className="text-center py-12" style={{ color: theme.textMuted }}>
            <p className="text-sm">Nenhum dado encontrado para o período selecionado.</p>
          </div>
        )}

        {/* ── Rodapé: assinatura e fonte, como no PDF ──────────────────── */}
        <footer className="mt-14 pt-5 text-[11px]" style={{ borderTop: `1px solid ${theme.bgBorder}`, color: theme.textMuted, lineHeight: 1.75 }}>
          Relatório preparado por <b style={{ color: theme.textSecondary }}>{GESTORA}</b> · {AGENCIA} · {SITE}<br />
          {revenueLineage?.label
            ? <>Dados comerciais: {revenueLineage.label}{revenueUpdatedAt ? `, atualizados em ${revenueUpdatedAt}` : ""}. </>
            : <>Sem base comercial disponível no período. </>}
          Mídia e perfil: API do Meta, no período selecionado. Gerado em {geradoEm}.
        </footer>
      </main>
    </div>
  );
}
