/**
 * Diário de decisões: o registro que o playbook pede em cada análise —
 * sinal encontrado → hipótese → ação → prazo → resultado.
 *
 * A parte pura fica aqui para a tela e o servidor concordarem sobre o que
 * é "pendente", "vencida" e "concluída" sem consultar o banco.
 */

export type DecisaoBase = {
  prazo: string | null;        // YYYY-MM-DD
  concluidaEm: Date | string | null;
};

export type StatusDecisao = "pendente" | "vencida" | "concluida";

export const ROTULO_STATUS_DECISAO: Record<StatusDecisao, string> = {
  pendente: "Em andamento",
  vencida: "Prazo vencido",
  concluida: "Concluída",
};

export function isoHoje(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

export function statusDecisao(d: DecisaoBase, hoje = new Date()): StatusDecisao {
  if (d.concluidaEm) return "concluida";
  if (d.prazo && d.prazo < isoHoje(hoje)) return "vencida";
  return "pendente";
}

export type ResumoDecisoes = Record<StatusDecisao, number>;

export function resumoDecisoes(lista: DecisaoBase[], hoje = new Date()): ResumoDecisoes {
  const r: ResumoDecisoes = { pendente: 0, vencida: 0, concluida: 0 };
  for (const d of lista) r[statusDecisao(d, hoje)]++;
  return r;
}

/** Dias até o prazo (negativo quando já passou). Null sem prazo. */
export function diasParaPrazo(prazo: string | null, hoje = new Date()): number | null {
  if (!prazo) return null;
  const [y, m, d] = prazo.split("-").map(Number);
  const alvo = new Date(y, m - 1, d);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}

export function formatarPrazo(prazo: string | null, hoje = new Date()): string {
  const dias = diasParaPrazo(prazo, hoje);
  if (dias == null) return "sem prazo";
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return "venceu ontem";
  return `venceu há ${-dias} dias`;
}

/**
 * Ordem de leitura: vencidas primeiro, depois pendentes por prazo mais
 * próximo, concluídas por último (mais recentes antes).
 */
export function ordenarDecisoes<T extends DecisaoBase & { createdAt: Date | string }>(lista: T[], hoje = new Date()): T[] {
  const peso: Record<StatusDecisao, number> = { vencida: 0, pendente: 1, concluida: 2 };
  return [...lista].sort((a, b) => {
    const sa = statusDecisao(a, hoje), sb = statusDecisao(b, hoje);
    if (peso[sa] !== peso[sb]) return peso[sa] - peso[sb];
    if (sa === "concluida") return new Date(b.concluidaEm!).getTime() - new Date(a.concluidaEm!).getTime();
    const pa = a.prazo ?? "9999-99-99", pb = b.prazo ?? "9999-99-99";
    if (pa !== pb) return pa < pb ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
