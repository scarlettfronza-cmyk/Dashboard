/**
 * Blocos de métricas do relatório: tráfego pago, perfil orgânico e comercial.
 *
 * Seguem o mesmo desenho do relatório em PDF aprovado: cada bloco abre com
 * o rótulo de seção, uma frase que já diz o resultado, e só então os
 * indicadores — o mais importante em destaque na cor da marca. As três
 * origens ficam separadas de propósito: somar alcance de anúncio com alcance
 * do perfil, ou lead com consulta, é dupla contagem.
 */
import { Eyebrow, Statement } from "./ReportNarrative";

type Theme = {
  bgCard: string; bgBorder: string; bgInput: string;
  textPrimary: string; textSecondary: string; textMuted: string;
};

const nf = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");
const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/** Indicador. `hi` é o tile de destaque: fundo tingido e valor na cor da marca. */
export function Metric({ label, value, hint, hi, accentColor, t }: {
  label: string; value: string; hint?: string; hi?: boolean; accentColor: string; t: Theme;
}) {
  const fundo = hi
    ? `linear-gradient(145deg, color-mix(in oklch, ${accentColor} 14%, ${t.bgCard}), ${t.bgCard})`
    : t.bgCard;
  const borda = hi ? `color-mix(in oklch, ${accentColor} 35%, ${t.bgBorder})` : t.bgBorder;
  return (
    <div className="flex flex-col" style={{ background: fundo, border: `1px solid ${borda}`, borderRadius: 13, padding: "17px 19px" }}>
      <p className="text-[10px] uppercase font-semibold m-0" style={{ color: t.textMuted, letterSpacing: ".14em", minHeight: "2.4em" }}>
        {label}
      </p>
      <p className="text-[24px] md:text-[27px] m-0 mt-0.5" style={{
        color: hi ? accentColor : t.textPrimary, fontWeight: 750, letterSpacing: "-.025em",
        whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </p>
      {hint && <p className="text-[11px] m-0 mt-1.5" style={{ color: t.textMuted }}>{hint}</p>}
    </div>
  );
}

/** Seção com rótulo, frase de leitura e nota de origem do dado. */
export function Bloco({ eyebrow, frase, nota, accentColor, t, children }: {
  eyebrow: string; frase?: string; nota?: string; accentColor: string; t: Theme; children: React.ReactNode;
}) {
  return (
    <section>
      <Eyebrow accentColor={accentColor}>{eyebrow}</Eyebrow>
      {frase && <Statement t={t}>{frase}</Statement>}
      {nota && <p className="text-[12.5px] m-0 mb-4 max-w-[660px]" style={{ color: t.textMuted, marginTop: frase ? -6 : 0 }}>{nota}</p>}
      {children}
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

export function fraseTrafego(p: Pick<TrafegoProps, "investimento" | "leads">): string | undefined {
  if (p.investimento <= 0) return undefined;
  if (p.leads > 0) return `${brl(p.investimento)} investidos geraram ${nf(p.leads)} leads, a ${brl(p.investimento / p.leads)} cada.`;
  return `${brl(p.investimento)} investidos em mídia no período.`;
}

export function Trafego(p: TrafegoProps) {
  const { t, accentColor: a } = p;
  const temSplit = p.leadsMensagem > 0 || p.leadsFormulario > 0;
  return (
    <Bloco eyebrow="Dados do tráfego" frase={fraseTrafego(p)} nota="Campanhas pagas no Meta, no período selecionado." accentColor={a} t={t}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Investimento" value={brl(p.investimento)} hi hint="total aplicado em mídia" accentColor={a} t={t} />
        <Metric label="Leads" value={nf(p.leads)}
          hint={temSplit ? `${nf(p.leadsMensagem)} por mensagem · ${nf(p.leadsFormulario)} por formulário` : "total de leads"}
          accentColor={a} t={t} />
        <Metric label="Alcance" value={nf(p.alcance)} hint="contas alcançadas pelos anúncios" accentColor={a} t={t} />
        <Metric label="Cliques no link" value={nf(p.cliquesNoLink)} hint="cliques vindos dos anúncios" accentColor={a} t={t} />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Metric label="CPL · mensagem iniciada" value={p.leadsMensagem > 0 ? brl(p.cplMensagem) : "—"}
          hint={p.leadsMensagem > 0 ? "conversas no WhatsApp e Direct" : "sem leads de mensagem no período"} accentColor={a} t={t} />
        <Metric label="CPL · formulário" value={p.leadsFormulario > 0 ? brl(p.cplFormulario) : "—"}
          hint={p.leadsFormulario > 0 ? "formulário do Meta ou do site" : "sem leads de formulário no período"} accentColor={a} t={t} />
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

export function fraseComercial(p: Pick<ComercialProps, "consultasAgendadas" | "vendas">): string | undefined {
  if (p.consultasAgendadas <= 0 && p.vendas <= 0) return undefined;
  if (p.consultasAgendadas <= 0) return `${nf(p.vendas)} vendas fechadas no período.`;
  return `${nf(p.consultasAgendadas)} consultas agendadas e ${pct(p.vendas, p.consultasAgendadas)}% de fechamento.`;
}

export function Comercial(p: ComercialProps) {
  const { t, accentColor: a } = p;
  return (
    <Bloco eyebrow="Resultado comercial" frase={fraseComercial(p)} nota="Base comercial importada do CRM." accentColor={a} t={t}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Metric label="Receita" value={brl(p.receita)} hi hint="consultas + procedimentos" accentColor={a} t={t} />
        <Metric label="ROAS" value={p.roas > 0 ? `${p.roas.toFixed(2).replace(".", ",")}x` : "—"}
          hint={p.roas > 0 ? "receita ÷ investimento" : "sem investimento no período"} accentColor={a} t={t} />
        <Metric label="Ticket médio" value={brl(p.ticketMedio)} hint="receita ÷ consultas" accentColor={a} t={t} />
      </div>
      <div className={`grid grid-cols-2 ${p.consultasPagas != null ? "md:grid-cols-3" : ""} gap-3 mt-3`}>
        <Metric label="Consultas agendadas" value={nf(p.consultasAgendadas)} hint="agendamentos no período" accentColor={a} t={t} />
        {p.consultasPagas != null && (
          <Metric label="Consultas pagas" value={nf(p.consultasPagas)} hint="consultas com pagamento" accentColor={a} t={t} />
        )}
        <Metric label="Vendas" value={nf(p.vendas)} hint="procedimentos e cirurgias fechadas" accentColor={a} t={t} />
      </div>
    </Bloco>
  );
}
