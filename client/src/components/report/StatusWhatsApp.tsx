/**
 * Situação do WhatsApp (Z-API) da agência, na tela de Configurações.
 *
 * Dois problemas diferentes aparecem como "não envia": faltar variável no
 * servidor ou o celular estar despareado da instância. O card diz qual é e
 * o que fazer em cada caso, para não precisar adivinhar.
 */
import { trpc } from "@/lib/trpc";

const C = {
  card: "oklch(0.16 0.012 255)", borda: "oklch(0.24 0.012 255)",
  texto: "#fff", suave: "oklch(0.70 0.010 240)", fraco: "oklch(0.50 0.010 240)",
  marca: "#e63946", ok: "oklch(0.72 0.17 150)", zap: "#25D366",
};

export function StatusWhatsApp({ managerToken }: { managerToken: string }) {
  const status = trpc.whatsapp.statusAsManager.useQuery(
    { managerToken },
    { enabled: !!managerToken, refetchOnWindowFocus: true },
  );
  const d = status.data;

  let cor = C.fraco; let titulo = "Verificando..."; let detalhe: React.ReactNode = null;
  if (status.error) {
    cor = C.marca; titulo = "Não consegui verificar o WhatsApp"; detalhe = status.error.message;
  } else if (d && !d.configurado) {
    cor = C.marca; titulo = "WhatsApp não configurado";
    detalhe = (
      <>
        Faltam no Railway (Variables): {d.faltando.map((v) => <code key={v} className="mx-0.5 px-1 rounded" style={{ background: "oklch(0.22 0.012 255)" }}>{v}</code>)}.
        Os três valores estão no painel do Z-API, na sua instância. O passo a passo está no <code>DEPLOY.md</code>, seção WhatsApp.
      </>
    );
  } else if (d && !d.connected) {
    cor = "#eda100"; titulo = "Z-API configurado, mas o celular não está pareado";
    detalhe = <>Abra o painel do Z-API, entre na instância e escaneie o QR code com o WhatsApp da agência. {d.error ? <span style={{ color: C.fraco }}>({d.error})</span> : null}</>;
  } else if (d) {
    cor = C.ok; titulo = "WhatsApp conectado";
    detalhe = "Os relatórios saem pelo botão WhatsApp do painel, com prévia antes de enviar.";
  }

  return (
    <section className="rounded-xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <h2 className="text-sm font-semibold" style={{ color: C.texto }}>WhatsApp da agência (Z-API)</h2>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cor, background: `color-mix(in oklch, ${cor} 15%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 40%, transparent)` }}>
          {status.isLoading ? "…" : d?.connected ? "conectado" : d?.configurado ? "despareado" : "pendente"}
        </span>
      </div>
      <p className="text-sm mt-2 font-medium" style={{ color: cor }}>{titulo}</p>
      {detalhe && <p className="text-xs mt-1 leading-relaxed" style={{ color: C.suave }}>{detalhe}</p>}
    </section>
  );
}
