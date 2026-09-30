/**
 * Atendimentos — Midnight Operations Dashboard
 * Aba de atendimentos: leads recebidos, conversas Insta/Whats.
 * Nota: os dados de conversas (WhatsApp/Instagram) vêm do relatório textual das SDRs.
 * Esta aba exibe os dados disponíveis no Monday + campo para inserção manual do relatório semanal.
 */
import { useState, useMemo } from "react";
import { Lead, AtendimentoRecord } from "@/hooks/useMondayData";
import { KpiCard } from "@/components/KpiCard";
import { PieChartCard } from "@/components/PieChartCard";
import { Users } from "lucide-react";
import { filterAtendimentosByRange, filterLeadsByDate, type DateRange } from "@shared/metrics";

interface AtendimentosProps {
  leads: Lead[];
  atendimentos: AtendimentoRecord[];
  range: DateRange | null;
}

// Manual report state (stored in localStorage)
interface WeeklyReport {
  novosContatos: number;
  conversasWhatsApp: number;
  conversasInstagram: number;
  agendamentos: number;
  semana: string;
}

function getReports(): WeeklyReport[] {
  try {
    return JSON.parse(localStorage.getItem("sdr_weekly_reports") || "[]");
  } catch {
    return [];
  }
}

function saveReports(reports: WeeklyReport[]) {
  localStorage.setItem("sdr_weekly_reports", JSON.stringify(reports));
}

