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

/** "Relatorio-DR-MARIO-BONGIOLO-2026-08-01-a-2026-08-31.pdf" — só ASCII, para qualquer celular abrir. */
export function nomeArquivoPdf(clienteNome: string, from: string, to: string): string {
  const base = clienteNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase() || "CLIENTE";
  return `Relatorio-${base}-${from}-a-${to}.pdf`;
}

export type DadosMensagem = {
  clienteNome: string;
  from: string;
  to: string;
  /** Texto escrito pela gestora na prévia; vazio usa o padrão. */
  texto?: string | null;
};

/** Corpo da mensagem sem o link — é o que a gestora edita na prévia. */
export function corpoPadrao(d: Pick<DadosMensagem, "clienteNome" | "from" | "to">): string {
  const nome = d.clienteNome.trim();
  return [
    `Olá! 👋 Segue o relatório de *${nome}* referente ao período de ${formatarPeriodo(d.from, d.to)}.`,
    "",
    "Nele estão os dados de tráfego, o perfil do Instagram e os resultados comerciais do período. Qualquer dúvida, é só me chamar por aqui.",
    "",
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
