/**
 * Extração de leads a partir do array `actions` do Meta Insights.
 *
 * O cálculo principal de KPIs contava lead apenas por
 * `onsite_conversion.messaging_conversation_started_7d`, ou seja, só conversa
 * iniciada no WhatsApp ou no Direct. Campanhas de formulário tinham somente
 * cliques contabilizados, então os leads delas não entravam em lugar nenhum:
 * o investimento aparecia no total e o retorno não.
 *
 * Aqui os dois caminhos são tratados, sem alterar os campos já existentes.
 */

export type MetaAction = { action_type: string; value: string };

/** Conversa iniciada no WhatsApp ou Direct. */
export const MSG_ACTION = "onsite_conversion.messaging_conversation_started_7d";

/**
 * Lead de formulário. `leadgen.other` cobre o formulário instantâneo do Meta e
 * `offsite_conversion.fb_pixel_lead` o formulário em site próprio, via pixel.
 */
export const FORM_ACTIONS = ["leadgen.other", "offsite_conversion.fb_pixel_lead"] as const;

/**
 * Tipo agregado do Meta, que já soma os específicos. Só é usado quando nenhum
 * específico veio, para não contar o mesmo lead duas vezes.
 */
export const FORM_FALLBACK_ACTION = "lead";

function num(v: string | undefined | null) {
  const n = parseFloat(v ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function valueOf(actions: MetaAction[] | undefined, type: string) {
  return num(actions?.find((a) => a.action_type === type)?.value);
}

/** Leads de formulário da campanha, sem dupla contagem com o tipo agregado. */
export function formLeadsFrom(actions: MetaAction[] | undefined): number {
  const especificos = FORM_ACTIONS.reduce((sum, t) => sum + valueOf(actions, t), 0);
  if (especificos > 0) return especificos;
  return valueOf(actions, FORM_FALLBACK_ACTION);
}

/** Conversas iniciadas da campanha. */
export function messageLeadsFrom(actions: MetaAction[] | undefined): number {
  return valueOf(actions, MSG_ACTION);
}

/**
 * Custo por lead que o Meta informa para um tipo de ação. Quando não vem,
 * devolve null: quem chama decide se divide investimento por leads.
 */
export function reportedCostPer(
  costPerAction: MetaAction[] | undefined,
  types: readonly string[],
): number | null {
  for (const t of types) {
    const v = costPerAction?.find((a) => a.action_type === t)?.value;
    if (v != null && num(v) > 0) return num(v);
  }
  return null;
}

/** Média ponderada de custo por lead, com queda para investimento ÷ leads. */
export function blendCostPerLead(
  somaPonderada: number,
  leadsComCusto: number,
  investimento: number,
  leadsTotais: number,
): number {
  if (leadsComCusto > 0) return somaPonderada / leadsComCusto;
  if (leadsTotais > 0) return investimento / leadsTotais;
  return 0;
}
