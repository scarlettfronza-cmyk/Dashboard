/**
 * GestaoVendas — Midnight Operations Dashboard
 * Tela de gestão de vendas: % conversão, canal, status agendamentos, procedimentos fechados.
 */
import { useMemo } from "react";
import { Lead, DashboardStats } from "@/hooks/useMondayData";
import { KpiCard } from "@/components/KpiCard";
import { PieChartCard } from "@/components/PieChartCard";
import { BarChartCard } from "@/components/BarChartCard";
import { LeadsTable } from "@/components/LeadsTable";
import { TrendingUp, DollarSign, Target, Award } from "lucide-react";
import { filterLeadsByDate, type DateRange } from "@shared/metrics";

interface GestaoVendasProps {
  stats: DashboardStats | null;
  leads: Lead[];
  range: DateRange | null;
}

export default function GestaoVendas({ stats, leads, range }: GestaoVendasProps) {
  const filteredLeads = useMemo(() => {
    return filterLeadsByDate(leads, "dataConversao", range, "dataConsulta");
  }, [leads, range]);

  const fechados = useMemo(
    () => filterLeadsByDate(leads, "dataFechamento", range, "dataConversao").filter((lead) => lead.statusLead === "Negócio fechado"),
    [leads, range],
  );
  const receita = stats?.receitaTotal ?? fechados.reduce((s, l) => s + (l.valor || 0), 0);
  const taxaConversao = stats?.taxaConversao ?? (filteredLeads.length > 0 ? (fechados.length / filteredLeads.length) * 100 : 0);
  const totalFechados = stats?.negociosFechados ?? fechados.length;
  const ticketMedio = stats?.receitaMedia ?? (fechados.length > 0 ? receita / fechados.length : 0);

  // Procedimentos fechados
  const procFechados = useMemo(() => {
    const map: Record<string, { count: number; receita: number }> = {};
    for (const l of fechados) {
      const p = l.procedimento || "Sem procedimento";
      if (!map[p]) map[p] = { count: 0, receita: 0 };
      map[p].count++;
      map[p].receita += l.valor || 0;
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [fechados]);

  const PROC_COLORS = ["#7c6af7", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"];
  const procChartData = procFechados.map(([name, v], i) => ({
    name, value: v.count, color: PROC_COLORS[i % PROC_COLORS.length]
  }));

  // SDR ranking
  const sdrRanking = useMemo(() => {
    if (!stats) return [];
    return [...stats.porSdr].sort((a, b) => b.fechados - a.fechados);
  }, [stats]);

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.220 0.008 265.0)" }}>
            Gestão de Vendas
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.520 0.012 265.0)" }}>
            Conversão, procedimentos fechados e performance
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Taxa de Conversão" value={`${taxaConversao.toFixed(1)}%`} accentColor="#7c6af7" icon={<Target size={16} />}
          trend={taxaConversao >= 20 ? "up" : "down"} trendLabel={`${totalFechados} de ${filteredLeads.length} leads`} />
        <KpiCard label="Procedimentos Fechados" value={totalFechados} accentColor="#22c55e" icon={<Award size={16} />} />
        <KpiCard label="Receita Total" value={`R$ ${(receita / 1000).toFixed(0)}k`}
          subValue={receita > 0 ? `R$ ${receita.toLocaleString("pt-BR")}` : undefined}
          accentColor="#f59e0b" icon={<DollarSign size={16} />} />
        <KpiCard label="Ticket Médio" value={`R$ ${(ticketMedio / 1000).toFixed(1)}k`} accentColor="#3b82f6" icon={<TrendingUp size={16} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PieChartCard title="Procedimentos Fechados" data={procChartData} />
        {stats && <PieChartCard title="Canal de Aquisição" data={stats.porCanal} />}
        {stats && <PieChartCard title="Status dos Agendamentos" data={stats.porStatus} />}
      </div>

      {/* Procedimentos table */}
      <div className="rounded-lg p-5" style={{ background: "oklch(1.000 0.015 265.0)", border: "1px solid oklch(0.910 0.015 265.0)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
          Procedimentos Fechados — Detalhamento
        </h3>
        {procFechados.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "oklch(0.600 0.012 265.0)" }}>Nenhum procedimento fechado no período</p>
        ) : (
          <div className="space-y-2">
            {procFechados.map(([proc, v], i) => {
              const pct = fechados.length > 0 ? (v.count / fechados.length) * 100 : 0;
              return (
                <div key={proc} className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PROC_COLORS[i % PROC_COLORS.length] }} />
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "oklch(0.300 0.008 265.0)" }}>{proc}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.925 0.015 265.0)", maxWidth: "200px" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PROC_COLORS[i % PROC_COLORS.length] }} />
                  </div>
                  <span className="text-sm w-8 text-right font-medium" style={{ color: "oklch(0.380 0.008 265.0)" }}>{v.count}</span>
                  <span className="text-sm w-16 text-right" style={{ color: "#22c55e" }}>
                    R$ {(v.receita / 1000).toFixed(0)}k
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SDR Ranking */}
      {sdrRanking.length > 0 && (
        <div className="rounded-lg p-5" style={{ background: "oklch(1.000 0.015 265.0)", border: "1px solid oklch(0.910 0.015 265.0)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
            Ranking SDRs
          </h3>
          <div className="space-y-3">
            {sdrRanking.map((sdr, i) => (
              <div key={sdr.name} className="flex items-center gap-4">
                <span className="text-sm font-bold w-5 text-center" style={{ color: i === 0 ? "#f59e0b" : "oklch(0.560 0.012 265.0)" }}>
                  {i + 1}
                </span>
                <span className="text-sm flex-1" style={{ color: "oklch(0.290 0.008 265.0)" }}>{sdr.name}</span>
                <span className="text-sm" style={{ color: "oklch(0.520 0.012 265.0)" }}>{sdr.leads} leads</span>
                <span className="text-sm font-medium" style={{ color: "#22c55e" }}>{sdr.fechados} fechados</span>
                <span className="text-sm" style={{ color: "#f59e0b" }}>R$ {(sdr.receita / 1000).toFixed(0)}k</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leads fechados */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
          Leads Fechados
        </h3>
        <LeadsTable leads={fechados} dateField="dataFechamento" dateLabel="Fechamento" />
      </div>
    </div>
  );
}
