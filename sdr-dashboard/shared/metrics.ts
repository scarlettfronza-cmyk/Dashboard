/**
 * metrics.ts — fonte única de verdade para os números do dashboard.
 *
 * Antes deste módulo, as métricas eram calculadas em três lugares diferentes
 * (useMondayData.computeStats, Home.filteredStats e Overview.filteredStats),
 * com fórmulas divergentes. O mesmo KPI mostrava valores diferentes conforme
 * a tela e conforme haver ou não filtro ativo.
 *
 * Regras deste módulo:
 *  - funções puras, sem dependências, testáveis isoladamente;
 *  - todo cálculo de data usa o fuso America/Sao_Paulo explicitamente;
 *  - cada métrica é filtrada pela SUA data de referência (ver METRIC_DEFINITIONS).
 */

export const TIMEZONE = "America/Sao_Paulo";

// ─── Tipos de domínio ────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  name: string;
  group: string;
  sdr: string;
  canal: string;
  procedimento: string;
  dataConversao: string;
  dataConsulta: string;
  dataFechamento: string;
  dataProcedimento: string;
  compareceu: string;
  statusLead: string;
  valor: number | null;
  /** Valor da consulta paga. Ausente nas cópias do Monday anteriores a este campo. */
  valorConsulta?: number | null;
  obs: string;
  boardId: string;
  boardName: string;
  clientName: string;
}

export interface AtendimentoRecord {
  date: string;
  novosContatos: number;
  novosAds: number;
  conversasRealizadas: number;
  consultaAgendada: number;
  agendadoAds: number;
  procedimentoVendido: number;
  boardId: string;
  clientName: string;
  sdrName: string;
}

/** Intervalo fechado, em datas locais (America/Sao_Paulo), formato YYYY-MM-DD. */
export interface DateRange {
  from: string;
  to: string;
}

export interface Metrics {
  leadsRecebidos: number;
  agendamentos: number;
  comparecimentos: number;
  /**
   * Leads que marcaram consulta no período (data de conversão dentro dele)
   * para uma data depois do fim do período. É o "8 agendadas para setembro"
   * do relatório de agosto. Sem período, é zero.
   */
  agendadasParaDepois: number;
  /** Consultas do período com presença e valor de consulta preenchido. */
  consultasPagas: number;
  /** Soma do "Valor da Consulta" dessas consultas. */
  receitaConsultas: number;
  negociosFechados: number;
  negociosPerdidos: number;
  emNegociacao: number;
  aguardandoRetorno: number;
  taxaConversao: number;
  taxaComparecimento: number;
  receitaTotal: number;
  ticketMedio: number;
  porCanal: Distribution[];
  porProcedimento: Distribution[];
  porStatus: Distribution[];
  porMes: { mes: string; leads: number; fechados: number }[];
  porSdr: { name: string; leads: number; fechados: number; receita: number }[];
  porCliente: { name: string; leads: number; fechados: number; receita: number }[];
}

export interface Distribution {
  name: string;
  value: number;
  color: string;
}

// ─── Definição das métricas (documentação executável) ────────────────────────

/**
 * Cada métrica declara qual campo de data determina se um lead pertence ao
 * período. Isso resolve o erro conceitual anterior: filtrar TODOS os leads por
 * uma única data e depois contar tudo em cima do resultado — o que fazia, por
 * exemplo, um fechamento de agosto sumir do relatório de agosto quando a
 * conversão tinha acontecido em julho.
 *
 * Exporte isto na UI ou no METRICS.md para que SDR e cliente concordem sobre o
 * significado de cada número.
 */
