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

  const previa = trpc.whatsapp.previewReportAsManager.useQuery(
    { managerToken, clientId, from, to, origin },
    { enabled: open && !!managerToken && !!origin },
  );

  // Cada abertura começa do texto padrão para o período atual.
  useEffect(() => {
    if (open && previa.data) setTexto(previa.data.corpo);
  }, [open, previa.data]);

  const enviar = trpc.whatsapp.sendReportAsManager.useMutation({
    onSuccess: () => { toast.success("Relatório enviado no grupo do WhatsApp!"); onClose(); },
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
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={8}
                maxLength={3500}
                className="w-full text-sm rounded-lg px-3 py-2 bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
              {previa.data.link && (
                <p className="text-xs font-mono break-all rounded-lg px-3 py-2 bg-muted/30 border border-border text-muted-foreground">
                  🔗 {previa.data.link}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                O link entra automaticamente no fim da mensagem. <span className="font-semibold">*texto*</span> sai em negrito no WhatsApp.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!previa.data || !!semGrupo || !!semLink || enviar.isPending}
            onClick={() => enviar.mutate({ managerToken, clientId, from, to, origin, reportText: texto })}
            style={{ background: "#25D366", color: "#062b16" }}>
            {enviar.isPending ? "Enviando..." : "💬 Enviar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
