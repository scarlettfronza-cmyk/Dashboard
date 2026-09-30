/**
 * LeadsTable — Midnight Operations Dashboard
 * Filterable, paginated table of leads with status badges.
 */
import { useState, useMemo } from "react";
import { Lead } from "@/hooks/useMondayData";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

/**
 * Cores dos selos de status, no tema claro.
 *
 * A versão anterior era do tema escuro: texto claro sobre fundo escuro
 * translúcido. Sobre o branco, o texto claro ficava ilegível — o selo "Em
 * negociação" aparecia como laranja sobre laranja.
 * Aqui o fundo é bem claro e o texto bem escuro, com contraste acima de 4.5:1.
 */
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  "Negócio fechado": { bg: "oklch(0.95 0.05 160)", text: "oklch(0.42 0.14 160)", dot: "#16a34a" },
  "Em negociação": { bg: "oklch(0.96 0.06 75)", text: "oklch(0.45 0.13 60)", dot: "#d97706" },
  "Negócio perdido": { bg: "oklch(0.95 0.05 25)", text: "oklch(0.45 0.17 25)", dot: "#dc2626" },
  "Aguardando retorno": { bg: "oklch(0.95 0.05 240)", text: "oklch(0.45 0.15 250)", dot: "#2563eb" },
};

const COMPARECEU_STYLES: Record<string, { text: string }> = {
  Sim: { text: "#22c55e" },
  Não: { text: "#ef4444" },
  Reagendar: { text: "#f59e0b" },
  Reagendado: { text: "#3b82f6" },
};

const PAGE_SIZE = 10;

interface LeadsTableProps {
  leads: Lead[];
  selectedMes?: string;
  /** Campo de data que definiu a inclusão da linha no período da aba atual. */
  dateField?: "dataConsulta" | "dataConversao" | "dataFechamento" | "dataProcedimento";
  dateLabel?: string;
}

export function LeadsTable({ leads, selectedMes, dateField = "dataConsulta", dateLabel = "Consulta" }: LeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [page, setPage] = useState(1);

  const allStatuses = useMemo(() => {
    const s = new Set(leads.map((l) => l.statusLead).filter(Boolean));
    return ["Todos", ...Array.from(s)];
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;
    if (selectedMes && selectedMes !== "Todos") result = result.filter((l) => l.group === selectedMes);
    if (statusFilter !== "Todos") result = result.filter((l) => l.statusLead === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) => l.name.toLowerCase().includes(q) || l.procedimento.toLowerCase().includes(q) || l.canal.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, selectedMes, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (d: string) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const formatCurrency = (v: number | null) => {
    if (v === null) return "—";
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "oklch(1.000 0.015 265.0)", border: "1px solid oklch(0.910 0.015 265.0)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "oklch(0.925 0.015 265.0)" }}>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.560 0.012 265.0)" }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar lead..."
            className="w-full pl-7 pr-3 py-1.5 rounded-md text-sm outline-none"
            style={{ background: "oklch(0.970 0.015 265.0)", border: "1px solid oklch(0.890 0.015 265.0)", color: "oklch(0.250 0.008 265.0)" }}
          />
        </div>
        <div className="flex gap-1.5">
          {allStatuses.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="px-2.5 py-1 rounded-md text-sm transition-all"
              style={
                statusFilter === s
                  ? { background: "oklch(0.62 0.19 280 / 0.2)", color: "oklch(0.460 0.15 280.0)", border: "1px solid oklch(0.62 0.19 280 / 0.4)" }
                  : { background: "oklch(0.970 0.015 265.0)", color: "oklch(0.500 0.012 265.0)", border: "1px solid oklch(0.910 0.015 265.0)" }
              }
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-sm ml-auto" style={{ color: "oklch(0.560 0.012 265.0)" }}>
          {filtered.length} leads
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid oklch(0.925 0.015 265.0)" }}>
              {["Lead", "SDR", "Canal", "Procedimento", dateLabel, "Compareceu", "Status", "Valor"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider"
                  style={{ color: "oklch(0.580 0.012 265.0)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: "oklch(0.600 0.012 265.0)" }}>
                  Nenhum lead encontrado
                </td>
              </tr>
            ) : (
              paginated.map((lead, i) => {
                const statusStyle = STATUS_STYLES[lead.statusLead] || { bg: "transparent", text: "oklch(0.480 0.012 265.0)", dot: "#8b8fa8" };
                const compStyle = COMPARECEU_STYLES[lead.compareceu] || { text: "oklch(0.520 0.012 265.0)" };
                return (
                  <tr key={lead.id}
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid oklch(0.970 0.015 265.0)",
                      background: i % 2 === 0 ? "transparent" : "oklch(1.000 0.015 265.0/ 0.5)",
                    }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "oklch(0.250 0.008 265.0)", maxWidth: "160px" }}>
                      <span className="truncate block">{lead.name}</span>
                      {lead.boardName && (
                        <span className="text-sm block truncate" style={{ color: "oklch(0.580 0.012 265.0)" }}>{lead.boardName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: "oklch(0.420 0.012 265.0)" }}>{lead.sdr || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "oklch(0.420 0.012 265.0)" }}>{lead.canal || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "oklch(0.420 0.012 265.0)" }}>{lead.procedimento || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "oklch(0.480 0.012 265.0)" }}>{formatDate(lead[dateField])}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: compStyle.text }}>{lead.compareceu || "—"}</td>
                    <td className="px-4 py-3">
                      {lead.statusLead ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-sm font-medium"
                          style={{ background: statusStyle.bg, color: statusStyle.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
                          {lead.statusLead}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: lead.valor ? "#22c55e" : "oklch(0.520 0.012 265.0)" }}>
                      {formatCurrency(lead.valor)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "oklch(0.925 0.015 265.0)" }}>
          <span className="text-sm" style={{ color: "oklch(0.560 0.012 265.0)" }}>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-md transition-colors disabled:opacity-30"
              style={{ background: "oklch(0.970 0.015 265.0)", color: "oklch(0.440 0.012 265.0)" }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-md transition-colors disabled:opacity-30"
              style={{ background: "oklch(0.970 0.015 265.0)", color: "oklch(0.440 0.012 265.0)" }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
