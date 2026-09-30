/**
 * Relatório — texto do período, conferência dos números e entrega à clínica.
 *
 * O texto é montado no servidor a partir das métricas (sem IA) e a SDR pode
 * editá-lo aqui. A entrega segue o dashboard de tráfego: envio direto no
 * grupo da clínica pela Z-API, com o link do portal no fim. Sem Z-API, o
 * botão "Abrir no WhatsApp" abre a conversa com a mensagem pronta.
 *
 * Enviar ou abrir no WhatsApp publica o relatório, para o link do portal já
 * mostrar o que foi entregue.
 */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, Link as LinkIcon, MessageCircle, RefreshCw, Save, Send } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseReportSnapshot, type DateRange, type Metrics, type ReportSnapshot } from "@shared/metrics";
import { linkAbrirWhatsApp, montarMensagemWhatsApp } from "@shared/whatsappRelatorio";
import { ReportVisuals } from "@/components/ReportVisuals";

interface RelatorioProps {
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
const muted = { color: "oklch(0.560 0.012 265.0)" };
const botaoSecundario = {
  background: "oklch(0.925 0.015 265.0)",
  color: "oklch(0.440 0.012 265.0)",
  border: "1px solid oklch(0.890 0.015 265.0)",
};
const verdeWhats = { background: "#25D366", color: "#062b16" };

export default function Relatorio({ clientId, clientName, range, metrics, bloqueado }: RelatorioProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const utils = trpc.useUtils();

  const [reportId, setReportId] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [textoSalvo, setTextoSalvo] = useState("");
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [observacoes, setObservacoes] = useState("");
  const [copiado, setCopiado] = useState<"mensagem" | "link" | null>(null);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);

  const portal = trpc.sdr.portalUrl.useQuery({ clientId: clientId ?? 0, origin }, { enabled: clientId !== null });
  const clientes = trpc.sdr.clients.useQuery(undefined, { enabled: clientId !== null });
  const zap = trpc.sdr.whatsappStatus.useQuery(undefined, { enabled: clientId !== null, staleTime: 60_000 });
  const zapPronto = zap.data?.configurado && zap.data.connected;
  const grupos = trpc.sdr.whatsappGroups.useQuery(undefined, { enabled: Boolean(zapPronto), staleTime: 5 * 60_000 });

  const grupoId = clientes.data?.find(c => c.id === clientId)?.whatsappGroupId ?? null;
  const grupoNome = grupos.data?.find(g => g.id === grupoId)?.name;
  const portalUrl = portal.data?.url ?? null;
  const mensagem = useMemo(() => montarMensagemWhatsApp(texto, portalUrl), [texto, portalUrl]);
  const alterado = texto.trim() !== textoSalvo.trim();

  const generate = trpc.sdr.generateAnalysis.useMutation({
    onSuccess: data => {
      setReportId(data.report?.id ?? null);
      setTexto(data.report?.content ?? "");
      setTextoSalvo(data.report?.content ?? "");
      setSnapshot(parseReportSnapshot(data.report?.metricsSnapshot));
      setStatus("draft");
    },
    onError: e => toast.error(e.message),
  });

  const edit = trpc.sdr.editReport.useMutation({ onError: e => toast.error(e.message) });
  const publish = trpc.sdr.setReportStatus.useMutation({ onError: e => toast.error(e.message) });

  const setGroup = trpc.sdr.setWhatsappGroup.useMutation({
    onSuccess: () => {
      utils.sdr.clients.invalidate();
      toast.success("Grupo da clínica salvo.");
    },
    onError: e => toast.error(e.message),
  });

  const send = trpc.sdr.sendReportWhatsApp.useMutation({
    onSuccess: () => {
      setTextoSalvo(texto);
      setStatus("published");
      setConfirmarEnvio(false);
      toast.success("Relatório enviado no grupo da clínica e publicado no portal.");
    },
    onError: e => toast.error(e.message),
  });

  // Monta o texto ao trocar de cliente ou de período.
  const rangeKey = range ? `${range.from}:${range.to}` : "all";
  useEffect(() => {
    if (clientId === null || bloqueado) return;
    setTexto("");
    setTextoSalvo("");
    setReportId(null);
    setSnapshot(null);
    generate.mutate({ clientId, range });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, rangeKey, bloqueado]);

  /** Grava o texto editado, se houver mudança. Editar devolve a rascunho. */
  async function salvarTexto() {
    if (!reportId || !alterado || !texto.trim()) return;
    await edit.mutateAsync({ reportId, content: texto });
    setTextoSalvo(texto);
    setStatus("draft");
  }

