/**
 * Token do Meta da agência, guardado uma vez e usado por todos os clientes.
 *
 * Antes o token ficava em cada cliente, o que obrigava a colar o mesmo valor
 * dezenove vezes e a repetir tudo a cada renovação. Como a agência usa um
 * único usuário do sistema no Meta, o token é um só. A conta de anúncio
 * continua por cliente: ela é o vínculo entre a clínica e a conta, não uma
 * credencial.
 *
 * O token nunca volta do servidor para a tela — só se existe e como termina,
 * o bastante para conferir qual está salvo.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const C = {
  card: "oklch(0.16 0.012 255)", borda: "oklch(0.24 0.012 255)",
  campo: "oklch(0.13 0.012 255)", texto: "#fff",
  suave: "oklch(0.70 0.010 240)", fraco: "oklch(0.50 0.010 240)",
  marca: "#e63946", ok: "oklch(0.72 0.17 150)",
};

export function TokenAgencia({ managerToken }: { managerToken: string }) {
  const [valor, setValor] = useState("");
  const [editando, setEditando] = useState(false);

  const estado = trpc.managers.getTokenAgencia.useQuery(
    { token: managerToken },
    { enabled: !!managerToken },
  );

  const salvar = trpc.managers.salvarTokenAgencia.useMutation({
    onSuccess: (d) => {
      toast.success(d.nome ? `Token salvo · ${d.nome}` : "Token salvo.");
      setValor(""); setEditando(false); estado.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const remover = trpc.managers.removerTokenAgencia.useMutation({
    onSuccess: () => { toast.success("Token removido."); estado.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const configurado = estado.data?.configurado ?? false;

  return (
    <section className="rounded-xl p-5 mb-5" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="text-[15px] font-semibold m-0" style={{ color: C.texto }}>
            Token do Meta da agência
          </h2>
          <p className="text-xs mt-1 m-0 max-w-[560px]" style={{ color: C.fraco, lineHeight: 1.6 }}>
            Um token para todas as clínicas. Ao renovar aqui, todas passam a usar o novo —
            não é preciso abrir cliente por cliente. A conta de anúncio continua sendo
            escolhida em cada um.
          </p>
        </div>
        {configurado && !editando && (
          <span className="text-[11px] font-semibold whitespace-nowrap px-2.5 py-1 rounded-full"
            style={{ color: C.ok, border: `1px solid ${C.borda}` }}>
            configurado
          </span>
        )}
      </div>

      {configurado && !editando ? (
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <code className="text-xs px-3 py-2 rounded-lg" style={{ background: C.campo, color: C.suave }}>
            ••••••••••••{estado.data?.final}
          </code>
          <button onClick={() => setEditando(true)}
            className="text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: C.campo, color: C.suave, border: `1px solid ${C.borda}` }}>
            Trocar token
          </button>
          <button onClick={() => remover.mutate({ token: managerToken })}
            disabled={remover.isPending}
            className="text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: "transparent", color: C.marca, border: `1px solid ${C.borda}` }}>
            Remover
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <input
            type="password" value={valor} autoComplete="off"
            onChange={(e) => setValor(e.target.value)}
            placeholder="Cole aqui o token do usuário do sistema"
            className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
            style={{ background: C.campo, border: `1px solid ${C.borda}`, color: C.texto }}
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => salvar.mutate({ token: managerToken, accessToken: valor.trim() })}
              disabled={valor.trim().length < 20 || salvar.isPending}
              className="text-xs font-semibold px-4 py-2 rounded-lg transition-opacity"
              style={{
                background: valor.trim().length < 20 || salvar.isPending ? C.campo : C.marca,
                color: valor.trim().length < 20 || salvar.isPending ? C.fraco : "#fff",
                cursor: valor.trim().length < 20 || salvar.isPending ? "not-allowed" : "pointer",
              }}>
              {salvar.isPending ? "Validando no Meta…" : "Salvar token"}
            </button>
            {editando && (
              <button onClick={() => { setEditando(false); setValor(""); }}
                className="text-xs px-3 py-2 rounded-lg" style={{ color: C.fraco }}>
                Cancelar
              </button>
            )}
          </div>
          <p className="text-[11px] mt-3 m-0" style={{ color: C.fraco, lineHeight: 1.6 }}>
            O token é validado no Meta antes de ser salvo, e guardado cifrado.
            Escopos necessários: <code>ads_read</code>, <code>business_management</code>,
            <code> instagram_basic</code>, <code>instagram_manage_insights</code>,
            <code> pages_show_list</code>, <code>pages_read_engagement</code>.
          </p>
        </div>
      )}
    </section>
  );
}
