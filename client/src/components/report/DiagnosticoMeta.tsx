/**
 * Diagnóstico da configuração do Meta, para o gestor.
 *
 * Antes o dashboard mostrava zero e ficava calado, e descobrir a causa exigia
 * abrir o Meta e conferir camada por camada. Aqui cada verificação aparece com
 * o que foi constatado e o que fazer a respeito.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Nivel = "ok" | "aviso" | "erro";
type Achado = { nivel: Nivel; titulo: string; detalhe: string };

const C = {
  card: "oklch(0.16 0.012 255)", borda: "oklch(0.24 0.012 255)",
  campo: "oklch(0.13 0.012 255)", texto: "#fff",
  suave: "oklch(0.70 0.010 240)", fraco: "oklch(0.50 0.010 240)",
};
// Verde, âmbar e vermelho vêm acompanhados de símbolo e texto: a cor sozinha
// não distingue os níveis para quem não a enxerga.
const NIVEL: Record<Nivel, { cor: string; simbolo: string; rotulo: string }> = {
  ok: { cor: "oklch(0.72 0.17 150)", simbolo: "✓", rotulo: "tudo certo" },
  aviso: { cor: "oklch(0.78 0.15 85)", simbolo: "!", rotulo: "atenção" },
  erro: { cor: "#e63946", simbolo: "×", rotulo: "problema" },
};

export function DiagnosticoMeta({ managerToken, clientId, from, to }: {
  managerToken: string; clientId: number; from?: string; to?: string;
}) {
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [resumo, setResumo] = useState<{ nivel: Nivel; texto: string } | null>(null);

  const rodar = trpc.managers.diagnosticarMeta.useMutation({
    onSuccess: (d) => { setAchados(d.achados as Achado[]); setResumo(d.resumo as typeof resumo); },
    onError: (e) => {
      setAchados([{ nivel: "erro", titulo: "Não foi possível diagnosticar", detalhe: e.message }]);
      setResumo({ nivel: "erro", texto: "Falha ao diagnosticar" });
    },
  });

  return (
    <div className="rounded-xl p-4 mt-3" style={{ background: C.campo, border: `1px solid ${C.borda}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-semibold m-0" style={{ color: C.texto }}>
            Diagnóstico da integração
          </p>
          <p className="text-[11px] mt-0.5 m-0" style={{ color: C.fraco }}>
            Verifica token, contas visíveis e dados do período.
          </p>
        </div>
        <button
          onClick={() => rodar.mutate({ token: managerToken, clientId, from, to })}
          disabled={rodar.isPending}
          className="text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-85"
          style={{ background: C.card, color: C.suave, border: `1px solid ${C.borda}`,
            cursor: rodar.isPending ? "wait" : "pointer" }}
        >
          {rodar.isPending ? "Verificando…" : "Diagnosticar"}
        </button>
      </div>

      {resumo && (
        <p className="text-[12.5px] font-semibold mt-3 mb-0 flex items-center gap-2"
           style={{ color: NIVEL[resumo.nivel].cor }}>
          <span aria-hidden="true">{NIVEL[resumo.nivel].simbolo}</span>
          {resumo.texto}
        </p>
      )}

      {achados && (
        <ol className="mt-3 mb-0 p-0 list-none flex flex-col gap-2.5">
          {achados.map((a, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden="true"
                className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                style={{ background: NIVEL[a.nivel].cor, color: "#000" }}>
                {NIVEL[a.nivel].simbolo}
              </span>
              <span>
                <span className="sr-only">{NIVEL[a.nivel].rotulo}: </span>
                <span className="text-[12.5px] font-semibold block" style={{ color: C.texto }}>{a.titulo}</span>
                <span className="text-[11.5px] block mt-0.5" style={{ color: C.fraco, lineHeight: 1.55 }}>
                  {a.detalhe}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
