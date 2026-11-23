/**
 * Todos os quadros do Monday que o token da agência enxerga, com o cliente
 * do painel ligado a cada um. Para copiar o Board ID e achar quadro solto.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

const C = {
  card: "oklch(0.16 0.012 255)", borda: "oklch(0.24 0.012 255)",
  campo: "oklch(0.13 0.012 255)", texto: "#fff",
  suave: "oklch(0.70 0.010 240)", fraco: "oklch(0.50 0.010 240)",
  marca: "#e63946", aviso: "#eda100",
};

async function copiar(texto: string, aviso: string) {
  try { await navigator.clipboard.writeText(texto); toast.success(aviso); }
  catch { toast.error("Não consegui copiar. Selecione e copie manualmente."); }
}

export function QuadrosMonday({ managerToken }: { managerToken: string }) {
  const [aberto, setAberto] = useState(false);
  const q = trpc.managers.quadrosDoTokenMonday.useQuery(
    { token: managerToken },
    { enabled: !!managerToken && aberto, staleTime: 5 * 60_000, refetchOnWindowFocus: false },
  );
  const quadros = q.data?.quadros ?? [];
  const semCliente = quadros.filter((b) => !b.cliente).length;
  const lista = () => quadros.map((b) => `${b.nome}\t${b.id}\t${b.workspace ?? ""}\t${b.itens ?? ""}\t${b.cliente ?? ""}`).join("\n");

  return (
    <section className="rounded-xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h2 className="text-sm font-semibold" style={{ color: C.texto }}>Quadros do Monday do token da agência</h2>
        </div>
        <div className="flex items-center gap-2">
          {aberto && quadros.length > 0 && (
            <>
              <button onClick={() => copiar(quadros.map((b) => b.id).join("\n"), `${quadros.length} IDs copiados.`)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                style={{ background: C.campo, color: C.suave, border: `1px solid ${C.borda}` }}>
                <Copy className="w-3 h-3" /> Copiar só os IDs
              </button>
              <button onClick={() => copiar(`Quadro\tBoard ID\tWorkspace\tItens\tCliente\n${lista()}`, "Lista copiada. Cole numa planilha.")}
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
              Listar quadros
            </button>
          )}
        </div>
      </div>
      <p className="text-xs mt-1" style={{ color: C.fraco }}>
        Todos os quadros ativos que o token do Monday enxerga, com o cliente do painel ligado a cada um.
      </p>

      {aberto && q.isLoading && <p className="text-xs mt-3" style={{ color: C.suave }}>Consultando o Monday…</p>}
      {aberto && q.error && <p className="text-xs mt-3" style={{ color: C.marca }}>{q.error.message}</p>}
      {aberto && q.data && !q.data.configurado && (
        <p className="text-xs mt-3" style={{ color: C.aviso }}>Salve o token do Monday em Configurações para listar os quadros.</p>
      )}
      {aberto && q.data?.configurado && (
        <>
          <p className="text-xs mt-3" style={{ color: C.suave }}>
            <b style={{ color: C.texto }}>{quadros.length}</b> quadros visíveis
            {semCliente > 0 && <> · <b style={{ color: C.aviso }}>{semCliente}</b> sem cliente no painel</>}
          </p>
          <div className="overflow-x-auto mt-2 rounded-lg" style={{ border: `1px solid ${C.borda}` }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase" style={{ color: C.fraco, letterSpacing: ".12em", background: C.campo }}>
                  <th className="text-left px-3 py-2 font-semibold">Quadro</th>
                  <th className="text-left px-3 py-2 font-semibold">Board ID</th>
                  <th className="text-left px-3 py-2 font-semibold">Workspace</th>
                  <th className="text-right px-3 py-2 font-semibold">Itens</th>
                  <th className="text-left px-3 py-2 font-semibold">Cliente no painel</th>
                </tr>
              </thead>
              <tbody>
                {quadros.map((b) => (
                  <tr key={b.id} className="border-t" style={{ borderColor: C.borda }}>
                    <td className="px-3 py-1.5 font-medium" style={{ color: C.texto }}>{b.nome}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <button onClick={() => copiar(b.id, "Board ID copiado.")} title="Copiar Board ID"
                        className="font-mono inline-flex items-center gap-1.5 hover:opacity-80" style={{ color: C.suave }}>
                        {b.id} <Copy className="w-3 h-3" style={{ color: C.fraco }} />
                      </button>
                    </td>
                    <td className="px-3 py-1.5" style={{ color: C.suave }}>{b.workspace ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: C.suave }}>{b.itens ?? "—"}</td>
                    <td className="px-3 py-1.5" style={{ color: b.cliente ? C.suave : C.aviso }}>{b.cliente ?? "nenhum"}</td>
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
