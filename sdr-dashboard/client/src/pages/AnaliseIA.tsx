/**
 * AnaliseIA — relatório do cliente ativo, com ajuste por mini-chat e publicação.
 *
 * Correções em relação à versão anterior:
 *  - `clientId` era enviado FIXO como 0. Como o portal busca relatórios por
 *    clientId, nenhum relatório jamais aparecia para o médico: o portal estava
 *    silenciosamente quebrado desde o início.
 *  - As métricas eram calculadas aqui e enviadas ao servidor, que confiava
 *    nelas. Agora só vão cliente e período; os números vêm do servidor.
 *  - O mini-chat conversava sem alterar o relatório. Agora ele devolve o texto
 *    revisado e substitui o conteúdo.
 *  - O relatório só chega ao portal depois de publicado explicitamente.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Sparkles, Copy, Check, RefreshCw, Send, Bot, Link as LinkIcon, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { parseReportSnapshot, type DateRange, type Metrics, type ReportSnapshot } from "@shared/metrics";
import { ReportVisuals } from "@/components/ReportVisuals";

interface AnaliseIAProps {
  clientId: number | null;
  clientName?: string;
  range: DateRange | null;
  metrics: Metrics | null;
  /** Algum board do cliente não carregou: gerar agora daria números a menos. */
  bloqueado?: boolean;
}

const card = {
  background: "oklch(1.000 0.015 265.0)",
  border: "1px solid oklch(0.910 0.015 265.0)",
};

