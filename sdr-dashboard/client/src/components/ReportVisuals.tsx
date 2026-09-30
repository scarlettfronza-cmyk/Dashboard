/**
 * ReportVisuals — a parte visual de um relatório.
 *
 * Usado nos dois lugares para que a SDR veja exatamente o que o médico vê:
 * no portal público (`/portal/:token`) e na aba Relatório.
 *
 * Desenha a partir do snapshot gravado junto do relatório, nunca de uma
 * consulta ao vivo — assim os gráficos não passam a contradizer o texto quando
 * alguém mexe num lead no Monday depois do envio.
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatBRL, mesDoPeriodo, type ReportSnapshot, type Distribution, type MetricDelta } from "@shared/metrics";

const card = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  boxShadow: "0 1px 2px oklch(0 0 0 / 0.04)",
};

export function ReportVisuals({ snapshot, compact = false }: { snapshot: ReportSnapshot; compact?: boolean }) {
  const k = snapshot.kpis;
  const g = snapshot.graficos;
  const c = snapshot.comparativo;

  return (
    <div className="space-y-4">
      {/* Agenda em destaque: consultas agendadas e comparecimentos são o que a
          SDR entrega e o que a clínica acompanha (pedido da SDR). */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Destaque
          rotulo="Consultas agendadas"
          valor={k.agendamentos}
          cor="#3b82f6"
          delta={c?.agendamentos}
          detalhe={
            k.agendadasParaDepois
              ? `${k.agendadasParaDepois} já ${k.agendadasParaDepois === 1 ? "marcada" : "marcadas"} para ${proximoPeriodo(snapshot)}`
              : undefined
          }
        />
        <Destaque
          rotulo="Comparecimentos"
          valor={k.comparecimentos}
          cor="#22c55e"
          delta={c?.comparecimentos}
          detalhe={k.agendamentos > 0 ? `${k.taxaComparecimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos agendados compareceram` : undefined}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Kpi label="Leads" value={k.leadsRecebidos} color="#7c6af7" delta={c?.leadsRecebidos} />
        <Kpi label="Fechados" value={k.negociosFechados} color="#22c55e" delta={c?.negociosFechados} />
        <Kpi label="Conversão" value={`${k.taxaConversao.toFixed(1)}%`} color="#f59e0b" delta={c?.taxaConversao} unidade="pp" />
        <Kpi label="Receita" value={formatBRL(k.receitaTotal)} color="#7c6af7" delta={c?.receitaTotal} destaque />
      </div>

      {/* Métricas de apoio numa tira fina, não em cartões. */}
      {!compact && (
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 rounded-xl text-sm"
          style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
        >
          <Apoio rotulo="Em negociação" valor={k.emNegociacao} />
          <Apoio rotulo="Perdidos" valor={k.negociosPerdidos} />
          <Apoio rotulo="Ticket médio" valor={formatBRL(k.ticketMedio)} />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Pizza titulo="De onde vieram os leads" data={g.porCanal} unidade="leads" />
        <Pizza titulo="Procedimentos mais procurados" data={g.porProcedimento} unidade="leads" />
        <Pizza titulo="Situação dos leads" data={g.porStatus} unidade="leads" />
        {g.porMes.length > 1 && <Barras titulo="Evolução por mês" data={g.porMes} />}
      </div>
    </div>
  );
}

const Apoio = ({ rotulo, valor }: { rotulo: string; valor: string | number }) => (
  <span className="flex items-baseline gap-1.5">
    <span style={{ color: "var(--muted-foreground)" }}>{rotulo}</span>
    <span className="font-semibold tabular" style={{ color: "var(--foreground)" }}>
      {valor}
    </span>
  </span>
);

// ─── Peças ───────────────────────────────────────────────────────────────────

function proximoPeriodo(snapshot: ReportSnapshot): string {
  const { from, to } = snapshot.periodo;
  const mes = from && to ? mesDoPeriodo({ from, to }) : null;
  return mes ? mes.seguinte : "depois do período";
}

/** Cartão grande da agenda: número em evidência e uma linha de contexto. */
function Destaque({
  rotulo,
  valor,
  cor,
  delta,
  detalhe,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  delta?: MetricDelta;
  detalhe?: string;
}) {
  return (
    <div className="rounded-2xl px-5 py-4" style={{ ...card, borderLeft: `4px solid ${cor}` }}>
      <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
        {rotulo}
      </p>
      <p
        className="text-5xl font-extrabold leading-none mt-2 tabular"
        style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)", letterSpacing: "-0.03em" }}
      >
        {valor}
      </p>
      {detalhe && (
        <p className="text-sm mt-2 font-medium" style={{ color: cor }}>
          {detalhe}
        </p>
      )}
      {delta && <Variacao delta={delta} />}
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
  delta,
  unidade,
  destaque,
}: {
  label: string;
  value: string | number;
  color: string;
  delta?: MetricDelta;
  unidade?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-3.5 py-3"
      style={{
        ...card,
        borderLeft: `3px solid ${color}`,
        ...(destaque ? { background: "oklch(0.55 0.20 280 / 0.06)" } : {}),
      }}
    >
      <p className="text-sm font-medium leading-tight truncate" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
      <p
        className="text-2xl font-extrabold leading-none mt-1.5 tabular"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          color: destaque ? "var(--primary)" : "var(--foreground)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
      {delta && <Variacao delta={delta} unidade={unidade} />}
    </div>
  );
}