  async function alternarPublicacao() {
    if (!reportId) return;
    await salvarTexto();
    const novo = status === "published" ? "draft" : "published";
    const r = await publish.mutateAsync({ reportId, status: novo });
    setStatus(r.status);
    toast.success(r.status === "published" ? "Publicado. Já aparece no portal da clínica." : "Despublicado. Não aparece mais no portal.");
  }

  async function abrirNoWhatsApp() {
    if (!reportId) return;
    // A janela abre já no clique; depois das gravações ela recebe o endereço.
    // Abrir só no fim faria o navegador bloquear como pop-up.
    const janela = window.open("", "_blank");
    try {
      await salvarTexto();
      if (status !== "published") {
        await publish.mutateAsync({ reportId, status: "published" });
        setStatus("published");
      }
      const url = linkAbrirWhatsApp(mensagem);
      if (janela) janela.location.href = url;
      else window.location.href = url;
    } catch {
      janela?.close();
    }
  }

  /** Acrescenta o contexto antes da despedida, sem desfazer o que já foi editado. */
  function incluirObservacao() {
    const obs = observacoes.trim();
    if (!obs) return;
    setTexto(atual => {
      const blocos = atual.trimEnd().split("\n\n");
      if (blocos.length > 1) blocos.splice(blocos.length - 1, 0, obs);
      else blocos.push(obs);
      return blocos.join("\n\n");
    });
    setObservacoes("");
  }

  function copiar(valor: string, qual: "mensagem" | "link") {
    navigator.clipboard.writeText(valor);
    setCopiado(qual);
    toast.success(qual === "link" ? "Link do portal copiado." : "Mensagem copiada.");
    setTimeout(() => setCopiado(null), 2000);
  }

  if (clientId === null) {
    return (
      <div className="rounded-xl p-10 text-center" style={card}>
        <p className="text-sm" style={muted}>Selecione um cliente na barra lateral para montar o relatório.</p>
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
          Parte dos dados deste cliente não carregou do Monday. Um relatório montado agora teria números menores que a
          realidade. Atualize os dados e volte aqui.
        </p>
      </div>
    );
  }

