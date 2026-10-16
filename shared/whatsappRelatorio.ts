/**
 * Mensagem de WhatsApp que leva o relatório ao cliente.
 *
 * Fica em `shared/` porque a tela mostra a prévia exatamente como o servidor
 * vai enviar: mesma função dos dois lados, sem duas versões que divergem.
 *
 * O link usa sempre o token público — a página /r/ só reconhece o token, e
 * mandar o slug ("/r/drmario") entregava "Link inválido" ao cliente. O
 * período vai na URL para o relatório já abrir no mês que foi analisado.
 */

export const ASSINATURA = "Scarlett Fronza · Digital Escarlate";

export const VARIAVEIS_ZAPI = ["ZAPI_INSTANCE_ID", "ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN"] as const;

/** Quais variáveis do Z-API ainda faltam no ambiente. Vazio = configurado. */
export function zapVarsFaltando(env: Record<string, string | undefined>): string[] {
  return VARIAVEIS_ZAPI.filter((v) => !env[v]?.trim());
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-08-01","2026-08-31" → "01/08 a 31/08/2026"; anos diferentes saem por inteiro. */
export function formatarPeriodo(from: string, to: string): string {
  if (!ISO.test(from) || !ISO.test(to)) return `${from} a ${to}`;
  const [fa, fm, fd] = from.split("-");
  const [ta, tm, td] = to.split("-");
  if (fa === ta) return `${fd}/${fm} a ${td}/${tm}/${ta}`;
  return `${fd}/${fm}/${fa} a ${td}/${tm}/${ta}`;
}

export function linkRelatorio(origem: string, publicToken: string, from: string, to: string): string {
  const base = origem.replace(/\/+$/, "");
  const q = new URLSearchParams({ de: from, ate: to });
  return `${base}/r/${encodeURIComponent(publicToken)}?${q.toString()}`;
}

export type DadosMensagem = {
  clienteNome: string;
  from: string;
  to: string;
  /** Texto escrito pela gestora na prévia; vazio usa o padrão. */
  texto?: string | null;
};

/** Números do período que entram na mensagem. Zero ou ausente fica de fora. */
export type MetricasMensagem = {
  investimento?: number;
  leads?: number;
  custoPorLead?: number;
  vendas?: number;
  custoPorVenda?: number;
  faturamento?: number;
  roas?: number;
  ticketMedio?: number;
  taxaConversao?: number;
  novosContatos?: number;
  novosSeguidores?: number;
};

const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");
const pos = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Bloco de métricas, uma por linha, só com o que tem valor. A ordem segue
 * o funil: quanto investiu, quantos leads, o que virou venda, o que isso
 * rendeu, e por fim o crescimento do perfil.
 */
export function linhasMetricas(m: MetricasMensagem): string[] {
  const linhas: string[] = [];
  if (pos(m.investimento)) linhas.push(`Investimento: ${brl(m.investimento)}`);
  if (pos(m.leads)) linhas.push(`Leads: ${inteiro(m.leads)}`);
  if (pos(m.custoPorLead)) linhas.push(`CPL: ${brl(m.custoPorLead)}`);
  if (pos(m.vendas)) linhas.push(`Vendas: ${inteiro(m.vendas)}`);
  if (pos(m.custoPorVenda)) linhas.push(`Custo por venda: ${brl(m.custoPorVenda)}`);
  if (pos(m.faturamento)) linhas.push(`Faturamento: ${brl(m.faturamento)}`);
  if (pos(m.roas)) linhas.push(`ROAS: ${m.roas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  if (pos(m.ticketMedio)) linhas.push(`Ticket médio: ${brl(m.ticketMedio)}`);
  if (pos(m.taxaConversao)) linhas.push(`Taxa de conversão: ${m.taxaConversao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
  if (pos(m.novosContatos)) linhas.push(`Novos contatos: ${inteiro(m.novosContatos)}`);
  if (pos(m.novosSeguidores)) linhas.push(`Novos seguidores: ${inteiro(m.novosSeguidores)}`);
  return linhas;
}

/**
 * Perguntas que vão junto com o relatório: a resposta da clínica sobre a
 * qualidade dos leads é o que a gestora não enxerga pelos números.
 */
export const PERGUNTAS = [
  "✨ *Perguntinhas:*",
  "1️⃣ Como você classifica a qualidade dos leads desse período? 👉 Ótimo | Mediano | Ruim | Péssimo",
  "2️⃣ Como foi o engajamento desses leads?",
  "3️⃣ Teve alguma objeção ou padrão que se repetiu?",
];

/**
 * Corpo da mensagem sem o link — é o que a gestora edita na prévia.
 * Sem o nome do cliente: a mensagem vai no grupo da própria clínica.
 */
export function corpoPadrao(d: Pick<DadosMensagem, "from" | "to"> & { metricas?: MetricasMensagem | null }): string {
  const numeros = d.metricas ? linhasMetricas(d.metricas) : [];
  return [
    `Olá! 👋 Segue o relatório referente ao período de ${formatarPeriodo(d.from, d.to)}.`,
    "",
    ...(numeros.length ? ["📊 *Resumo do período*", ...numeros, ""] : []),
    "Nele estão os dados de tráfego, o perfil do Instagram e os resultados comerciais do período.",
    "",
    ...PERGUNTAS,
    "",
    "Qualquer dúvida, é só me chamar por aqui.",
    ASSINATURA,
  ].join("\n");
}

/** Mensagem completa: corpo (editado ou padrão) + link do relatório. */
export function montarMensagemRelatorio(d: DadosMensagem, link: string): string {
  const corpo = d.texto?.trim() || corpoPadrao(d);
  return `${corpo}\n\n🔗 ${link}`;
}

/**
 * Lê `?de=&ate=` da URL do relatório público. Aceita só datas ISO válidas,
 * com início ≤ fim e nada no futuro; qualquer coisa fora disso devolve null
 * e a página cai no padrão (mês atual).
 */
export function lerPeriodoDaUrl(search: string, hoje: Date): { from: Date; to: Date } | null {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const de = q.get("de"); const ate = q.get("ate");
  if (!de || !ate || !ISO.test(de) || !ISO.test(ate)) return null;
  const from = new Date(`${de}T00:00:00`); const to = new Date(`${ate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (from > to || to > limite) return null;
  return { from, to };
}
