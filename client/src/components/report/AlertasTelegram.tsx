/**
 * Alertas de conta (saldo baixo, cartão recusado), na tela de Configurações.
 *
 * O servidor confere a cada duas horas e avisa no WhatsApp da gestora, pelo
 * Z-API, e no Telegram quando ele estiver configurado. Este card guarda o
 * número, manda mensagem de teste e roda a conferência na hora — sem
 * esperar as duas horas para saber se está funcionando.
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
  const [contas, setContas] = useState<Array<{ name: string; status: { rotulo: string; detalhe: string; gravidade: "ok" | "aviso" | "critico" } | null; erro?: string }> | null>(null);

  const [numero, setNumero] = useState("");
  const [editando, setEditando] = useState(false);
  const salvarNumero = trpc.managers.salvarWhatsappAlerta.useMutation({
    onSuccess: (r) => { toast.success(r.numero ? `Avisos vão para ${r.numeroFormatado}.` : "Número removido."); setNumero(""); setEditando(false); status.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [escolhendoGrupo, setEscolhendoGrupo] = useState(false);
  const [buscaGrupo, setBuscaGrupo] = useState("");
  const grupos = trpc.whatsapp.listGroupsAsManager.useQuery({ managerToken }, { enabled: escolhendoGrupo && !!managerToken, staleTime: 60_000 });
  const salvarGrupo = trpc.managers.salvarGrupoAlerta.useMutation({
    onSuccess: () => { toast.success("Avisos vão para o grupo."); setEscolhendoGrupo(false); setEditando(false); status.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const gruposFiltrados = (grupos.data ?? []).filter((g) => g.name.toLowerCase().includes(buscaGrupo.toLowerCase()));
  const testarZap = trpc.managers.testarWhatsappAlerta.useMutation({
    onSuccess: () => toast.success("Mensagem de teste enviada — confere no seu WhatsApp."),
    onError: (e) => toast.error(e.message),
  });
  const testar = trpc.managers.testarTelegram.useMutation({
    onSuccess: () => toast.success("Mensagem de teste enviada — confere no Telegram."),
    onError: (e) => toast.error(e.message),
  });
  const conferir = trpc.managers.conferirSaldos.useMutation({
    onSuccess: (r) => {
      setResultado(r.results); setContas(r.contas);
      const n = r.alerts + r.alertasConta;
      toast.success(n > 0 ? `${n} alerta(s) enviado(s).` : "Tudo certo: nenhum saldo baixo nem problema de conta.");
    },
    onError: (e) => toast.error(e.message),
  });

  const d = status.data;
  const cor = !d ? C.fraco : d.configurado ? C.ok : C.marca;

  return (
    <section className="rounded-xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">🔔</span>
          <h2 className="text-sm font-semibold" style={{ color: C.texto }}>Alertas de conta (WhatsApp e Telegram)</h2>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cor, background: `color-mix(in oklch, ${cor} 15%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 40%, transparent)` }}>
          {!d ? "…" : d.configurado ? "configurado" : "pendente"}
        </span>
      </div>

      {/* WhatsApp: canal principal. O número fica no banco, salvo aqui. */}
      {d && (
        <div className="mt-3 rounded-lg px-3 py-2.5" style={{ background: "oklch(0.14 0.012 255)", border: `1px solid ${C.borda}` }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-semibold m-0" style={{ color: C.texto }}>
              💬 Seu WhatsApp
              {d.whatsapp.numero && !editando && (
                <span className="ml-2 font-normal" style={{ color: C.suave }}>
                  {d.whatsapp.grupo ? <>grupo <b style={{ color: C.texto }}>{d.whatsapp.numeroFormatado}</b></> : <span className="font-mono">{d.whatsapp.numeroFormatado}</span>}
                </span>
              )}
            </p>
            {d.whatsapp.numero && !editando && (
              <div className="flex gap-2">
                <button onClick={() => testarZap.mutate({ token: managerToken })} disabled={!d.whatsapp.zapConfigurado || testarZap.isPending}
                  className="text-xs font-semibold px-3 py-1 rounded-md disabled:opacity-40"
                  style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.80 0.15 240)", border: "1px solid oklch(0.60 0.18 240 / 0.35)" }}>
                  {testarZap.isPending ? "Enviando..." : "Testar no WhatsApp"}
                </button>
                <button onClick={() => { setEditando(true); setNumero(""); }} className="text-xs px-2 py-1 rounded-md" style={{ color: C.fraco, border: `1px solid ${C.borda}` }}>Trocar</button>
                <button onClick={() => salvarNumero.mutate({ token: managerToken, numero: "" })} className="text-xs px-2 py-1 rounded-md" style={{ color: C.marca, border: `1px solid ${C.borda}` }}>Remover</button>
              </div>
            )}
          </div>
          {(!d.whatsapp.numero || editando) && !escolhendoGrupo && (
            <div className="flex gap-2 mt-2 flex-wrap">
              <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="DDD + número, ex.: (41) 99999-8888" inputMode="tel"
                className="flex-1 min-w-[220px] px-3 py-1.5 rounded-md text-sm outline-none"
                style={{ background: "oklch(0.12 0.012 255)", border: `1px solid ${C.borda}`, color: C.texto }} />
              <button onClick={() => salvarNumero.mutate({ token: managerToken, numero })} disabled={numero.replace(/\D/g, "").length < 10 || salvarNumero.isPending}
                className="text-xs font-semibold px-3 py-1.5 rounded-md text-white disabled:opacity-40" style={{ background: C.marca }}>
                {salvarNumero.isPending ? "Salvando..." : "Salvar número"}
              </button>
              <button onClick={() => { setEscolhendoGrupo(true); setBuscaGrupo(""); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-md" style={{ color: C.suave, border: `1px solid ${C.borda}` }}>
                Ou escolher um grupo
              </button>
              {editando && <button onClick={() => setEditando(false)} className="text-xs px-2" style={{ color: C.fraco }}>cancelar</button>}
            </div>
          )}
          {escolhendoGrupo && (
            <div className="mt-2">
              <p className="text-[11px] m-0 mb-1.5" style={{ color: C.suave }}>
                Dica: crie um grupo no WhatsApp só com você (ex.: "Avisos do dashboard") e escolha ele aqui. As mensagens chegam como não lidas, separadas da sua conversa.
              </p>
              <div className="flex gap-2 flex-wrap">
                <input value={buscaGrupo} onChange={(e) => setBuscaGrupo(e.target.value)} placeholder="Buscar grupo pelo nome"
                  className="flex-1 min-w-[220px] px-3 py-1.5 rounded-md text-sm outline-none"
                  style={{ background: "oklch(0.12 0.012 255)", border: `1px solid ${C.borda}`, color: C.texto }} />
                <button onClick={() => grupos.refetch()} className="text-xs px-2 py-1 rounded-md" style={{ color: C.fraco, border: `1px solid ${C.borda}` }}>atualizar</button>
                <button onClick={() => setEscolhendoGrupo(false)} className="text-xs px-2" style={{ color: C.fraco }}>cancelar</button>
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md" style={{ border: `1px solid ${C.borda}` }}>
                {grupos.isLoading ? (
                  <p className="text-xs px-3 py-2 m-0" style={{ color: C.fraco }}>Buscando grupos no Z-API…</p>
                ) : gruposFiltrados.length === 0 ? (
                  <p className="text-xs px-3 py-2 m-0" style={{ color: C.fraco }}>Nenhum grupo encontrado. Se acabou de criar, espere um minuto e clique em atualizar.</p>
                ) : gruposFiltrados.map((g) => (
                  <button key={g.id} onClick={() => salvarGrupo.mutate({ token: managerToken, grupoId: g.id, nome: g.name })} disabled={salvarGrupo.isPending}
                    className="w-full text-left text-xs px-3 py-2 border-t hover:bg-white/5 disabled:opacity-50" style={{ borderColor: C.borda, color: C.texto }}>
                    {g.name} <span className="font-mono" style={{ color: C.fraco }}>· {g.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11px] mt-1.5 m-0" style={{ color: d.whatsapp.zapConfigurado ? C.fraco : C.aviso }}>
            {d.whatsapp.zapConfigurado
              ? "Os avisos saem pelo mesmo WhatsApp da agência que manda os relatórios (Z-API)."
              : "O Z-API ainda não está configurado no Railway — sem ele o aviso não sai. Veja o cartão do WhatsApp acima."}
          </p>
        </div>
      )}

      {/* Telegram: opcional. Fica ativo enquanto as variáveis existirem no Railway. */}
      {d && (
        <p className="text-[11px] mt-2 m-0" style={{ color: C.fraco }}>
          Telegram: {d.telegramAtivo
            ? <>ativo, também recebe os avisos. Para desligar, apague <code>TELEGRAM_BOT_TOKEN</code> e <code>TELEGRAM_CHAT_ID</code> no Railway.</>
            : <>desligado (opcional). Faltam {d.faltando.map((v) => <code key={v} className="mx-0.5 px-1 rounded" style={{ background: "oklch(0.22 0.012 255)" }}>{v}</code>)} no Railway.</>}
        </p>
      )}
      {d && d.configurado && (
        <p className="text-xs mt-2 leading-relaxed" style={{ color: C.suave }}>
          A cada 2 horas o sistema confere <b style={{ color: C.texto }}>todas</b> as contas de anúncio e avisa se alguma está com
          <b style={{ color: C.texto }}> cartão recusado / pagamento pendente</b>, desativada ou em carência (repete 1× por dia enquanto durar).
          Nas contas <b style={{ color: C.texto }}>marcadas como pré-pagas</b> ({d.prePagos} {d.prePagos === 1 ? "cliente" : "clientes"}) também avisa
          saldo abaixo de {brl(d.limiteBaixo)}; abaixo de {brl(d.limiteCritico)} é crítico.
        </p>
      )}

      <div className="flex gap-2 mt-3 flex-wrap">
        {d?.telegramAtivo && (
          <button onClick={() => testar.mutate({ token: managerToken })} disabled={testar.isPending}
            className="text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
            style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.80 0.15 240)", border: "1px solid oklch(0.60 0.18 240 / 0.35)" }}>
            {testar.isPending ? "Enviando..." : "Testar no Telegram"}
          </button>
        )}
        <button onClick={() => conferir.mutate({ token: managerToken })} disabled={!d?.configurado || conferir.isPending}
          className="text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
          style={{ background: `color-mix(in oklch, ${C.marca} 15%, transparent)`, color: "#ff8a94", border: `1px solid color-mix(in oklch, ${C.marca} 40%, transparent)` }}>
          {conferir.isPending ? "Conferindo..." : "Conferir contas agora"}
        </button>
      </div>

      {contas && (
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.borda}` }}>
          <p className="text-[10px] uppercase font-semibold px-3 py-1.5 m-0" style={{ color: C.fraco, letterSpacing: ".14em", background: "oklch(0.14 0.012 255)" }}>Status das contas</p>
          {contas.length === 0 ? (
            <p className="text-xs px-3 py-2 m-0" style={{ color: C.fraco }}>Nenhum cliente com conta de anúncio configurada.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {contas.map((r) => {
                  const g = r.status?.gravidade;
                  const c = !r.status ? C.fraco : g === "critico" ? C.marca : g === "aviso" ? C.aviso : C.ok;
                  return (
                    <tr key={r.name} className="border-t" style={{ borderColor: C.borda }}>
                      <td className="px-3 py-1.5" style={{ color: C.texto }}>{r.name}</td>
                      <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap" style={{ color: c }}>{r.status?.rotulo ?? r.erro ?? "—"}</td>
                      <td className="px-3 py-1.5" style={{ color: C.fraco }}>{r.status?.detalhe}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {resultado && (
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.borda}` }}>
          <p className="text-[10px] uppercase font-semibold px-3 py-1.5 m-0" style={{ color: C.fraco, letterSpacing: ".14em", background: "oklch(0.14 0.012 255)" }}>Saldo das contas pré-pagas</p>
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
