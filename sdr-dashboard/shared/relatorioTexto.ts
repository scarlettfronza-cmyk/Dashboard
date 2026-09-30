/**
 * Texto do relatório do período, montado a partir das métricas calculadas no
 * servidor. Substitui a IA do Manus: os números entram direto, sem nenhum
 * modelo escrevendo por cima, e a SDR ajusta o texto antes de enviar.
 *
 * Fica em `shared/` para ser testável e para a tela e o servidor usarem a
 * mesma função. Regras de estilo (handoff, seção 16): português claro, sem
 * travessões, sem nome de paciente, só números agregados.
 */
import { formatBRL, formatRangeBR, type DateRange, type Metrics, type MetricsComparison } from "./metrics";

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function pct(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString("pt-BR")}%`;
}

/** "Maria, João e Ana" */
function lista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

const ROTULOS_COMPARATIVO: Record<string, string> = {
  leadsRecebidos: "leads",
  agendamentos: "agendamentos",
  comparecimentos: "comparecimentos",
  negociosFechados: "fechamentos",
  receitaTotal: "faturamento",
};

function frasesComparativo(comparison: MetricsComparison | undefined): string | null {
  if (!comparison) return null;
  const partes: string[] = [];
  for (const [chave, rotulo] of Object.entries(ROTULOS_COMPARATIVO)) {
    const delta = comparison[chave];
    if (!delta || delta.variacaoPct === null) continue;
    const v = Math.round(delta.variacaoPct);
    if (v === 0) partes.push(`${rotulo} estáveis`);
    else partes.push(`${rotulo} ${v > 0 ? "+" : ""}${v}%`);
  }
  if (partes.length === 0) return null;
  return `Em relação ao período anterior: ${lista(partes)}.`;
}

export interface DadosTextoRelatorio {
  clienteNome: string;
  range: DateRange | null;
  metrics: Metrics;
  comparison?: MetricsComparison;
  /** Contexto livre digitado pela SDR (feriado, campanha nova...). */
  observacoes?: string | null;
}

export function montarTextoRelatorio(d: DadosTextoRelatorio): string {
  const m = d.metrics;
  const periodo = d.range ? formatRangeBR(d.range) : "todo o período";
  const blocos: string[] = [];

  blocos.push(`*Relatório comercial · ${d.clienteNome.trim()}*\nPeríodo: ${periodo}`);

  const volume = [`📥 Leads recebidos: ${m.leadsRecebidos}`, `📅 Agendamentos: ${m.agendamentos}`];
  volume.push(
    m.agendamentos > 0
      ? `✅ Comparecimentos: ${m.comparecimentos} (${pct(m.taxaComparecimento)} dos agendados)`
      : `✅ Comparecimentos: ${m.comparecimentos}`,
  );
  volume.push(`🤝 Fechamentos: ${m.negociosFechados}`);
  if (m.receitaTotal > 0) {
    volume.push(`💰 Faturamento: ${formatBRL(m.receitaTotal)}`);
    if (m.negociosFechados > 1) volume.push(`🎯 Ticket médio: ${formatBRL(m.ticketMedio)}`);
  }
  blocos.push(volume.join("\n"));

  const canais = m.porCanal.filter(c => c.value > 0).slice(0, 3);
  if (canais.length > 0) {
    blocos.push(`A maior parte dos leads veio de ${lista(canais.map(c => `${c.name} (${c.value})`))}.`);
  }

  const procedimentos = m.porProcedimento.filter(p => p.value > 0).slice(0, 3);
  if (procedimentos.length > 0) {
    blocos.push(`Procedimentos mais procurados: ${lista(procedimentos.map(p => `${p.name} (${p.value})`))}.`);
  }

  const emAberto: string[] = [];
  if (m.emNegociacao > 0) emAberto.push(plural(m.emNegociacao, "lead em negociação", "leads em negociação"));
  if (m.aguardandoRetorno > 0) emAberto.push(plural(m.aguardandoRetorno, "aguardando retorno", "aguardando retorno"));
  if (emAberto.length > 0) blocos.push(`Seguimos acompanhando ${lista(emAberto)}.`);

  const comparativo = frasesComparativo(d.comparison);
  if (comparativo) blocos.push(comparativo);

  const obs = d.observacoes?.trim();
  if (obs) blocos.push(obs);

  blocos.push("Qualquer dúvida, estou à disposição por aqui.");
  return blocos.join("\n\n");
}
