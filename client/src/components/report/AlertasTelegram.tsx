/**
 * Alertas de saldo baixo no Telegram, na tela de Configurações.
 *
 * O servidor confere a cada duas horas o saldo das contas marcadas como
 * pré-pagas e avisa no Telegram abaixo de R$ 200 (crítico abaixo de R$ 50).
 * Este card mostra se o bot está configurado, manda uma mensagem de teste
 * e roda a conferência na hora — sem esperar as duas horas para saber se
 * está funcionando.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const C = {
  card: "oklch(0.16 0.012 255)", borda: "oklch(0.24 0.012 255)",
  texto: "#fff", suave: "oklch(0.70 0.010 240)", fraco: "oklch(0.50 0.010 240)",
  marca: "#e63946", ok: "oklch(0.72 0.17 150)", aviso: "#eda100",
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export function AlertasTelegram({ managerToken }: { managerToken: string }) {
  const status = trpc.managers.statusTelegram.useQuery({ token: managerToken }, { enabled: !!managerToken });
  const [resultado, setResultado] = useState<Array<{ name: string; balance: number | null; status: string }> | null>(null);

  const testar = trpc.managers.testarTelegram.useMutation({
    onSuccess: () => toast.success("Mensagem de teste enviada — confere no Telegram."),
    onError: (e) => toast.error(e.message),
  });
  const conferir = trpc.managers.conferirSaldos.useMutation({
    onSuccess: (r) => { setResultado(r.results); toast.success(r.alerts > 0 ? `${r.alerts} alerta(s) enviado(s) no Telegram.` : "Saldos conferidos: nenhum abaixo do limite."); },
    onError: (e) => toast.error(e.message),
  });

  const d = status.data;
  const cor = !d ? C.fraco : d.configurado ? C.ok : C.marca;

  return (
    <section className="rounded-xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">🔔</span>
          <h2 className="text-sm font-semibold" style={{ color: C.texto }}>Alertas de saldo baixo (Telegram)</h2>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cor, background: `color-mix(in oklch, ${cor} 15%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 40%, transparent)` }}>
          {!d ? "…" : d.configurado ? "configurado" : "pendente"}
        </span>
      </div>

      {d && !d.configurado && (
        <p className="text-xs mt-2 leading-relaxed" style={{ color: C.suave }}>
          Faltam no Railway (Variables): {d.faltando.map((v) => <code key={v} className="mx-0.5 px-1 rounded" style={{ background: "oklch(0.22 0.012 255)" }}>{v}</code>)}.
          O passo a passo (criar o bot no BotFather e descobrir o chat id) está no <code>DEPLOY.md</code>, seção Telegram.
        </p>
      )}
      {d && d.configurado && (
        <p className="text-xs mt-2 leading-relaxed" style={{ color: C.suave }}>
          A cada 2 horas o sistema confere o saldo das contas <b style={{ color: C.texto }}>marcadas como pré-pagas</b> na tela de cada cliente
          ({d.prePagos} {d.prePagos === 1 ? "cliente marcado" : "clientes marcados"}) e avisa abaixo de {brl(d.limiteBaixo)}; abaixo de {brl(d.limiteCritico)} é crítico.
          {d.prePagos === 0 && <span style={{ color: C.aviso }}> Nenhum cliente marcado — sem isso, nada é conferido.</span>}
        </p>
      )}

      <div className="flex gap-2 mt-3 flex-wrap">
        <button onClick={() => testar.mutate({ token: managerToken })} disabled={!d?.configurado || testar.isPending}
          className="text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
          style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.80 0.15 240)", border: "1px solid oklch(0.60 0.18 240 / 0.35)" }}>
          {testar.isPending ? "Enviando..." : "Enviar mensagem de teste"}
        </button>
        <button onClick={() => conferir.mutate({ token: managerToken })} disabled={!d?.configurado || conferir.isPending}
          className="text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
          style={{ background: `color-mix(in oklch, ${C.marca} 15%, transparent)`, color: "#ff8a94", border: `1px solid color-mix(in oklch, ${C.marca} 40%, transparent)` }}>
          {conferir.isPending ? "Conferindo..." : "Conferir saldos agora"}
        </button>
      </div>

      {resultado && (
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.borda}` }}>
          {resultado.length === 0 ? (
            <p className="text-xs px-3 py-2 m-0" style={{ color: C.fraco }}>Nenhum cliente marcado como pré-pago.</p>
          ) : (
            <table className="w-full text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
              <tbody>
                {resultado.map((r) => {
                  const c = r.balance == null ? C.fraco : r.balance <= 50 ? C.marca : r.balance <= 200 ? C.aviso : C.ok;
                  return (
                    <tr key={r.name} className="border-t" style={{ borderColor: C.borda }}>
                      <td className="px-3 py-1.5" style={{ color: C.texto }}>{r.name}</td>
                      <td className="px-3 py-1.5 text-right font-semibold" style={{ color: c }}>{r.balance != null ? brl(r.balance) : "—"}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: C.fraco }}>{r.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
