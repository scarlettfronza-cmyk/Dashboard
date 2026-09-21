/**
 * Blocos de métricas da aba "Resultados".
 *
 * As seções ricas da página estavam desativadas com `{false && (...)}`, então
 * os números apareciam só como texto corrido no resumo do período. Aqui eles
 * voltam como indicadores legíveis, separados pela origem do dado: o que vem
 * de campanha paga, o que vem do perfil orgânico e o que vem da base comercial.
 * Misturar as três origens num bloco só leva a dupla contagem.
 */

type Theme = {
  bgCard: string; bgBorder: string; bgInput: string;
  textPrimary: string; textSecondary: string; textMuted: string;
};

const nf = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");
const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function Metric({ label, value, hint, accent, t, wide }: {
  label: string; value: string; hint?: string; accent?: string; t: Theme; wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 flex flex-col ${wide ? "md:col-span-2" : ""}`}
      style={{ background: t.bgCard, border: `1px solid ${t.bgBorder}` }}
    >
      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: t.textMuted }}>
        {label}
      </p>
      <p
        className={`${wide ? "text-3xl" : "text-xl"} font-bold tracking-tight mt-1`}
        style={{ color: accent ?? t.textPrimary, whiteSpace: "nowrap" }}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] mt-auto pt-1" style={{ color: t.textMuted }}>{hint}</p>}
    </div>
  );
}

function Bloco({ titulo, nota, children, t }: {
  titulo: string; nota?: string; children: React.ReactNode; t: Theme;
}) {
  return (
    <section>
      <h3 className="text-base font-bold" style={{ color: t.textPrimary }}>{titulo}</h3>
      {nota && <p className="text-xs mt-0.5 mb-3" style={{ color: t.textMuted }}>{nota}</p>}
      <div className={nota ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

// ── Tráfego pago ─────────────────────────────────────────────────────────────

export type TrafegoProps = {
  investimento: number;
  leads: number;
  leadsMensagem: number;
  leadsFormulario: number;
  cplMensagem: number;
  cplFormulario: number;
  alcance: number;
  cliquesNoLink: number;
  t: Theme;
  accentColor: string;
};

export function Trafego(p: TrafegoProps) {
  const { t } = p;
  const temSplit = p.leadsMensagem > 0 || p.leadsFormulario > 0;
  return (
    <Bloco titulo="Dados do tráfego" nota="Campanhas pagas no Meta, no período selecionado." t={t}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Investimento" value={brl(p.investimento)} wide accent={p.accentColor}
          hint="total aplicado em mídia" t={t} />
        <Metric label="Leads" value={nf(p.leads)}
          hint={temSplit ? `${nf(p.leadsMensagem)} por mensagem · ${nf(p.leadsFormulario)} por formulário` : "total de leads"}
          t={t} />
        <Metric label="Alcance" value={nf(p.alcance)} hint="contas alcançadas pelos anúncios" t={t} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        <Metric label="CPL · mensagem iniciada" value={p.leadsMensagem > 0 ? brl(p.cplMensagem) : "—"}
          hint={p.leadsMensagem > 0 ? "conversas no WhatsApp e Direct" : "sem leads de mensagem no período"} t={t} />
        <Metric label="CPL · formulário" value={p.leadsFormulario > 0 ? brl(p.cplFormulario) : "—"}
          hint={p.leadsFormulario > 0 ? "formulário do Meta ou do site" : "sem leads de formulário no período"} t={t} />
        <Metric label="Cliques no link" value={nf(p.cliquesNoLink)} hint="cliques vindos dos anúncios" t={t} />
      </div>
    </Bloco>
  );
}

// ── Perfil orgânico ──────────────────────────────────────────────────────────

export type PerfilProps = {
  novosSeguidores: number;
  visitasAoPerfil: number;
  cliquesNoLinkBio: number;
  t: Theme;
};

export function Perfil(p: PerfilProps) {
  const { t } = p;
  return (
    <Bloco
      titulo="Perfil no Instagram"
      nota="Dados do perfil, não dos anúncios. Não somar com o alcance do tráfego."
      t={t}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Metric label="Novos seguidores" value={nf(p.novosSeguidores)} hint="variação no período" t={t} />
        <Metric label="Visitas ao perfil" value={nf(p.visitasAoPerfil)} hint="abriram o perfil" t={t} />
        <Metric label="Cliques no link da bio" value={nf(p.cliquesNoLinkBio)} hint="saíram pelo link" t={t} />
      </div>
    </Bloco>
  );
}

// ── Comercial ────────────────────────────────────────────────────────────────

export type ComercialProps = {
  roas: number;
  receita: number;
  ticketMedio: number;
  consultasAgendadas: number;
  /** Só é exibido quando o critério de "consulta paga" estiver definido. */
  consultasPagas?: number | null;
  vendas: number;
  t: Theme;
  accentColor: string;
};

export function Comercial(p: ComercialProps) {
  const { t } = p;
  return (
    <Bloco titulo="Resultado comercial" nota="Base comercial importada do CRM." t={t}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="ROAS" value={p.roas > 0 ? `${p.roas.toFixed(2)}x` : "—"} wide accent={p.accentColor}
          hint="receita ÷ investimento" t={t} />
        <Metric label="Receita" value={brl(p.receita)} hint="consultas + procedimentos" t={t} />
        <Metric label="Ticket médio" value={brl(p.ticketMedio)} hint="receita ÷ consultas" t={t} />
      </div>
      <div className={`grid grid-cols-2 ${p.consultasPagas != null ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3 mt-3`}>
        <Metric label="Consultas agendadas" value={nf(p.consultasAgendadas)} hint="agendamentos no período" t={t} />
        {p.consultasPagas != null && (
          <Metric label="Consultas pagas" value={nf(p.consultasPagas)} hint="consultas com pagamento" t={t} />
        )}
        <Metric label="Vendas" value={nf(p.vendas)} hint="procedimentos e cirurgias fechadas" t={t} />
      </div>
    </Bloco>
  );
}