  const periodLabel = range
    ? `${range.from.split("-").reverse().join("/")} a ${range.to.split("-").reverse().join("/")}`
    : "todo o período";
  const ocupado = generate.isPending || edit.isPending || publish.isPending || send.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-lg font-extrabold tracking-tight"
            style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.190 0.008 265.0)", letterSpacing: "-0.02em" }}
          >
            Relatório · {clientName}
          </h2>
          <p className="text-sm mt-0.5" style={muted}>
            {periodLabel}
            {metrics && ` · ${metrics.leadsRecebidos} leads · ${metrics.negociosFechados} fechados`}
          </p>
        </div>
        <button
          onClick={() => clientId && generate.mutate({ clientId, range })}
          disabled={ocupado}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ background: "oklch(0.62 0.19 280 / 0.15)", color: "oklch(0.470 0.15 280.0)", border: "1px solid oklch(0.62 0.19 280 / 0.3)" }}
        >
          <RefreshCw size={12} className={generate.isPending ? "animate-spin" : ""} />
          Montar de novo
        </button>
      </div>

      {/* Prévia: é exatamente o que a clínica verá no portal. */}
      {snapshot && (
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            Prévia do que a clínica vê
          </p>
          <ReportVisuals snapshot={snapshot} />
        </div>
      )}

      {/* Texto */}
      <div className="rounded-xl p-5 space-y-3" style={card}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
              Mensagem do relatório
            </span>
            <span
              className="text-sm px-2 py-0.5 rounded-full"
              style={
                status === "published"
                  ? { background: "oklch(0.55 0.19 145 / 0.18)", color: "#16a34a", border: "1px solid oklch(0.55 0.19 145 / 0.35)" }
                  : { background: "oklch(0.925 0.015 265.0)", color: "oklch(0.480 0.012 265.0)", border: "1px solid oklch(0.880 0.015 265.0)" }
              }
            >
              {status === "published" ? "Publicado" : "Rascunho"}
            </span>
          </div>
          {alterado && (
            <button
              onClick={() => salvarTexto().then(() => toast.success("Texto salvo."))}
              disabled={ocupado}
              className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md disabled:opacity-50"
              style={botaoSecundario}
            >
              <Save size={12} /> Salvar texto
            </button>
          )}
        </div>

        {generate.isPending ? (
          <p className="py-8 text-center text-sm animate-pulse" style={muted}>Calculando os números do período...</p>
        ) : (
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={14}
            maxLength={6000}
            className="w-full text-sm rounded-lg px-3 py-2 leading-relaxed outline-none"
            style={{ background: "oklch(0.975 0.015 265.0)", border: "1px solid oklch(0.905 0.015 265.0)", color: "oklch(0.290 0.008 265.0)" }}
          />
        )}

        <div className="flex gap-2">
          <input
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Algo a contar sobre o período? (ex.: feriado prolongado, campanha nova) Opcional"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "oklch(0.975 0.015 265.0)", border: "1px solid oklch(0.905 0.015 265.0)", color: "oklch(0.290 0.008 265.0)" }}
          />
          <button
            onClick={incluirObservacao}
            disabled={ocupado || !observacoes.trim()}
            className="text-sm px-3 py-1.5 rounded-md disabled:opacity-40"
            style={botaoSecundario}
          >
            Incluir no texto
          </button>
        </div>
        <p className="text-xs" style={muted}>
          Os números vêm do Monday e não mudam ao editar o texto. <span className="font-semibold">*texto*</span> sai em negrito no WhatsApp.
        </p>
      </div>

      {/* Entrega */}
      {texto.trim() && reportId && (
        <div className="rounded-xl p-5 space-y-4" style={card}>
          <span className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
            Entregar para a clínica
          </span>

          {zapPronto ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold block" style={muted}>Grupo do WhatsApp da clínica</label>
              <div className="flex gap-2 flex-wrap items-center">
                <select
                  value={grupoId ?? ""}
                  onChange={e => setGroup.mutate({ clientId, groupId: e.target.value || null })}
                  disabled={grupos.isLoading || setGroup.isPending}
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "oklch(0.975 0.015 265.0)", border: "1px solid oklch(0.905 0.015 265.0)" }}
                >
                  <option value="">{grupos.isLoading ? "Carregando grupos..." : "Escolha o grupo"}</option>
                  {grupoId && !grupoNome && <option value={grupoId}>{grupoId}</option>}
                  {(grupos.data ?? []).map(g => (
                    <option key={g.id} value={g.id}>{g.name || g.id}</option>
                  ))}
                </select>
                <button
                  onClick={() => setConfirmarEnvio(true)}
                  disabled={!grupoId || ocupado}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md font-semibold disabled:opacity-40"
                  style={verdeWhats}
                >
                  <Send size={13} /> Enviar no grupo
                </button>
              </div>
            </div>
          ) : (
            zap.data && (
              <p className="text-xs" style={muted}>
                {zap.data.configurado
                  ? "O WhatsApp de envio automático está desconectado. Use \"Abrir no WhatsApp\" ou peça à gestora para reconectar."
                  : "Envio automático no grupo não configurado. Use \"Abrir no WhatsApp\"."}
              </p>
            )
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={abrirNoWhatsApp}
              disabled={ocupado}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium disabled:opacity-40"
              style={zapPronto ? botaoSecundario : verdeWhats}
            >
              <MessageCircle size={13} /> Abrir no WhatsApp
            </button>
            <button onClick={() => copiar(mensagem, "mensagem")} className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md" style={botaoSecundario}>
              {copiado === "mensagem" ? <Check size={12} style={{ color: "#16a34a" }} /> : <Copy size={12} />} Copiar mensagem
            </button>
            {portalUrl && (
              <button onClick={() => copiar(portalUrl, "link")} className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md" style={botaoSecundario}>
                {copiado === "link" ? <Check size={12} style={{ color: "#16a34a" }} /> : <LinkIcon size={12} />} Copiar link do portal
              </button>
            )}
            <button
              onClick={alternarPublicacao}
              disabled={ocupado}
              className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md disabled:opacity-40"
              style={botaoSecundario}
            >
              {status === "published" ? <EyeOff size={12} /> : <Eye size={12} />}
              {status === "published" ? "Despublicar" : "Só publicar no portal"}
            </button>
          </div>
          <p className="text-xs" style={muted}>
            Enviar ou abrir no WhatsApp também publica o relatório, para o link do portal já mostrar este período.
          </p>
        </div>
      )}

      <Dialog open={confirmarEnvio} onOpenChange={o => !o && setConfirmarEnvio(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar no grupo {grupoNome ? `"${grupoNome}"` : "da clínica"}?</DialogTitle>
          </DialogHeader>
          <pre className="text-sm whitespace-pre-wrap rounded-lg px-3 py-2 max-h-80 overflow-y-auto bg-muted/40 border border-border font-sans">
            {mensagem}
          </pre>
          <DialogFooter>
            <button onClick={() => setConfirmarEnvio(false)} className="text-sm px-3 py-1.5 rounded-md" style={botaoSecundario}>
              Cancelar
            </button>
            <button
              onClick={() => reportId && send.mutate({ reportId, content: texto, origin })}
              disabled={send.isPending}
              className="text-sm px-3 py-1.5 rounded-md font-semibold disabled:opacity-50"
              style={verdeWhats}
            >
              {send.isPending ? "Enviando..." : "Enviar agora"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
