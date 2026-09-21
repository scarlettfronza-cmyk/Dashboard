import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Copy, Check, Sparkles, Loader2, Wand2, Send, ChevronDown, ChevronUp } from "lucide-react";

interface ReportModalProps {
  clientId: number;
  clientName: string;
  from: string;
  to: string;
  onClose: () => void;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-md"
      style={{ background: "oklch(0.17 0.012 255)", border: "1px solid oklch(0.25 0.012 255)" }}
    >
      <span className="text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>{label}</span>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  );
}

export function ReportModal({ clientId, clientName, from, to, onClose }: ReportModalProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [refining, setRefining] = useState(false);
  const instructionRef = useRef<HTMLTextAreaElement>(null);

  const generateReport = trpc.dashboard.generateReport.useMutation({
    onSuccess: (data) => {
      setReportData(data);
      setGenerating(false);
    },
    onError: () => {
      toast.error("Erro ao gerar relatório. Tente novamente.");
      setGenerating(false);
    },
  });

  const refineReport = trpc.dashboard.refineReport.useMutation({
    onSuccess: (data) => {
      setReportData((prev: any) => ({ ...prev, analysis: data.analysis }));
      setRefining(false);
      setAiInstruction("");
      toast.success("Relatório ajustado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao ajustar o relatório. Tente novamente.");
      setRefining(false);
    },
  });

  const handleGenerate = () => {
    setGenerating(true);
    generateReport.mutate({ clientId, clientName, from, to });
  };

  const handleRefine = () => {
    if (!aiInstruction.trim() || !reportData) return;
    setRefining(true);
    refineReport.mutate({
      currentText: reportData.analysis,
      instruction: aiInstruction.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  };

  useEffect(() => {
    if (showAiPanel && instructionRef.current) {
      instructionRef.current.focus();
    }
  }, [showAiPanel]);

  const handleCopy = async () => {
    if (!reportData) return;
    try {
      await navigator.clipboard.writeText(reportData.analysis);
      setCopied(true);
      toast.success("Relatório copiado! Cole no WhatsApp ou e-mail.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar — selecione o texto manualmente.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0.05 0.012 255 / 0.85)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col rounded-2xl shadow-2xl"
        style={{ background: "oklch(0.18 0.012 255)", border: "1px solid oklch(0.30 0.012 255)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10"
          style={{ borderColor: "oklch(0.25 0.012 255)", background: "oklch(0.18 0.012 255)" }}
        >
          <div>
            <div className="text-base font-semibold text-white">Relatório de Performance</div>
            <div className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.010 240)" }}>
              {clientName} · {from} → {to}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: "oklch(0.55 0.010 240)", border: "1px solid transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "oklch(0.30 0.012 255)"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "oklch(0.55 0.010 240)"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {!reportData ? (
            <div className="flex flex-col items-center gap-5 py-10">
              {generating ? (
                <>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "oklch(0.60 0.18 240 / 0.12)", border: "1px solid oklch(0.60 0.18 240 / 0.25)" }}>
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: "oklch(0.70 0.18 240)" }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white text-center mb-1">Gerando análise com IA...</div>
                    <div className="text-xs text-center" style={{ color: "oklch(0.50 0.010 240)" }}>
                      Consultando dados e processando métricas
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: "oklch(0.60 0.18 240 / 0.10)", border: "1px solid oklch(0.60 0.18 240 / 0.20)" }}
                  >
                    <Sparkles className="w-6 h-6" style={{ color: "oklch(0.70 0.18 240)" }} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-white mb-1">Relatório com IA</div>
                    <div className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>
                      Gera um relatório completo com análise de performance<br />
                      no formato pronto para enviar no WhatsApp.
                    </div>
                  </div>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all"
                    style={{ background: "oklch(0.60 0.18 240)", color: "white" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.55 0.18 240)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(0.60 0.18 240)"; }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Gerar relatório
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* KPI Summary */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "oklch(0.50 0.010 240)" }}>
                  Indicadores do período
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <KpiRow label="Investimento" value={formatCurrency(reportData.kpis.investimento)} />
                  <KpiRow label="Leads" value={String(reportData.kpis.leads)} />
                  <KpiRow label="Custo por Lead" value={formatCurrency(reportData.kpis.custoPorLead)} />
                  {reportData.kpis.hasMondayData ? (
                    <>
                      <KpiRow label="Consultas" value={String(reportData.kpis.consultas ?? 0)} />
                      <KpiRow label="Fechamentos" value={String(reportData.kpis.vendas)} />
                      <KpiRow label="Custo por Consulta" value={formatCurrency(reportData.kpis.custoPorConsulta ?? 0)} />
                      <KpiRow label="Total em Consultas" value={formatCurrency(reportData.kpis.totalEmVendas)} />
                      <KpiRow label="Total em Fechamentos" value={formatCurrency(reportData.kpis.totalCirurgias ?? 0)} />
                      <KpiRow label="Total Geral" value={formatCurrency(reportData.kpis.totalEmVendas + (reportData.kpis.totalCirurgias ?? 0))} />
                    </>
                  ) : (
                    <>
                      <KpiRow label="Vendas" value={String(reportData.kpis.vendas)} />
                      <KpiRow label="Custo por Venda" value={formatCurrency(reportData.kpis.custoPorVenda)} />
                      <KpiRow label="Total em Vendas" value={formatCurrency(reportData.kpis.totalEmVendas)} />
                    </>
                  )}
                  <KpiRow label="Taxa de Conversão" value={`${reportData.kpis.taxaConversao.toFixed(2)}%`} />
                  <KpiRow label="ROAS" value={reportData.kpis.roas.toFixed(2)} />
                  <KpiRow label="Ticket Médio" value={formatCurrency(reportData.kpis.ticketMedio)} />
                  <KpiRow label="Novos Seguidores" value={String(reportData.kpis.novosSeguidores)} />
                </div>
              </div>

              {/* Report text */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "oklch(0.50 0.010 240)" }}>
                  Relatório gerado
                </div>
                <div
                  className="p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap relative"
                  style={{
                    background: "oklch(0.16 0.012 255)",
                    border: "1px solid oklch(0.25 0.012 255)",
                    color: "oklch(0.88 0.005 220)",
                    lineHeight: "1.8",
                    fontFamily: "inherit",
                  }}
                >
                  {refining ? (
                    <div className="flex items-center gap-3 py-8 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: "oklch(0.70 0.18 240)" }} />
                      <span className="text-sm" style={{ color: "oklch(0.60 0.010 240)" }}>Ajustando com IA...</span>
                    </div>
                  ) : (
                    reportData.analysis
                  )}
                </div>
              </div>

              {/* AI Instruction Panel */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: "1px solid oklch(0.28 0.015 260)" }}
              >
                {/* Toggle header */}
                <button
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  className="w-full flex items-center justify-between px-4 py-3 transition-all"
                  style={{
                    background: showAiPanel ? "oklch(0.22 0.015 260)" : "oklch(0.20 0.013 260)",
                    color: "oklch(0.75 0.12 240)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.22 0.015 260)"; }}
                  onMouseLeave={(e) => { if (!showAiPanel) e.currentTarget.style.background = "oklch(0.20 0.013 260)"; }}
                >
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Ajustar com IA</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.70 0.18 240)" }}>
                      Beta
                    </span>
                  </div>
                  {showAiPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {/* Instruction input */}
                {showAiPanel && (
                  <div
                    className="p-4 flex flex-col gap-3"
                    style={{ background: "oklch(0.19 0.013 260)" }}
                  >
                    <p className="text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>
                      Diga o que quer mudar no texto. Ex: "torne mais formal", "adicione emojis", "deixe mais curto", "mude o tom para mais motivador".
                    </p>
                    <div className="flex gap-2">
                      <textarea
                        ref={instructionRef}
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ex: deixe o texto mais curto e direto..."
                        rows={2}
                        disabled={refining}
                        className="flex-1 resize-none text-sm px-3 py-2 rounded-lg outline-none transition-all"
                        style={{
                          background: "oklch(0.16 0.012 255)",
                          border: "1px solid oklch(0.30 0.012 255)",
                          color: "oklch(0.88 0.005 220)",
                          fontFamily: "inherit",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "oklch(0.60 0.18 240 / 0.5)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "oklch(0.30 0.012 255)"; }}
                      />
                      <button
                        onClick={handleRefine}
                        disabled={!aiInstruction.trim() || refining}
                        className="flex items-center justify-center w-10 h-10 self-end rounded-lg transition-all flex-shrink-0"
                        style={{
                          background: aiInstruction.trim() && !refining ? "oklch(0.60 0.18 240)" : "oklch(0.28 0.012 255)",
                          color: aiInstruction.trim() && !refining ? "white" : "oklch(0.45 0.010 240)",
                          cursor: aiInstruction.trim() && !refining ? "pointer" : "not-allowed",
                        }}
                        onMouseEnter={(e) => { if (aiInstruction.trim() && !refining) e.currentTarget.style.background = "oklch(0.55 0.18 240)"; }}
                        onMouseLeave={(e) => { if (aiInstruction.trim() && !refining) e.currentTarget.style.background = "oklch(0.60 0.18 240)"; }}
                      >
                        {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>
                      Enter para enviar · Shift+Enter para nova linha
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all"
                  style={{
                    background: copied ? "oklch(0.68 0.16 160 / 0.15)" : "oklch(0.60 0.18 240)",
                    color: copied ? "oklch(0.72 0.16 160)" : "white",
                    border: copied ? "1px solid oklch(0.68 0.16 160 / 0.4)" : "none",
                  }}
                  onMouseEnter={(e) => { if (!copied) e.currentTarget.style.background = "oklch(0.55 0.18 240)"; }}
                  onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = "oklch(0.60 0.18 240)"; }}
                >
                  {copied ? (
                    <><Check className="w-4 h-4" /> Copiado!</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Copiar relatório</>
                  )}
                </button>
                <button
                  onClick={() => { setReportData(null); setShowAiPanel(false); setAiInstruction(""); }}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg transition-all"
                  style={{
                    border: "1px solid oklch(0.30 0.012 255)",
                    color: "oklch(0.60 0.010 240)",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "oklch(0.60 0.18 240 / 0.4)"; e.currentTarget.style.color = "oklch(0.80 0.18 240)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(0.30 0.012 255)"; e.currentTarget.style.color = "oklch(0.60 0.010 240)"; }}
                >
                  Novo relatório
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