export default function Atendimentos({ leads, atendimentos, range }: AtendimentosProps) {
  const [reports, setReports] = useState<WeeklyReport[]>(getReports);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WeeklyReport>({
    novosContatos: 0, conversasWhatsApp: 0, conversasInstagram: 0, agendamentos: 0, semana: ""
  });

  const filtered = useMemo(() => {
    return filterLeadsByDate(leads, "dataConversao", range, "dataConsulta");
  }, [leads, range]);
  const filteredAtendimentos = useMemo(() => filterAtendimentosByRange(atendimentos, range), [atendimentos, range]);

  const canalStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of filtered) {
      if (l.canal) map[l.canal] = (map[l.canal] || 0) + 1;
    }
    const colors: Record<string, string> = {
      "Whats/META": "#7c6af7", "Indicações": "#22c55e", "Instagram/DIRECT": "#f59e0b",
      "Google": "#3b82f6", "Social Selling/DIRECT": "#ec4899",
    };
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({
      name, value, color: colors[name] || "#8b8fa8"
    }));
  }, [filtered]);

  // Aggregate atendimento data from Monday boards
  const mondayTotals = useMemo(() => {
    return filteredAtendimentos.reduce((acc, r) => ({
      novosContatos: acc.novosContatos + r.novosContatos,
      conversasRealizadas: acc.conversasRealizadas + r.conversasRealizadas,
      consultaAgendada: acc.consultaAgendada + r.consultaAgendada,
      procedimentoVendido: acc.procedimentoVendido + r.procedimentoVendido,
    }), { novosContatos: 0, conversasRealizadas: 0, consultaAgendada: 0, procedimentoVendido: 0 });
  }, [filteredAtendimentos]);

  const totalConversasWhats = reports.reduce((s, r) => s + r.conversasWhatsApp, 0) + mondayTotals.conversasRealizadas;
  const totalConversasInsta = reports.reduce((s, r) => s + r.conversasInstagram, 0);
  const totalNovosContatos = reports.reduce((s, r) => s + r.novosContatos, 0) + mondayTotals.novosContatos;

  const handleSave = () => {
    const updated = [form, ...reports];
    setReports(updated);
    saveReports(updated);
    setShowForm(false);
    setForm({ novosContatos: 0, conversasWhatsApp: 0, conversasInstagram: 0, agendamentos: 0, semana: "" });
  };

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.220 0.008 265.0)" }}>
            Atendimentos
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.520 0.012 265.0)" }}>
            Leads recebidos e conversas por canal
          </p>
        </div>
      </div>

      {/* KPIs from Monday */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.580 0.012 265.0)" }}>
          Dados do Monday.com
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Leads no Monday" value={filtered.length} accentColor="#7c6af7" icon={<Users size={16} />} />
          {canalStats.slice(0, 3).map((c) => (
            <KpiCard key={c.name} label={c.name} value={c.value} accentColor={c.color}
              subValue={`${filtered.length > 0 ? ((c.value / filtered.length) * 100).toFixed(0) : 0}%`} />
          ))}
        </div>
      </div>

      {/* Canal chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieChartCard title="Leads por Canal de Aquisição" data={canalStats} />

        {/* Weekly reports */}
        <div className="rounded-lg p-5" style={{ background: "oklch(1.000 0.015 265.0)", border: "1px solid oklch(0.910 0.015 265.0)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
              Relatório Semanal (WhatsApp)
            </h3>
            <button onClick={() => setShowForm(!showForm)}
              className="text-sm px-2.5 py-1 rounded-md transition-all"
              style={{ background: "oklch(0.62 0.19 280 / 0.2)", color: "oklch(0.460 0.15 280.0)", border: "1px solid oklch(0.62 0.19 280 / 0.3)" }}>
              + Adicionar
            </button>
          </div>

          {showForm && (
            <div className="mb-4 p-3 rounded-md space-y-2" style={{ background: "oklch(0.975 0.015 265.0)", border: "1px solid oklch(0.905 0.015 265.0)" }}>
              <input placeholder="Semana (ex: 28/07 - 03/08)" value={form.semana}
                onChange={(e) => setForm({ ...form, semana: e.target.value })}
                className="w-full px-3 py-1.5 rounded text-sm outline-none"
                style={{ background: "oklch(0.925 0.015 265.0)", border: "1px solid oklch(0.890 0.015 265.0)", color: "oklch(0.250 0.008 265.0)" }} />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "novosContatos", label: "Novos Contatos" },
                  { key: "conversasWhatsApp", label: "Conversas WhatsApp" },
                  { key: "conversasInstagram", label: "Conversas Instagram" },
                  { key: "agendamentos", label: "Agendamentos" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm block mb-1" style={{ color: "oklch(0.520 0.012 265.0)" }}>{label}</label>
                    <input type="number" min={0} value={form[key as keyof WeeklyReport] as number}
                      onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 rounded text-sm outline-none"
                      style={{ background: "oklch(0.925 0.015 265.0)", border: "1px solid oklch(0.890 0.015 265.0)", color: "oklch(0.250 0.008 265.0)" }} />
                  </div>
                ))}
              </div>
              <button onClick={handleSave}
                className="w-full py-1.5 rounded text-sm font-medium transition-all"
                style={{ background: "oklch(0.62 0.19 280)", color: "white" }}>
                Salvar Relatório
              </button>
            </div>
          )}

          {reports.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded" style={{ background: "oklch(0.975 0.015 265.0)" }}>
                  <p className="text-lg font-bold" style={{ color: "#7c6af7", fontFamily: "'DM Sans', sans-serif" }}>{totalNovosContatos}</p>
                  <p className="text-sm" style={{ color: "oklch(0.520 0.012 265.0)" }}>Novos Contatos</p>
                </div>
                <div className="text-center p-2 rounded" style={{ background: "oklch(0.975 0.015 265.0)" }}>
                  <p className="text-lg font-bold" style={{ color: "#22c55e", fontFamily: "'DM Sans', sans-serif" }}>{totalConversasWhats}</p>
                  <p className="text-sm" style={{ color: "oklch(0.520 0.012 265.0)" }}>Conv. WhatsApp</p>
                </div>
                <div className="text-center p-2 rounded" style={{ background: "oklch(0.975 0.015 265.0)" }}>
                  <p className="text-lg font-bold" style={{ color: "#f59e0b", fontFamily: "'DM Sans', sans-serif" }}>{totalConversasInsta}</p>
                  <p className="text-sm" style={{ color: "oklch(0.520 0.012 265.0)" }}>Conv. Instagram</p>
                </div>
              </div>
              {reports.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded text-sm"
                  style={{ background: "oklch(0.975 0.015 265.0)", border: "1px solid oklch(0.915 0.015 265.0)" }}>
                  <span style={{ color: "oklch(0.380 0.012 265.0)" }}>{r.semana || `Semana ${i + 1}`}</span>
                  <div className="flex gap-3">
                    <span style={{ color: "#7c6af7" }}>{r.novosContatos} contatos</span>
                    <span style={{ color: "#22c55e" }}>{r.conversasWhatsApp} whats</span>
                    <span style={{ color: "#f59e0b" }}>{r.conversasInstagram} insta</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: "oklch(0.600 0.012 265.0)" }}>
              Adicione os relatórios semanais das SDRs
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
