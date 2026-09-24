/**
 * O que o `account_status` de uma conta de anúncio significa, e quais
 * valores pedem aviso. Cartão recusado aparece como UNSETTLED (3): a Meta
 * pausa as campanhas até a fatura ser paga. Puro, para teste.
 */

export type GravidadeConta = "ok" | "aviso" | "critico";

export type StatusConta = {
  codigo: number;
  rotulo: string;
  /** Explicação curta para a gestora, já com o que fazer. */
  detalhe: string;
  gravidade: GravidadeConta;
};

const STATUS: Record<number, Omit<StatusConta, "codigo">> = {
  1:   { rotulo: "Ativa", detalhe: "", gravidade: "ok" },
  2:   { rotulo: "Desativada", detalhe: "A Meta desativou a conta — ver o motivo no Gerenciador de Anúncios.", gravidade: "critico" },
  3:   { rotulo: "Pagamento pendente", detalhe: "Cartão recusado ou fatura em aberto — as campanhas ficam paradas até regularizar o pagamento.", gravidade: "critico" },
  7:   { rotulo: "Em análise de risco", detalhe: "A Meta está revisando a conta; pode exigir confirmação de identidade ou de pagamento.", gravidade: "aviso" },
  8:   { rotulo: "Aguardando acerto", detalhe: "Há um pagamento em processamento; se demorar, confira o cartão.", gravidade: "aviso" },
  9:   { rotulo: "Período de carência", detalhe: "Pagamento falhou e a conta está no prazo de tolerância — regularize antes que pause.", gravidade: "critico" },
  100: { rotulo: "Encerramento pendente", detalhe: "A conta está sendo fechada.", gravidade: "aviso" },
  101: { rotulo: "Fechada", detalhe: "Conta fechada — nenhum anúncio roda nela.", gravidade: "critico" },
};

const MOTIVO_DESATIVACAO: Record<number, string> = {
  1: "política de integridade de anúncios",
  2: "revisão de propriedade intelectual",
  3: "risco de pagamento",
  4: "conta cinza encerrada",
  5: "revisão antifraude",
  6: "integridade do negócio",
  7: "encerramento permanente",
  8: "conta de revendedor sem uso",
  9: "conta sem uso",
};

export function descreverStatus(codigo: number | null | undefined, disableReason?: number | null): StatusConta {
  const c = Number(codigo ?? 1);
  const base = STATUS[c] ?? { rotulo: `Status ${c}`, detalhe: "Status não reconhecido — confira no Gerenciador de Anúncios.", gravidade: "aviso" as const };
  const motivo = c === 2 && disableReason != null && MOTIVO_DESATIVACAO[disableReason]
    ? ` Motivo: ${MOTIVO_DESATIVACAO[disableReason]}.` : "";
  return { codigo: c, ...base, detalhe: base.detalhe + motivo };
}

export type ContaComProblema = { nome: string; status: StatusConta };

/** Mensagem do Telegram para contas com problema. Null quando não há nenhuma. */
export function montarAlertaContas(itens: ContaComProblema[]): string | null {
  const problemas = itens.filter((i) => i.status.gravidade !== "ok");
  if (!problemas.length) return null;
  const linhas = problemas
    .sort((a, b) => (a.status.gravidade === "critico" ? 0 : 1) - (b.status.gravidade === "critico" ? 0 : 1))
    .map((i) => `${i.status.gravidade === "critico" ? "💳" : "⚠️"} *${i.nome.trim()}* — ${i.status.rotulo}\n${i.status.detalhe}`)
    .join("\n\n");
  return `🚨 *Problema na conta de anúncio*\n\n${linhas}`;
}