export const METRIC_DEFINITIONS: Record<string, { label: string; dateField: keyof Lead | null; rule: string }> = {
  leadsRecebidos: {
    label: "Leads recebidos",
    dateField: "dataConversao",
    rule: "Lead cuja data de conversão/entrada cai no período.",
  },
  agendamentos: {
    label: "Agendamentos",
    dateField: "dataConsulta",
    rule: "Soma de Consulta Agendada no relatório diário quando ele existe no período; sem esse relatório, conta leads com data de consulta marcada.",
  },
  comparecimentos: {
    label: "Comparecimentos",
    dateField: "dataConsulta",
    rule: "Lead não vindo de Indicação, com consulta no período e coluna de comparecimento indicando presença.",
  },
  negociosFechados: {
    label: "Negócios fechados",
    dateField: "dataFechamento",
    rule: "Status 'Negócio fechado' com data de fechamento no período. Sem data de fechamento, usa a data de conversão.",
  },
  receitaTotal: {
    label: "Receita",
    dateField: "dataFechamento",
    rule: "Soma do valor APENAS dos negócios fechados no período. Leads em aberto não entram.",
  },
  taxaConversao: {
    label: "Taxa de conversão",
    dateField: null,
    rule:
      "negociosFechados ÷ leadsRecebidos do mesmo período. Atenção: numerador e denominador " +
      "são coortes diferentes — um lead que entrou em julho e fechou em agosto conta no " +
      "numerador de agosto sem contar no denominador, o que pode levar a taxas acima de 100% " +
      "em meses de ciclo longo. É esperado; para taxa por coorte seria preciso rastrear cada " +
      "lead até o desfecho.",
  },
  taxaComparecimento: {
    label: "Taxa de comparecimento",
    dateField: null,
    rule: "comparecimentos ÷ agendamentos do mesmo período.",
  },
};

// ─── Datas ───────────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;

/**
 * Data de "hoje" no fuso de São Paulo, em YYYY-MM-DD.
 *
 * O código anterior usava `new Date().toISOString().slice(0, 10)`, que devolve
 * a data em UTC. Para um usuário em UTC-3, a partir das 21h o atalho "Hoje"
 * passava a filtrar pelo dia seguinte e vinha vazio.
 */
