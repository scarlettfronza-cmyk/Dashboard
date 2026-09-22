/**
 * Prévia e envio do relatório pelo WhatsApp do cliente.
 *
 * Antes o botão disparava a mensagem direto, sem mostrar o que ia sair.
 * Agora abre esta janela: o texto vem pronto do servidor (a mesma função
 * que vai montar a mensagem de verdade), a gestora ajusta se quiser e só
 * então envia. O link vai fixo abaixo do texto e já carrega o período.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatarPeriodo } from "@shared/whatsappRelatorio";

type Props = {
  open: boolean;
  onClose: () => void;
  managerToken: string;
  clientId: number;
  clientName: string;
  from: string;
  to: string;
  onConfigurarGrupo: () => void;
};

export function EnviarWhatsApp({ open, onClose, managerToken, clientId, clientName, from, to, onConfigurarGrupo }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [texto, setTexto] = useState("");
  const [formato, setFormato] = useState<"pdf" | "link">("pdf");

  const previa = trpc.whatsapp.previewReportAsManager.useQuery(
    { managerToken, clientId, from, to, origin },
    { enabled: open && !!managerToken && !!origin },
  );

  // Cada abertura começa do texto padrão para o período atual.
  useEffect(() => {
    if (open && previa.data) {
      setTexto(previa.data.corpo);
      setFormato(previa.data.pdfDisponivel ? "pdf" : "link");
    }
  }, [open, previa.data]);

  const enviar = trpc.whatsapp.sendReportAsManager.useMutation({
    onSuccess: (r) => { toast.success(r.formato === "pdf" ? "PDF enviado no grupo do WhatsApp!" : "Link enviado no grupo do WhatsApp!"); onClose(); },
    onError: (e) => toast.error(e.message || "Não foi possível enviar"),
  });

  const semGrupo = previa.data && !previa.data.grupoConfigurado;
  const semLink = previa.data && !previa.data.link;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar relatório no WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 text-sm">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{clientName}</span> · {formatarPeriodo(from, to)}
          </p>

          {previa.isLoading && <p className="text-xs text-muted-foreground animate-pulse">Montando a mensagem...</p>}
          {previa.error && <p className="text-xs" style={{ color: "#ff8a94" }}>{previa.error.message}</p>}

          {semGrupo && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(230,57,70,0.10)", border: "1px solid rgba(230,57,70,0.35)", color: "#ff8a94" }}>
              Este cliente ainda não tem grupo de WhatsApp escolhido.{" "}
              <button className="underline font-semibold" onClick={onConfigurarGrupo}>Escolher grupo</button>
            </div>
          )}
          {semLink && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(230,57,70,0.10)", border: "1px solid rgba(230,57,70,0.35)", color: "#ff8a94" }}>
              Este cliente não tem link público. Gere um nas configurações do cliente antes de enviar.
            </div>
          )}

          {previa.data && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {([["pdf", "📄 Documento PDF"], ["link", "🔗 Link"]] as const).map(([v, rotulo]) => {
                  const bloqueado = v === "pdf" && !previa.data!.pdfDisponivel;
                  const ativo = formato === v;
                  return (
                    <button key={v} type="button" disabled={bloqueado} onClick={() => setFormato(v)}
                      className="px-3 py-1.5 rounded-lg border font-semibold disabled:opacity-40"
                      style={{ borderColor: ativo ? "#25D366" : "var(--border)", background: ativo ? "rgba(37,211,102,0.12)" : "transparent", color: ativo ? "#25D366" : "inherit" }}>
                      {rotulo}
                    </button>
                  );
                })}
                {!previa.data.pdfDisponivel && (
                  <span className="self-center text-[11px] text-muted-foreground">PDF indisponível neste servidor — vai como link.</span>
                )}
              </div>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={8}
                maxLength={3500}
                className="w-full text-sm rounded-lg px-3 py-2 bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
              {formato === "link" && previa.data.link && (
                <p className="text-xs font-mono break-all rounded-lg px-3 py-2 bg-muted/30 border border-border text-muted-foreground">
                  🔗 {previa.data.link}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {formato === "pdf"
                  ? "O relatório vai como arquivo PDF anexo, e este texto como legenda. Gerar leva uns 10–20 segundos."
                  : "O link entra automaticamente no fim da mensagem."}{" "}
                <span className="font-semibold">*texto*</span> sai em negrito no WhatsApp.
              </p>
              {previa.data.pdfDisponivel && (
                <a className="text-[11px] underline text-muted-foreground hover:text-foreground"
                  href={`/api/relatorio/pdf?clientId=${clientId}&from=${from}&to=${to}&managerToken=${encodeURIComponent(managerToken)}`}
                  target="_blank" rel="noreferrer">
                  Baixar o PDF para conferir antes
                </a>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!previa.data || !!semGrupo || !!semLink || enviar.isPending}
            onClick={() => enviar.mutate({ managerToken, clientId, from, to, origin, reportText: texto, formato })}
            style={{ background: "#25D366", color: "#062b16" }}>
            {enviar.isPending ? (formato === "pdf" ? "Gerando PDF e enviando..." : "Enviando...") : "💬 Enviar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
