/**
 * Todas as contas de anúncio que o token da agência enxerga, com o cliente
 * do painel ligado a cada uma. Serve para copiar IDs, achar conta sem
 * cliente e ver qual está com problema, sem abrir o Gerenciador de Negócios.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

const C = {
  card: "oklch(0.16 0.012 255)", borda: "oklch(0.24 0.012 255)",
  campo: "oklch(0.13 0.012 255)", texto: "#fff",
  suave: "oklch(0.70 0.010 240)", fraco: "oklch(0.50 0.010 240)",
  marca: "#e63946", ok: "oklch(0.72 0.17 150)", aviso: "#eda100",
};

async function copiar(texto: string, aviso: string) {
  try { await navigator.clipboard.writeText(texto); toast.success(aviso); }
  catch { toast.error("Não consegui copiar. Selecione e copie manualmente."); }
}

export function ContasAnuncio({ managerToken }: { managerToken: string }) {
  const [aberto, setAberto] = useState(false);
  const q = trpc.managers.contasDoTokenAgencia.useQuery(
    { token: managerToken },
    { enabled: !!managerToken && aberto, staleTime: 5 * 60_000, refetchOnWindowFocus: false },
  );
  const contas = q.data?.contas ?? [];
  const semCliente = contas.filter((c) => !c.cliente).length;
  const comProblema = contas.filter((c) => c.gravidade !== "ok").length;

  const corStatus = (g: "ok" | "aviso" | "critico") => g === "critico" ? C.marca : g === "aviso" ? C.aviso : C.ok;
  const lista = () => contas.map((c) => `${c.name}\t${c.id}\t${c.status}\t${c.cliente ?? ""}`).join("\n");

  return (
    <section className="rounded-xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">🧾</span>
          <h2 className="text-sm font-semibold" style={{ color: C.texto }}>Contas de anúncio do token da agência</h2>
        </div>
        <div className="flex items-center gap-2">
          {aberto && contas.length > 0 && (
            <>
              <button onClick={() => copiar(contas.map((c) => c.id).join("\n"), `${contas.length} IDs copiados.`)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                style={{ background: C.campo, color: C.suave, border: `1px solid ${C.borda}` }}>
                <Copy className="w-3 h-3" /> Copiar só os IDs
              </button>
              <button onClick={() => copiar(`Nome\tID\tStatus\tCliente\n${lista()}`, "Lista copiada. Cole numa planilha.")}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                style={{ background: C.campo, color: C.suave, border: `1px solid ${C.borda}` }}>
                <Copy className="w-3 h-3" /> Copiar lista completa
              </button>
              <button onClick={() => q.refetch()} disabled={q.isFetching} title="Consultar de novo"
                className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                style={{ background: C.campo, border: `1px solid ${C.borda}`, color: C.suave }}>
                <RefreshCw className={`w-3 h-3 ${q.isFetching ? "animate-spin" : ""}`} />
              </button>
            </>
          )}
          {!aberto && (
            <button onClick={() => setAberto(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: C.marca, color: "#fff" }}>
              Listar contas
            </button>
          )}
        </div>
      </div>
      <p className="text-xs mt-1" style={{ color: C.fraco }}>
        Tudo que o usuário do sistema da agência enxerga no Meta, com o cliente do painel ligado a cada conta.
      </p>

      {aberto && q.isLoading && <p className="text-xs mt-3" style={{ color: C.suave }}>Consultando o Meta…</p>}
      {aberto && q.error && <p className="text-xs mt-3" style={{ color: C.marca }}>{q.error.message}</p>}
      {aberto && q.data && !q.data.configurado && (
        <p className="text-xs mt-3" style={{ color: C.aviso }}>Salve o token da agência acima para listar as contas.</p>
      )}
      {aberto && q.data?.configurado && (
        <>
          <p className="text-xs mt-3" style={{ color: C.suave }}>
            <b style={{ color: C.texto }}>{contas.length}</b> contas visíveis
            {semCliente > 0 && <> · <b style={{ color: C.aviso }}>{semCliente}</b> sem cliente no painel</>}
            {comProblema > 0 && <> · <b style={{ color: C.marca }}>{comProblema}</b> com problema na Meta</>}
          </p>
          <div className="overflow-x-auto mt-2 rounded-lg" style={{ border: `1px solid ${C.borda}` }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase" style={{ color: C.fraco, letterSpacing: ".12em", background: C.campo }}>
                  <th className="text-left px-3 py-2 font-semibold">Conta</th>
                  <th className="text-left px-3 py-2 font-semibold">ID</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Cliente no painel</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: C.borda }}>
                    <td className="px-3 py-1.5 font-medium" style={{ color: C.texto }}>{c.name}<span style={{ color: C.fraco }}> · {c.currency}</span></td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <button onClick={() => copiar(c.id, "ID copiado.")} title="Copiar ID"
                        className="font-mono inline-flex items-center gap-1.5 hover:opacity-80" style={{ color: C.suave }}>
                        {c.id} <Copy className="w-3 h-3" style={{ color: C.fraco }} />
                      </button>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: corStatus(c.gravidade) }}>{c.status}</td>
                    <td className="px-3 py-1.5" style={{ color: c.cliente ? C.suave : C.aviso }}>{c.cliente ?? "nenhum"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