export function todayInTz(now: Date = new Date(), timeZone: string = TIMEZONE): string {
  // 'en-CA' formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Soma dias a uma data YYYY-MM-DD sem passar por fuso horário. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Normaliza as datas que o Monday devolve para YYYY-MM-DD. Aceita dd/mm/yyyy e ISO. */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const br = value.match(BR_DATE);
  if (br) {
    const [, d, m, y] = br;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const head = value.slice(0, 10);
  return ISO_DATE.test(head) ? head : null;
}

export type Preset = "hoje" | "7d" | "30d" | "mes" | "3m";

/**
 * Converte um atalho em intervalo concreto.
 *
 * "mes" é o MÊS CORRENTE (do dia 1 até hoje) — não "os últimos 30 dias".
 * Os dois existiam no filtro antigo com rótulos ambíguos ("Mês" ia até o
 * último dia do mês, incluindo dias futuros, o que inflava nada mas confundia).
 */
export function resolvePreset(preset: Preset, now: Date = new Date()): DateRange {
  const today = todayInTz(now);
  switch (preset) {
    case "hoje":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "mes":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "3m":
      return { from: addDays(today, -89), to: today };
  }
}

/** Período imediatamente anterior, de mesma duração. Base do comparativo. */
export function previousRange(range: DateRange): DateRange {
  const days = daysBetween(range.from, range.to);
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

export function inRange(isoDate: string | null, range: DateRange | null): boolean {
  if (!range) return true;
  if (!isoDate) return false;
  return isoDate >= range.from && isoDate <= range.to;
}

/** Um lead conta para a métrica se a data de referência dela cai no período. */
function leadInRange(lead: Lead, field: keyof Lead, range: DateRange | null, fallback?: keyof Lead): boolean {
  if (!range) return true;
  const primary = parseDate(lead[field] as string);
  if (primary) return inRange(primary, range);
  if (fallback) return inRange(parseDate(lead[fallback] as string), range);
  return false;
}

/** Filtra leads pela data de referência do indicador, preservando a regra única de datas. */
export function filterLeadsByDate(
  leads: Lead[],
  field: keyof Lead,
  range: DateRange | null,
  fallback?: keyof Lead,
): Lead[] {
  return leads.filter(lead => leadInRange(lead, field, range, fallback));
}

/** Filtra os registros diários de atendimento pelo mesmo intervalo global. */
export function filterAtendimentosByRange(
  atendimentos: AtendimentoRecord[],
  range: DateRange | null,
): AtendimentoRecord[] {
  return atendimentos.filter(record => inRange(parseDate(record.date), range));
}

// ─── Normalização de rótulos ─────────────────────────────────────────────────

const PRESENTE = /^(sim|compareceu|presente|ok)/i;

export function compareceuIsPresente(value: string): boolean {
  return PRESENTE.test((value || "").trim());
}

/** Indicadores de presença comercial não incluem leads de indicação. */
export function isCanalIndicacao(canal: string): boolean {
  return /^(indicacao|indicacoes|indications?)$/i.test((canal || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
}

export const CANAL_COLORS: Record<string, string> = {
  "Whats/META": "#7c6af7",
  Indicações: "#22c55e",
  "Social Selling/DIRECT": "#f59e0b",
  Google: "#3b82f6",
  default: "#8b8fa8",
};

export const STATUS_COLORS: Record<string, string> = {
  "Em negociação": "#f59e0b",
  "Negócio fechado": "#22c55e",
  "Negócio perdido": "#ef4444",
  "Aguardando retorno": "#3b82f6",
  default: "#8b8fa8",
};

export const PROC_COLORS = [
  "#7c6af7", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#a855f7", "#06b6d4",
  "#84cc16", "#f43f5e", "#8b5cf6", "#0ea5e9",
];

function distribution(
  leads: Lead[],
  key: (l: Lead) => string,
  colors: Record<string, string> | string[],
): Distribution[] {
  const map: Record<string, number> = {};
  for (const l of leads) {
    const k = key(l);
    if (k) map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      color: Array.isArray(colors) ? colors[i % colors.length] : colors[name] || colors.default,
    }));
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

/**
 * Calcula todas as métricas de um conjunto de leads.
 * `range === null` significa "todo o histórico".
 */
export function computeMetrics(
  leads: Lead[],
  range: DateRange | null = null,
  atendimentos: AtendimentoRecord[] = [],
): Metrics {
  const recebidos = leads.filter(l => leadInRange(l, "dataConversao", range, "dataConsulta"));
  const agendadosPorLead = leads.filter(l => parseDate(l.dataConsulta) && leadInRange(l, "dataConsulta", range));
  const registrosDiariosNoPeriodo = atendimentos.filter(record => inRange(parseDate(record.date), range));
  // O relatório diário consolida as consultas agendadas, inclusive registros
  // que ainda não chegaram ao board individual de agendamentos. A preferência
  // é feita por cliente, pois a visão consolidada pode misturar clientes que
  // possuem e que não possuem o relatório diário.
  //
  // Só vale o diário do cliente que tem consultas agendadas preenchidas no
  // período. Há clínicas (ex.: Dr. Jonas) em que a equipe registra contatos no
  // diário mas deixa "Consulta Agendada" em zero; ali as consultas estão só no
  // board de agendamentos, e usar o diário zerava o card de agendamentos.
  const chaveCliente = (value: { clientName: string; boardId: string }) => value.clientName || value.boardId;
  const somaDiarioPorCliente = new Map<string, number>();
  for (const record of registrosDiariosNoPeriodo) {
    const chave = chaveCliente(record);
    somaDiarioPorCliente.set(chave, (somaDiarioPorCliente.get(chave) ?? 0) + record.consultaAgendada);
  }
  const clientesComDiario = new Set(Array.from(somaDiarioPorCliente).filter(([, soma]) => soma > 0).map(([chave]) => chave));
  const agendamentosDiarios = Array.from(somaDiarioPorCliente.values()).reduce((sum, soma) => sum + soma, 0);
  // Agendamento conta no mês da "Data de conversão", quando o lead virou
  // paciente (definição da gestora; sem ela, vale a data da consulta). Desses,
  // alguns têm a consulta depois do período ("2 para outubro"). No cliente com
  // diário preenchido vale o total do diário, que já inclui essas.
  const agendadosNoPeriodo = leads.filter(l => parseDate(l.dataConsulta) && leadInRange(l, "dataConversao", range, "dataConsulta"));
  const marcadasParaDepois = range
    ? agendadosNoPeriodo.filter(l => (parseDate(l.dataConsulta) ?? "") > range.to)
    : [];
  const semDiario = (lista: Lead[]) => lista.filter(lead => !clientesComDiario.has(chaveCliente(lead))).length;
  const agendadasParaDepois = marcadasParaDepois.length;
  const agendamentos = agendamentosDiarios + semDiario(agendadosNoPeriodo);
  // Base da taxa de comparecimento: só o que podia ter acontecido no período.
  const baseComparecimento = agendamentos - semDiario(marcadasParaDepois);
  // Consulta paga: aconteceu no período (data da consulta + presença) e tem
  // valor. Indicação entra: a exclusão dela vale só para a taxa comercial.
  const pagas = agendadosPorLead.filter(l => compareceuIsPresente(l.compareceu) && (l.valorConsulta ?? 0) > 0);
  const compareceram = agendadosPorLead.filter(
    lead => !isCanalIndicacao(lead.canal) && compareceuIsPresente(lead.compareceu),
  );

  const fechados = leads.filter(
    l => l.statusLead === "Negócio fechado" && leadInRange(l, "dataFechamento", range, "dataConversao"),
  );

  // Receita conta APENAS negócios fechados. A versão anterior somava o valor de
  // todos os leads quando havia filtro ativo e só dos fechados quando não havia,
  // então o mesmo card mudava de valor ao clicar num cliente.
  const receitaTotal = fechados.reduce((sum, l) => sum + (l.valor || 0), 0);

  const perdidos = recebidos.filter(l => l.statusLead === "Negócio perdido");
  const emNegociacao = recebidos.filter(l => l.statusLead === "Em negociação");
  const aguardando = recebidos.filter(l => l.statusLead === "Aguardando retorno");

  /**
   * Mês real, derivado da data do lead.
   *
   * Antes isto usava `l.group`, o nome do grupo no Monday. Em alguns boards o
   * grupo é mesmo um mês, mas em outros é "Agendamento" e "Agendamento- antigo"
   * — e o gráfico "Evolução por mês" saía com essas duas barras no eixo, sem
   * nenhuma relação com tempo.
   */
  const mesMap: Record<string, { leads: number; fechados: number }> = {};
  for (const l of recebidos) {
    const iso = parseDate(l.dataConversao) ?? parseDate(l.dataConsulta);
    const chave = iso ? iso.slice(0, 7) : null;
    if (!chave) continue; // lead sem data não entra numa linha do tempo
    if (!mesMap[chave]) mesMap[chave] = { leads: 0, fechados: 0 };
    mesMap[chave].leads++;
    if (l.statusLead === "Negócio fechado") mesMap[chave].fechados++;
  }

  const byGroup = (getKey: (l: Lead) => string) => {
    const map: Record<string, { leads: number; fechados: number; receita: number }> = {};
    for (const l of recebidos) {
      const k = getKey(l) || "—";
      if (!map[k]) map[k] = { leads: 0, fechados: 0, receita: 0 };
      map[k].leads++;
    }
    for (const l of fechados) {
      const k = getKey(l) || "—";
      if (!map[k]) map[k] = { leads: 0, fechados: 0, receita: 0 };
      map[k].fechados++;
      map[k].receita += l.valor || 0;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].leads - a[1].leads)
      .map(([name, v]) => ({ name, ...v }));
  };

  return {
    leadsRecebidos: recebidos.length,
    agendamentos,
    comparecimentos: compareceram.length,
    agendadasParaDepois,
    consultasPagas: pagas.length,
    receitaConsultas: pagas.reduce((sum, l) => sum + (l.valorConsulta ?? 0), 0),
    negociosFechados: fechados.length,
    negociosPerdidos: perdidos.length,
    emNegociacao: emNegociacao.length,
    aguardandoRetorno: aguardando.length,
    taxaConversao: recebidos.length > 0 ? (fechados.length / recebidos.length) * 100 : 0,
    taxaComparecimento: baseComparecimento > 0 ? (compareceram.length / baseComparecimento) * 100 : 0,
    receitaTotal,
    ticketMedio: fechados.length > 0 ? receitaTotal / fechados.length : 0,
    porCanal: distribution(recebidos, l => l.canal, CANAL_COLORS),
    porProcedimento: distribution(recebidos, l => l.procedimento, PROC_COLORS),
    porStatus: distribution(recebidos, l => l.statusLead, STATUS_COLORS),
    porMes: Object.entries(mesMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([chave, v]) => ({ mes: monthLabel(chave), ...v })),
    porSdr: byGroup(l => l.sdr),
    porCliente: byGroup(l => l.clientName),
  };
}

// ─── Comparativo entre períodos ──────────────────────────────────────────────

export interface MetricDelta {
  atual: number;
  anterior: number;
  variacaoPct: number | null;
}

export type MetricsComparison = Record<string, MetricDelta>;

const COMPARABLE = [
  "leadsRecebidos",
  "agendamentos",
  "comparecimentos",
  "negociosFechados",
  "receitaTotal",
  "taxaConversao",
] as const;

export function compareMetrics(current: Metrics, previous: Metrics): MetricsComparison {
  const out: MetricsComparison = {};
  for (const key of COMPARABLE) {
    const atual = current[key] as number;
    const anterior = previous[key] as number;
    out[key] = {
      atual,
      anterior,
      variacaoPct: anterior > 0 ? ((atual - anterior) / anterior) * 100 : null,
    };
  }
  return out;
}

/**
 * Resumo compacto entregue ao LLM. Números já calculados e arredondados aqui —
 * o modelo nunca recebe linhas cruas para contar, apenas os totais para narrar.
 */
export function metricsSummaryForLLM(
  clientName: string,
  range: DateRange | null,
  current: Metrics,
  comparison?: MetricsComparison,
) {
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    cliente: clientName,
    periodo: range ? `${range.from} a ${range.to}` : "todo o histórico",
    leadsRecebidos: current.leadsRecebidos,
    agendamentos: current.agendamentos,
    comparecimentos: current.comparecimentos,
    negociosFechados: current.negociosFechados,
    negociosPerdidos: current.negociosPerdidos,
    emNegociacao: current.emNegociacao,
    taxaConversao: `${round(current.taxaConversao)}%`,
    taxaComparecimento: `${round(current.taxaComparecimento)}%`,
    receitaTotal: current.receitaTotal,
    ticketMedio: round(current.ticketMedio),
    canaisDeAquisicao: current.porCanal.slice(0, 6).map(c => `${c.name}: ${c.value}`),
    procedimentos: current.porProcedimento.slice(0, 8).map(p => `${p.name}: ${p.value}`),
    comparativoPeriodoAnterior: comparison
      ? Object.fromEntries(
          Object.entries(comparison).map(([k, v]) => [
            k,
            { atual: round(v.atual), anterior: round(v.anterior), variacaoPct: v.variacaoPct === null ? null : round(v.variacaoPct) },
          ]),
        )
      : undefined,
  };
}

// ─── Snapshot do relatório ───────────────────────────────────────────────────

/**
 * Fotografia dos números no momento em que o relatório foi gerado.
 *
 * É isto que o portal do cliente usa para desenhar os gráficos, e não uma
 * consulta ao vivo no Monday. Dois motivos:
 *
 *  1. Os boards do Monday são mutáveis. Se a SDR mexer num lead na semana que
 *     vem, um gráfico ao vivo passaria a contradizer o texto do relatório que o
 *     médico já recebeu. Com o snapshot, número e texto nunca divergem.
 *  2. O portal é público e sem login. Buscar o Monday a cada visita abriria
 *     caminho para alguém derrubar a integração só recarregando a página.
 */
export interface ReportSnapshot {
  versao: 1;
  cliente: string;
  periodo: { label: string; from: string | null; to: string | null };
  kpis: {
    leadsRecebidos: number;
    agendamentos: number;
    comparecimentos: number;
    /** Ausente nos relatórios gravados antes deste campo existir. */
    agendadasParaDepois?: number;
    consultasPagas?: number;
    receitaConsultas?: number;
    negociosFechados: number;
    negociosPerdidos: number;
    emNegociacao: number;
    taxaConversao: number;
    taxaComparecimento: number;
    receitaTotal: number;
    ticketMedio: number;
  };
  graficos: {
    porCanal: Distribution[];
    porProcedimento: Distribution[];
    porStatus: Distribution[];
    porMes: { mes: string; leads: number; fechados: number }[];
  };
  comparativo: MetricsComparison | null;
}

export function buildReportSnapshot(
  clientName: string,
  range: DateRange | null,
  metrics: Metrics,
  comparison?: MetricsComparison,
): ReportSnapshot {
  return {
    versao: 1,
    cliente: clientName,
    periodo: {
      label: range ? formatRangeBR(range) : "Todo o período",
      from: range?.from ?? null,
      to: range?.to ?? null,
    },
    kpis: {
      leadsRecebidos: metrics.leadsRecebidos,
      agendamentos: metrics.agendamentos,
      comparecimentos: metrics.comparecimentos,
      agendadasParaDepois: metrics.agendadasParaDepois,
      consultasPagas: metrics.consultasPagas,
      receitaConsultas: metrics.receitaConsultas,
      negociosFechados: metrics.negociosFechados,
      negociosPerdidos: metrics.negociosPerdidos,
      emNegociacao: metrics.emNegociacao,
      taxaConversao: metrics.taxaConversao,
      taxaComparecimento: metrics.taxaComparecimento,
      receitaTotal: metrics.receitaTotal,
      ticketMedio: metrics.ticketMedio,
    },
    graficos: {
      // Fatias demais viram confete ilegível; o resto vira "Outros".
      porCanal: limitSlices(metrics.porCanal, 6),
      porProcedimento: limitSlices(metrics.porProcedimento, 8),
      porStatus: limitSlices(metrics.porStatus, 6),
      porMes: metrics.porMes.slice(-12),
    },
    comparativo: comparison ?? null,
  };
}

function limitSlices(items: Distribution[], max: number): Distribution[] {
  if (items.length <= max) return items;
  const head = items.slice(0, max - 1);
  const rest = items.slice(max - 1);
  return [...head, { name: "Outros", value: rest.reduce((s, i) => s + i.value, 0), color: "#9ca3af" }];
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-04" -> "abr/26". Curto para caber no eixo do gráfico. */
export function monthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return `${MESES_CURTOS[Number(m) - 1] ?? m}/${y.slice(2)}`;
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * Se o período é exatamente um mês do calendário, devolve o nome dele e o do
 * mês seguinte ("agosto", "setembro"). Serve para escrever "já marcadas para
 * setembro" em vez de "para depois do período".
 */
export function mesDoPeriodo(range: DateRange | null): { mes: string; seguinte: string } | null {
  if (!range) return null;
  const [ano, mes, dia] = range.from.split("-").map(Number);
  if (dia !== 1 || !range.to.startsWith(range.from.slice(0, 8))) return null;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (Number(range.to.slice(8, 10)) !== ultimoDia) return null;
  return { mes: MESES[mes - 1], seguinte: MESES[mes % 12] };
}

export function formatRangeBR(range: DateRange): string {
  return `${formatDateBR(range.from)} a ${formatDateBR(range.to)}`;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Aceita snapshots antigos ou corrompidos sem quebrar a página. */
export function parseReportSnapshot(raw: string | null | undefined): ReportSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.versao === 1 && parsed.kpis && parsed.graficos) return parsed as ReportSnapshot;
    return null;
  } catch {
    return null;
  }
}
