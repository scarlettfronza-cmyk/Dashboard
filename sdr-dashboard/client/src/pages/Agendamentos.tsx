/**
 * Agendamentos — Midnight Operations Dashboard
 * Aba de agendamentos do mês com calendário e lista.
 */
import { useMemo } from "react";
import { Lead } from "@/hooks/useMondayData";
import { KpiCard } from "@/components/KpiCard";
import { LeadsTable } from "@/components/LeadsTable";
import { Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { filterLeadsByDate, isCanalIndicacao, type DateRange, type Metrics } from "@shared/metrics";

interface AgendamentosProps {
  leads: Lead[];
  metrics: Metrics | null;
  range: DateRange | null;
}

export default function Agendamentos({ leads, metrics, range }: AgendamentosProps) {
  const filtered = useMemo(() => {
    return filterLeadsByDate(leads, "dataConsulta", range).filter(
      lead => lead.dataConsulta && !isCanalIndicacao(lead.canal),
    );
  }, [leads, range]);

  const compareceu = filtered.filter((l) => l.compareceu === "Sim").length;
  const naoCompareceu = filtered.filter((l) => l.compareceu === "Não").length;
  const reagendar = filtered.filter((l) => l.compareceu === "Reagendar" || l.compareceu === "Reagendado").length;
  const semInfo = filtered.filter((l) => !l.compareceu).length;
  const taxaPresenca = filtered.length > 0 ? (compareceu / filtered.length) * 100 : 0;

  // Group by date
  const byDate = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const l of filtered) {
      const d = l.dataConsulta;
      if (!map[d]) map[d] = [];
      map[d].push(l);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${day} ${months[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.220 0.008 265.0)" }}>
            Agendamentos
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.520 0.012 265.0)" }}>
            Consultas agendadas e comparecimento
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Agendado" value={metrics?.agendamentos ?? filtered.length} accentColor="#7c6af7" icon={<Calendar size={16} />} />
        <KpiCard label="Compareceu" value={metrics?.comparecimentos ?? compareceu} accentColor="#22c55e" icon={<CheckCircle size={16} />}
          trend="up" trendLabel={`${(metrics?.taxaComparecimento ?? taxaPresenca).toFixed(1)}% presença`} />
        <KpiCard label="Não Compareceu" value={naoCompareceu} accentColor="#ef4444" icon={<XCircle size={16} />} />
        <KpiCard label="Reagendar/Reagendado" value={reagendar} accentColor="#f59e0b" icon={<Clock size={16} />} />
      </div>

      {/* Timeline by date */}
      <div className="rounded-lg p-5 space-y-4"
        style={{ background: "oklch(1.000 0.015 265.0)", border: "1px solid oklch(0.910 0.015 265.0)" }}>
        <h3 className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
          Agenda por Data
        </h3>
        {byDate.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "oklch(0.600 0.012 265.0)" }}>Nenhum agendamento encontrado</p>
        ) : (
          <div className="space-y-4">
            {byDate.map(([date, dateLeads]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold px-2.5 py-1 rounded-md"
                    style={{ background: "oklch(0.925 0.015 265.0)", color: "oklch(0.380 0.012 265.0)" }}>
                    {formatDate(date)}
                  </span>
                  <span className="text-sm" style={{ color: "oklch(0.560 0.012 265.0)" }}>{dateLeads.length} consulta{dateLeads.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-2">
                  {dateLeads.map((lead) => {
                    const compColor = lead.compareceu === "Sim" ? "#22c55e" : lead.compareceu === "Não" ? "#ef4444" : "#f59e0b";
                    return (
                      <div key={lead.id} className="flex items-start gap-3 p-3 rounded-md"
                        style={{ background: "oklch(0.975 0.015 265.0)", border: "1px solid oklch(0.915 0.015 265.0)" }}>
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: compColor }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "oklch(0.250 0.008 265.0)" }}>{lead.name}</p>
                          <p className="text-sm truncate" style={{ color: "oklch(0.520 0.012 265.0)" }}>{lead.procedimento || "Sem procedimento"}</p>
                          <p className="text-sm mt-0.5" style={{ color: compColor }}>{lead.compareceu || "Sem info"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LeadsTable leads={filtered} />
    </div>
  );
}
