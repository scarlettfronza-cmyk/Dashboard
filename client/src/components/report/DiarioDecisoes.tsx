/**
 * Diário de decisões do cliente: sinal → hipótese → ação → prazo → resultado.
 *
 * É o registro que o playbook exige em cada análise. Fica na página do
 * cliente, logo abaixo dos números; a Carteira conta as vencidas e o
 * relatório do cliente mostra só a ação e o resultado das marcadas.
 */
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, RotateCcw, Trash2, PlusCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { statusDecisao, ordenarDecisoes, formatarPrazo, ROTULO_STATUS_DECISAO, type StatusDecisao } from "@shared/decisoes";

const COR: Record<StatusDecisao, string> = { vencida: "#E63946", pendente: "#eda100", concluida: "#34d399" };

const inputCls = "w-full px-3 py-2 rounded-lg text-sm outline-none bg-background border border-border text-foreground placeholder:text-muted-foreground/60";

export function DiarioDecisoes({ token, clientId }: { token: string; clientId: number }) {
  const utils = trpc.useUtils();
  const lista = trpc.managers.listarDecisoes.useQuery({ token, clientId }, { staleTime: 30_000 });
  const recarregar = () => { utils.managers.listarDecisoes.invalidate({ token, clientId }); };

  const [abrirForm, setAbrirForm] = useState(false);
  const [sinal, setSinal] = useState("");
  const [hipotese, setHipotese] = useState("");
  const [acao, setAcao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [noRelatorio, setNoRelatorio] = useState(true);
  const [concluindo, setConcluindo] = useState<number | null>(null);
  const [resultado, setResultado] = useState("");

  const criar = trpc.managers.criarDecisao.useMutation({
    onSuccess: () => { toast.success("Decisão registrada."); setSinal(""); setHipotese(""); setAcao(""); setPrazo(""); setAbrirForm(false); recarregar(); },
    onError: (e) => toast.error(e.message),
  });
  const concluir = trpc.managers.concluirDecisao.useMutation({
    onSuccess: () => { toast.success("Decisão concluída."); setConcluindo(null); setResultado(""); recarregar(); },
    onError: (e) => toast.error(e.message),
  });
  const reabrir = trpc.managers.reabrirDecisao.useMutation({ onSuccess: recarregar, onError: (e) => toast.error(e.message) });
  const alternar = trpc.managers.alternarDecisaoNoRelatorio.useMutation({ onSuccess: recarregar, onError: (e) => toast.error(e.message) });
  const excluir = trpc.managers.excluirDecisao.useMutation({ onSuccess: () => { toast.success("Decisão apagada."); recarregar(); }, onError: (e) => toast.error(e.message) });

  const itens = ordenarDecisoes(lista.data ?? []);
  const abertas = itens.filter((d) => statusDecisao(d) !== "concluida");
  const vencidas = abertas.filter((d) => statusDecisao(d) === "vencida").length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">Diário de decisões · sinal → hipótese → ação → prazo → resultado</p>
          <p className="text-[11px] text-muted-foreground">
            {abertas.length === 0 ? "Nenhuma ação em andamento. Toda análise termina com uma decisão registrada."
              : `${abertas.length} em andamento${vencidas > 0 ? `, ${vencidas} com prazo vencido` : ""}. O relatório do cliente mostra só a ação e o resultado das marcadas com o olho.`}
          </p>
        </div>
        <button onClick={() => setAbrirForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors flex-shrink-0"
          style={{ color: "#E63946" }}>
          <PlusCircle className="w-3.5 h-3.5" /> {abrirForm ? "Fechar" : "Registrar decisão"}
        </button>
      </div>

      {abrirForm && (
        <div className="border-t border-border px-4 py-3 grid gap-2 md:grid-cols-2">
          <label className="text-[11px] text-muted-foreground flex flex-col gap-1">
            Sinal encontrado
            <input className={inputCls} value={sinal} onChange={(e) => setSinal(e.target.value)} placeholder="Ex.: CPL do formulário subiu para R$ 31 na semana" />
          </label>
          <label className="text-[11px] text-muted-foreground flex flex-col gap-1">
            Hipótese
            <input className={inputCls} value={hipotese} onChange={(e) => setHipotese(e.target.value)} placeholder="Ex.: criativo cansou, frequência passou de 3" />
          </label>
          <label className="text-[11px] text-muted-foreground flex flex-col gap-1 md:col-span-2">
            Ação
            <input className={inputCls} value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="Ex.: subir 2 criativos novos em vídeo e pausar o anúncio antigo" />
          </label>
          <label className="text-[11px] text-muted-foreground flex flex-col gap-1">
            Prazo
            <input type="date" className={inputCls} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </label>
          <label className="text-[11px] text-muted-foreground flex items-center gap-2 self-end pb-2">
            <input type="checkbox" checked={noRelatorio} onChange={(e) => setNoRelatorio(e.target.checked)} />
            Mostrar a ação no relatório do cliente
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button disabled={!sinal.trim() || !acao.trim() || criar.isPending}
              onClick={() => criar.mutate({ token, clientId, sinal, hipotese: hipotese || undefined, acao, prazo: prazo || null, noRelatorio })}
              className="text-xs font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ background: "#E63946" }}>
              {criar.isPending ? "Salvando..." : "Salvar decisão"}
            </button>
          </div>
        </div>
      )}

      {lista.isLoading ? (
        <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border">Carregando...</p>
      ) : itens.length > 0 && (
        <div className="border-t border-border divide-y divide-border/60">
          {itens.map((d) => {
            const st = statusDecisao(d);
            return (
              <div key={d.id} className="px-4 py-2.5 flex gap-3 items-start">
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: COR[st] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm m-0 font-medium">{d.acao}</p>
                  <p className="text-[11px] text-muted-foreground m-0 mt-0.5">
                    <span className="font-semibold" style={{ color: COR[st] }}>{ROTULO_STATUS_DECISAO[st]}</span>
                    {st !== "concluida" && <> · {formatarPrazo(d.prazo ?? null)}</>}
                    {" · "}sinal: {d.sinal}{d.hipotese ? <> · hipótese: {d.hipotese}</> : null}
                  </p>
                  {d.resultado && <p className="text-[11px] m-0 mt-0.5" style={{ color: COR.concluida }}>resultado: {d.resultado}</p>}
                  {concluindo === d.id && (
                    <div className="flex gap-2 mt-2">
                      <input className={inputCls} autoFocus value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="Resultado (ex.: CPL voltou para R$ 18)" />
                      <button onClick={() => concluir.mutate({ token, clientId, id: d.id, resultado: resultado || undefined })} disabled={concluir.isPending}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white whitespace-nowrap" style={{ background: COR.concluida }}>Concluir</button>
                      <button onClick={() => { setConcluindo(null); setResultado(""); }} className="text-xs px-2 text-muted-foreground">cancelar</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {st !== "concluida" ? (
                    <button title="Concluir com resultado" onClick={() => setConcluindo(d.id)} className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground"><CheckCircle2 className="w-4 h-4" /></button>
                  ) : (
                    <button title="Reabrir" onClick={() => reabrir.mutate({ token, clientId, id: d.id })} className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground"><RotateCcw className="w-4 h-4" /></button>
                  )}
                  <button title={d.noRelatorio ? "Aparece no relatório do cliente — clique para esconder" : "Escondida do relatório — clique para mostrar"}
                    onClick={() => alternar.mutate({ token, clientId, id: d.id, noRelatorio: !d.noRelatorio })}
                    className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground">
                    {d.noRelatorio ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-50" />}
                  </button>
                  <button title="Apagar" onClick={() => { if (confirm("Apagar esta decisão?")) excluir.mutate({ token, clientId, id: d.id }); }}
                    className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
