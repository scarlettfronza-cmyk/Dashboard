/**
 * Overview — visão geral do cliente selecionado.
 *
 * Usa o mesmo componente visual do portal do médico (ReportVisuals), então a
 * SDR vê os números exatamente como o cliente vai ver. Antes esta tela
 * recalculava as métricas por conta própria, com fórmulas diferentes das do
 * resto do sistema; agora ela só desenha o que recebe.
 */
import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { LeadsTable } from "@/components/LeadsTable";
import { ReportVisuals } from "@/components/ReportVisuals";
import {
  buildReportSnapshot,
  compareMetrics,
  computeMetrics,
  previousRange,
  type DateRange,
  type Lead,
  type Metrics,
} from "@shared/metrics";

interface OverviewProps {
  metrics: Metrics | null;
  leads: Lead[];
  /** Lista filtrada exibida na tabela; o conjunto completo fica para o comparativo. */
  displayLeads?: Lead[];
  range: DateRange | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  clientName?: string;
}

export default function Overview({ metrics, leads, displayLeads, range, loading, error, onRetry, clientName }: OverviewProps) {
  // O comparativo com o período anterior só faz sentido com período definido.
  const snapshot = useMemo(() => {
    if (!metrics) return null;
    const comparison = range ? compareMetrics(metrics, computeMetrics(leads, previousRange(range))) : undefined;
    return buildReportSnapshot(clientName ?? "Todos os clientes", range, metrics, comparison);
  }, [metrics, leads, range, clientName]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-center max-w-md px-6">
          <AlertCircle size={30} className="mx-auto mb-3" style={{ color: "oklch(0.50 0.20 25)" }} />
          <p className="text-base font-medium" style={{ color: "var(--foreground)" }}>
            Não foi possível carregar os dados do Monday.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-5 px-4 py-2.5 rounded-xl text-base font-medium"
              style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              Tentar de novo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-center">
          <div
            className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
          />
          <p className="text-base" style={{ color: "var(--muted-foreground)" }}>
            Carregando dados do Monday.com...
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Na primeira vez pode levar alguns segundos.
          </p>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-center">
          <AlertCircle size={34} className="mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-base" style={{ color: "var(--muted-foreground)" }}>
            Nenhum dado disponível neste período.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportVisuals snapshot={snapshot} />

      <div>
        <h3
          className="text-base font-bold mb-3"
          style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)" }}
        >
          Leads do período
        </h3>
        <LeadsTable leads={displayLeads ?? leads} dateField="dataConversao" dateLabel="Entrada" />
      </div>
    </div>
  );
}