export default function AnaliseIA({ clientId, clientName, range, metrics, bloqueado }: AnaliseIAProps) {
  const [reportId, setReportId] = useState<number | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [observacoes, setObservacoes] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const portalQuery = trpc.sdr.portalUrl.useQuery(
    { clientId: clientId ?? 0 },
    { enabled: clientId !== null },
  );

  const generate = trpc.sdr.generateAnalysis.useMutation({
    onSuccess: data => {
      setReportId(data.report?.id ?? null);
      setContent(data.report?.content ?? null);
      setSnapshot(parseReportSnapshot(data.report?.metricsSnapshot));
      setStatus("draft");
      setChatLog([]);
    },
    onError: e => toast.error(e.message),
  });

  const revise = trpc.sdr.reviseReport.useMutation({
    onSuccess: data => {
      setContent(data.content);
      setStatus("draft");
      setChatLog(prev => [...prev, { role: "assistant", content: "Relatório atualizado acima." }]);
    },
    onError: e => {
      toast.error(e.message);
      setChatLog(prev => prev.slice(0, -1));
    },
  });

  const publish = trpc.sdr.setReportStatus.useMutation({
    onSuccess: data => {
      setStatus(data.status);
      toast.success(
        data.status === "published"
          ? "Relatório publicado. Já aparece no portal do cliente."
          : "Relatório despublicado. Não está mais visível para o cliente.",
      );
    },
    onError: e => toast.error(e.message),
  });

  // Gera automaticamente ao trocar de cliente ou de período.
  const rangeKey = range ? `${range.from}:${range.to}` : "all";
  useEffect(() => {
    if (clientId === null || bloqueado) return;
    setContent(null);
    setReportId(null);
    setSnapshot(null);
    generate.mutate({ clientId, range, observacoes: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, rangeKey, bloqueado]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const handleRegenerate = useCallback(() => {
    if (clientId === null) return;
    generate.mutate({ clientId, range, observacoes: observacoes.trim() || undefined });
  }, [clientId, range, observacoes, generate]);

  const handleSend = useCallback(() => {
    const instruction = chatInput.trim();
    if (!instruction || !reportId || revise.isPending) return;
    setChatLog(prev => [...prev, { role: "user", content: instruction }]);
    setChatInput("");
    revise.mutate({ reportId, instruction });
  }, [chatInput, reportId, revise]);

  const copy = (text: string, setter: (v: boolean) => void, message: string) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success(message);
    setTimeout(() => setter(false), 2000);
  };

  if (clientId === null) {
    return (
      <div className="rounded-xl p-10 text-center" style={card}>
        <p className="text-sm" style={{ color: "oklch(0.560 0.012 265.0)" }}>
          Selecione um cliente na barra lateral para gerar o relatório.
        </p>
      </div>
    );
  }

  if (bloqueado) {
    return (
      <div
        className="rounded-2xl px-8 py-12 text-center max-w-xl mx-auto"
        style={{ background: "oklch(0.97 0.05 75)", border: "1px solid oklch(0.88 0.08 70)" }}
      >
        <p className="text-base font-semibold" style={{ color: "oklch(0.40 0.13 55)" }}>
          Relatório indisponível no momento
        </p>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "oklch(0.42 0.10 60)" }}>
          Parte dos dados deste cliente não carregou do Monday. Um relatório
          gerado agora teria números menores que a realidade, sem nada no texto
          avisando disso. Atualize os dados e volte aqui.
        </p>
      </div>
    );
  }

  const periodLabel = range ? `${range.from.split("-").reverse().join("/")} a ${range.to.split("-").reverse().join("/")}` : "todo o período";
  const portalUrl = portalQuery.data?.url;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-lg font-extrabold tracking-tight"
            style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.190 0.008 265.0)", letterSpacing: "-0.02em" }}
          >
            Relatório — {clientName}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.560 0.012 265.0)" }}>
            {periodLabel}
            {metrics && ` · ${metrics.leadsRecebidos} leads · ${metrics.negociosFechados} fechados`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={generate.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: "oklch(0.62 0.19 280 / 0.15)",
              color: "oklch(0.470 0.15 280.0)",
              border: "1px solid oklch(0.62 0.19 280 / 0.3)",
            }}
          >
            <RefreshCw size={12} className={generate.isPending ? "animate-spin" : ""} />
            Regerar
          </button>
        </div>
      </div>

      {/* Prévia: é exatamente o que o médico verá no portal. Fica acima do
          texto para a SDR conferir os números antes de publicar. */}
      {snapshot && (
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            Prévia do que o cliente vê
          </p>
          <ReportVisuals snapshot={snapshot} />
        </div>
      )}

      {/* Contexto opcional que a SDR quer que a IA leve em conta */}
      <input
        value={observacoes}
        onChange={e => setObservacoes(e.target.value)}
        placeholder="Contexto do período para a IA considerar (ex: feriado prolongado, campanha nova) — opcional"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "oklch(0.975 0.015 265.0)", border: "1px solid oklch(0.905 0.015 265.0)", color: "oklch(0.290 0.008 265.0)" }}
      />

      {/* Relatório */}
      <div className="rounded-xl p-5" style={card}>
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: "oklch(0.500 0.17 280.0)" }} />
            <span className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
              Relatório gerado pela IA
            </span>
            <span
              className="text-sm px-2 py-0.5 rounded-full"
              style={
                status === "published"
                  ? { background: "oklch(0.55 0.19 145 / 0.18)", color: "#22c55e", border: "1px solid oklch(0.55 0.19 145 / 0.35)" }
                  : { background: "oklch(0.925 0.015 265.0)", color: "oklch(0.480 0.012 265.0)", border: "1px solid oklch(0.880 0.015 265.0)" }
              }
            >
              {status === "published" ? "Publicado" : "Rascunho"}
            </span>
          </div>

          {content && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => copy(content, setCopied, "Relatório copiado!")}
                className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md transition-all"
                style={{ background: "oklch(0.925 0.015 265.0)", color: "oklch(0.440 0.012 265.0)", border: "1px solid oklch(0.890 0.015 265.0)" }}
              >
                {copied ? <Check size={12} style={{ color: "#22c55e" }} /> : <Copy size={12} />}
                {copied ? "Copiado!" : "Copiar"}
              </button>

              <button
                onClick={() => reportId && publish.mutate({ reportId, status: status === "published" ? "draft" : "published" })}
                disabled={!reportId || publish.isPending}
                className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md transition-all disabled:opacity-40"
                style={{ background: "oklch(0.62 0.19 280)", color: "white" }}
              >
                {status === "published" ? <EyeOff size={12} /> : <Eye size={12} />}
                {status === "published" ? "Despublicar" : "Publicar para o cliente"}
              </button>

              {portalUrl && (
                <button
                  onClick={() => copy(portalUrl, setCopiedLink, "Link do portal copiado!")}
                  className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md transition-all"
                  style={{ background: "oklch(0.925 0.015 265.0)", color: copiedLink ? "#22c55e" : "oklch(0.440 0.012 265.0)", border: "1px solid oklch(0.890 0.015 265.0)" }}
                >
                  {copiedLink ? <Check size={12} style={{ color: "#22c55e" }} /> : <LinkIcon size={12} />}
                  {copiedLink ? "Link copiado!" : "Link do cliente"}
                </button>
              )}
            </div>
          )}
        </div>

        {generate.isPending ? (
          <div className="flex items-center gap-3 py-8 justify-center">
            <Sparkles size={16} className="animate-pulse" style={{ color: "oklch(0.500 0.17 280.0)" }} />
            <span className="text-sm" style={{ color: "oklch(0.520 0.012 265.0)" }}>
              Calculando os números e escrevendo o relatório...
            </span>
          </div>
        ) : content ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "oklch(0.290 0.008 265.0)" }}>
            {content}
          </div>
        ) : (
          <p className="py-8 text-center text-sm" style={{ color: "oklch(0.600 0.012 265.0)" }}>
            Nenhum relatório gerado ainda.
          </p>
        )}

        {status === "draft" && content && (
          <p className="text-sm mt-4 pt-3" style={{ color: "oklch(0.560 0.012 265.0)", borderTop: "1px solid oklch(0.925 0.015 265.0)" }}>
            Este rascunho ainda não aparece no portal do cliente. Publique quando estiver satisfeita com o texto.
          </p>
        )}
      </div>

      {/* Mini-chat de ajuste */}
      {content && (
        <div className="rounded-xl overflow-hidden" style={card}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "oklch(0.925 0.015 265.0)" }}>
            <Bot size={14} style={{ color: "oklch(0.500 0.17 280.0)" }} />
            <span className="text-sm font-semibold" style={{ color: "oklch(0.470 0.12 280.0)" }}>
              Quer ajustar o relatório? Peça aqui — o texto acima é reescrito.
            </span>
          </div>

          {chatLog.length > 0 && (
            <div className="px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
              {chatLog.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed"
                    style={
                      m.role === "user"
                        ? { background: "oklch(0.62 0.19 280 / 0.2)", color: "oklch(0.450 0.1 280.0)" }
                        : { background: "oklch(0.970 0.015 265.0)", color: "oklch(0.420 0.008 265.0)" }
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {revise.isPending && (
                <p className="text-sm" style={{ color: "oklch(0.520 0.012 265.0)" }}>
                  Reescrevendo...
                </p>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}

          <div className="px-4 py-3 flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ex: deixe o tom mais direto e cite os procedimentos mais buscados"
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "oklch(0.970 0.015 265.0)", border: "1px solid oklch(0.890 0.015 265.0)", color: "oklch(0.290 0.008 265.0)" }}
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim() || revise.isPending}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ background: "oklch(0.62 0.19 280)", color: "white" }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