/**
 * Variação contra o período anterior de mesma duração.
 * Sem base anterior (`variacaoPct === null`) mostramos "sem comparativo" em vez
 * de "+∞%", que é o que sairia de uma divisão por zero.
 */
function Variacao({
  delta,
  unidade,
  formato,
  grande,
}: {
  delta: MetricDelta;
  unidade?: string;
  formato?: (n: number) => string;
  grande?: boolean;
}) {
  if (delta.variacaoPct === null) {
    return (
      <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>
        —
      </p>
    );
  }

  const subiu = delta.variacaoPct > 0.05;
  const desceu = delta.variacaoPct < -0.05;
  const cor = subiu ? "#16a34a" : desceu ? "#dc2626" : "var(--muted-foreground)";
  const Icone = subiu ? TrendingUp : desceu ? TrendingDown : Minus;
  const anterior = formato ? formato(delta.anterior) : `${Math.round(delta.anterior * 10) / 10}${unidade ?? ""}`;

  return (
    <div className={`flex items-center gap-1 ${grande ? "text-base" : "text-sm"} mt-1.5`}>
      <Icone size={grande ? 16 : 13} style={{ color: cor }} />
      <span className="font-semibold tabular" style={{ color: cor }}>
        {delta.variacaoPct > 0 ? "+" : ""}
        {Math.abs(delta.variacaoPct) >= 999 ? "999" : delta.variacaoPct.toFixed(0)}%
      </span>
      <span className="truncate" style={{ color: "var(--muted-foreground)" }}>
        vs. {anterior}
      </span>
    </div>
  );
}

function Pizza({ titulo, data, unidade }: { titulo: string; data: Distribution[]; unidade: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl p-4" style={card}>
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h3 className="text-base font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)" }}>
          {titulo}
        </h3>
        {total > 0 && (
          <span className="text-sm tabular" style={{ color: "var(--muted-foreground)" }}>
            {total} {unidade}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--muted-foreground)" }}>
          Sem dados neste período
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-32 h-32 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={60} paddingAngle={2} dataKey="value">
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} stroke="var(--card)" strokeWidth={3} />
                  ))}
                </Pie>
                <Tooltip content={<DicaPizza unidade={unidade} total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* A legenda repete o número ao lado da porcentagem: quem lê no celular
              não consegue passar o dedo em cima da fatia para ver o tooltip. */}
          <div className="flex-1 w-full space-y-1.5 min-w-0">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="truncate flex-1" style={{ color: "var(--foreground)" }}>
                  {d.name}
                </span>
                <span className="tabular font-semibold flex-shrink-0" style={{ color: "var(--foreground)" }}>
                  {d.value}
                </span>
                <span className="tabular flex-shrink-0 w-12 text-right" style={{ color: "var(--muted-foreground)" }}>
                  {((d.value / total) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DicaPizza({
  active,
  payload,
  unidade,
  total,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: Distribution }[];
  unidade: string;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 text-base"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 4px 12px oklch(0 0 0 / 0.10)" }}
    >
      <p className="font-semibold" style={{ color: "var(--foreground)" }}>
        {item.name}
      </p>
      <p style={{ color: item.payload.color }}>
        {item.value} {unidade} · {((item.value / total) * 100).toFixed(0)}%
      </p>
    </div>
  );
}

function Barras({ titulo, data }: { titulo: string; data: { mes: string; leads: number; fechados: number }[] }) {
  return (
    <div className="rounded-xl p-4" style={card}>
      <h3 className="text-base font-bold mb-3" style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)" }}>
        {titulo}
      </h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--secondary)" }}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 14,
              }}
            />
            <Bar dataKey="leads" name="Leads" fill="#7c6af7" radius={[6, 6, 0, 0]} />
            <Bar dataKey="fechados" name="Fechados" fill="#22c55e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-5 mt-3 justify-center">
        <Legenda cor="#7c6af7" texto="Leads" />
        <Legenda cor="#22c55e" texto="Fechados" />
      </div>
    </div>
  );
}

const Legenda = ({ cor, texto }: { cor: string; texto: string }) => (
  <span className="flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
    <span className="w-3 h-3 rounded-sm" style={{ background: cor }} />
    {texto}
  </span>
);
