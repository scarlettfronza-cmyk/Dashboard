/**
 * monday.ts — integração com a API do Monday.com, no SERVIDOR.
 *
 * Esta lógica vivia em client/src/hooks/useMondayData.ts, o que embutia um
 * token pessoal de API no bundle JavaScript entregue a todo navegador.
 * Aqui o token vem de MONDAY_API_TOKEN e nunca sai do servidor.
 *
 * Também resolve o mapeamento de colunas por board, que antes era um if/else
 * entre dois formatos hardcoded ("A" = Bruna, "B" = Ellora) — o que obrigava
 * a um deploy a cada cliente novo, contradizendo o botão "adicionar cliente".
 */
import { ENV } from "./_core/env";
import type { Lead, AtendimentoRecord } from "../shared/metrics";

const MONDAY_API_URL = "https://api.monday.com/v2";
const API_VERSION = "2024-01";
// O Monday aceita até 500 itens por página. Com 100, um board de 800 itens
// custava 9 requisições; com 500, custa 2. Foi o maior ganho isolado contra o
// limite de requisições.
const PAGE_SIZE = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Mapeamento de colunas ───────────────────────────────────────────────────

/**
 * Cada campo canônico aponta para um ou mais column_ids do Monday. A primeira
 * coluna presente no item vence, o que permite que boards parecidos mas não
 * idênticos compartilhem um mesmo perfil.
 */
export interface ColumnMapping {
  canal: string[];
  procedimento: string[];
  dataConversao: string[];
  dataConsulta: string[];
  dataFechamento: string[];
  dataProcedimento: string[];
  compareceu: string[];
  statusLead: string[];
  valor: string[];
  obs: string[];
  /** Colunas numéricas do board de atendimento diário. */
  atendimento?: Record<keyof Omit<AtendimentoRecord, "date" | "boardId" | "clientName" | "sdrName">, string>;
}

/** Perfil "Agendamentos" original (board da Bruna e do Dr Lucas Moura). */
const PROFILE_AGENDAMENTO_V1: ColumnMapping = {
  canal: ["color_mkxemc7y"],
  procedimento: ["color_mkxehqcz"],
  dataConversao: ["date_mm3kfnaq"],
  dataConsulta: ["data"],
  dataFechamento: ["date_mm3kffmt"],
  dataProcedimento: ["date_mm3mwc1h"],
  compareceu: ["color_mkxef5es"],
  statusLead: ["color_mkxe737q"],
  valor: ["numeric_mkxegda4"],
  obs: ["text_mkxef0sn"],
};

/** Perfil "Ellora" (Tatiana, Estéfani, Jonas, Mansur). */
const PROFILE_ELLORA: ColumnMapping = {
  canal: ["color_mm26wac7", "color_mm29r4r7", "color_mm2qtfdx"],
  procedimento: ["color_mm1hqk5j"],
  dataConversao: ["date_mm2raqk2", "date_mm2r19d4", "date_mm2rr72d"],
  dataConsulta: ["date_mm0gbha1"],
  dataFechamento: ["date_mm1hc7mc", "date_mm2yqhe4", "date_mm2yxjrc"],
  dataProcedimento: [],
  compareceu: ["color_mm0gjc4r"],
  statusLead: ["color_mm0gc5pp"],
  // valor da cirurgia tem precedência sobre o da consulta
  valor: ["numeric_mm0g5ne5", "numeric_mm1gaysd"],
  obs: ["text_mm0gqshj"],
  atendimento: {
    novosContatos: "numeric_mm0ghk9f",
    novosAds: "numeric_mm1cnrjx",
    conversasRealizadas: "numeric_mm0gan6a",
    consultaAgendada: "numeric_mm0grj5p",
    agendadoAds: "numeric_mm1cvc9d",
    procedimentoVendido: "numeric_mm26gbsg",
  },
};

export const COLUMN_PROFILES = {
  agendamento_v1: PROFILE_AGENDAMENTO_V1,
  ellora: PROFILE_ELLORA,
} as const;

export type ProfileName = keyof typeof COLUMN_PROFILES;

/**
 * Detecta o perfil pelas colunas presentes. Fallback para "ellora", que é o
 * formato da maioria dos boards.
 */
export function detectProfile(columnIds: string[]): ProfileName {
  const v1Markers = ["color_mkxe737q", "color_mkxemc7y", "numeric_mkxegda4"];
  return v1Markers.some(id => columnIds.includes(id)) ? "agendamento_v1" : "ellora";
}

// ─── Detecção por título ─────────────────────────────────────────────────────

export interface ColumnMeta {
  id: string;
  title: string;
  type: string;
}

/**
 * Descobre as colunas pelo TÍTULO, não pelo ID.
 *
 * Os IDs do Monday são gerados por board: duas clínicas com a coluna "Canal de
 * Aquisição" têm IDs diferentes. Com o mapeamento fixo por ID, um board novo
 * caía silenciosamente para vazio — foi o que aconteceu com a Dra Estéfani, em
 * que o gráfico "De onde vieram os leads" apareceu sem dados e a coluna CANAL
 * da tabela ficou toda com "—", mesmo o board tendo o campo preenchido.
 *
 * O tipo da coluna desempata: só uma coluna de data vira data, só uma numérica
 * vira valor. Os perfis por ID continuam como reserva.
 */
const TITLE_RULES: { campo: keyof Omit<ColumnMapping, "atendimento">; padrao: RegExp; tipos: string[] }[] = [
  { campo: "canal", padrao: /\b(canal|origem|aquisi|de onde|midia|m[ií]dia|fonte)\b/, tipos: ["color", "status", "dropdown", "text"] },
  { campo: "procedimento", padrao: /\b(procedimento|cirurgia|servi[çc]o|tratamento)\b/, tipos: ["color", "status", "dropdown", "text"] },
  { campo: "compareceu", padrao: /\b(compareceu|comparecimento|presen[çc]a|veio)\b/, tipos: ["color", "status", "dropdown"] },
  { campo: "statusLead", padrao: /\b(status|situa[çc][ãa]o|est[áa]gio|etapa)\b/, tipos: ["color", "status", "dropdown"] },
  { campo: "valor", padrao: /\b(valor|pre[çc]o|ticket|receita|or[çc]amento)\b/, tipos: ["numbers", "numeric"] },
  { campo: "dataConsulta", padrao: /\b(consulta|agendamento|agendada)\b/, tipos: ["date"] },
  { campo: "dataFechamento", padrao: /\b(fechamento|fechado|fechou|venda)\b/, tipos: ["date"] },
  { campo: "dataProcedimento", padrao: /\b(procedimento|cirurgia)\b/, tipos: ["date"] },
  { campo: "dataConversao", padrao: /\b(convers[ãa]o|entrada|chegou|primeiro contato|lead|contato)\b/, tipos: ["date"] },
  { campo: "obs", padrao: /\b(obs|observa|coment|anota|nota)\b/, tipos: ["text", "long-text", "long_text"] },
];

function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function mappingFromTitles(columns: ColumnMeta[]): Partial<ColumnMapping> {
  const found: Partial<ColumnMapping> = {};
  const usados = new Set<string>();

  for (const regra of TITLE_RULES) {
    for (const col of columns) {
      if (usados.has(col.id)) continue;
      if (!regra.tipos.includes(col.type)) continue;
      if (!regra.padrao.test(fold(col.title))) continue;

      found[regra.campo] = [col.id];
      usados.add(col.id);
      break;
    }
  }
  return found;
}

/** Títulos vencem; o perfil por ID cobre o que a detecção não achou. */
export function mergeMapping(base: ColumnMapping, detected: Partial<ColumnMapping>): ColumnMapping {
  const out: ColumnMapping = { ...base };
  const campos = Object.keys(detected) as Array<keyof Omit<ColumnMapping, "atendimento">>;
  for (const campo of campos) {
    const ids = detected[campo];
    if (ids && ids.length > 0) {
      out[campo] = [...ids, ...base[campo]];
    }
  }
  return out;
}

// ─── Normalização de rótulos ─────────────────────────────────────────────────

const STATUS_ALIASES: Record<string, string> = {
  "Consulta Agendada": "Em negociação",
  "Faltam 3 dias": "Em negociação",
  "Faltam 7 dias": "Em negociação",
  "Faltam 10 dias": "Em negociação",
  "Faltam 20 dias": "Em negociação",
  "Faltam 30 dias": "Em negociação",
  "Faltam 6 meses": "Em negociação",
  "É amanhã": "Em negociação",
  "Dia da consulta": "Em negociação",
  Remarcar: "Aguardando retorno",
  "Fazer Follow up": "Aguardando retorno",
  "veio apenas para um laudo": "Aguardando retorno",
};

const CANAL_ALIASES: Record<string, string> = {
  "Whats/Meta": "Whats/META",
  "Google/SITE": "Google",
  "Google/site": "Google",
  "Instagram/Social Selling": "Social Selling/DIRECT",
  "Social Selling": "Social Selling/DIRECT",
  "Instagram/DIRECT": "Social Selling/DIRECT",
  Indicação: "Indicações",
};

export const normalizeStatus = (s: string) => STATUS_ALIASES[s] ?? s;
export const normalizeCanal = (c: string) => CANAL_ALIASES[c] ?? c;

function pick(cols: Record<string, string>, ids: string[]): string {
  for (const id of ids) {
    if (cols[id]) return cols[id];
  }
  return "";
}

function parseValor(raw: string): number | null {
  if (!raw) return null;
  // remove símbolo de moeda e separador de milhar brasileiro
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Chamada à API ───────────────────────────────────────────────────────────

export interface BoardRef {
  id: string;
  clientName: string;
  sdrName?: string;
}

interface MondayItem {
  id: string;
  name: string;
  group?: { title: string };
  column_values: { id: string; text: string | null }[];
}

interface MondayResponse {
  data?: {
    boards?: {
      name: string;
      columns?: ColumnMeta[];
      items_page: { cursor: string | null; items: MondayItem[] };
    }[];
  };
  errors?: { message: string }[];
}

export class MondayError extends Error {
  /** Permite à interface distinguir "falta configurar" de "esperar um pouco". */
  constructor(
    message: string,
    readonly kind: "config" | "rate_limit" | "api" = "api",
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Fila global de requisições ao Monday.
 *
 * O limite deles é por minuto e conta o custo das consultas, não só a
 * quantidade. Antes, carregar um cliente disparava os dois boards em paralelo,
 * cada um paginando de 100 em 100 — um cliente com 800 itens virava uma rajada
 * de chamadas simultâneas, e o catálogo de 338 boards somava mais. Resultado:
 * HTTP 429 e o painel inteiro em branco.
 *
 * Uma requisição por vez, com um respiro entre elas. Fica mais lento em
 * carga fria, mas o cache absorve isso e para de estourar o limite.
 */
const MIN_GAP_MS = 180;
/**
 * Duas faixas, não uma.
 *
 * A primeira versão desta fila era estritamente serial, e isso criou um
 * engarrafamento: a Visão Geral de uma SDR ficava esperando atrás do catálogo
 * de 338 boards que a gestora tinha pedido, e as duas telas ficavam
 * "Carregando..." por dezenas de segundos. Duas faixas mantêm o ritmo baixo o
 * suficiente para o limite do Monday sem transformar tudo numa via única.
 */
const FAIXAS = 2;
const faixas: Promise<unknown>[] = Array.from({ length: FAIXAS }, () => Promise.resolve());
let proxima = 0;
let lastCall = 0;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const i = proxima;
  proxima = (proxima + 1) % FAIXAS;

  const run = faixas[i].then(async () => {
    const espera = MIN_GAP_MS - (Date.now() - lastCall);
    if (espera > 0) await sleep(espera);
    lastCall = Date.now();
    return fn();
  });

  // A faixa não pode quebrar quando uma chamada falha.
  faixas[i] = run.catch(() => undefined);
  return run as Promise<T>;
}

const MAX_TENTATIVAS = 3;
const REQUEST_TIMEOUT_MS = 20_000;
/** Teto para a carga inteira de um board, somando todas as páginas. */
const BOARD_TIMEOUT_MS = 90_000;

export interface FetchBoardsOptions {
  force?: boolean;
  maxAttempts?: number;
  requestTimeoutMs?: number;
  boardTimeoutMs?: number;
}

async function query(gql: string, opts: FetchBoardsOptions = {}): Promise<MondayResponse> {
  if (!ENV.mondayApiToken) {
    throw new MondayError(
      "MONDAY_API_TOKEN não configurado. Defina a variável de ambiente no servidor (ver .env.example).",
      "config",
    );
  }

  return enqueue(async () => {
    let ultimoErro: MondayError | null = null;
    const maxAttempts = opts.maxAttempts ?? MAX_TENTATIVAS;
    const requestTimeoutMs = opts.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;

    for (let tentativa = 1; tentativa <= maxAttempts; tentativa++) {
      // Sem isto, uma conexão pendurada deixava a tela em "Carregando..." para
      // sempre, sem nunca virar erro.
      const abort = AbortSignal.timeout(requestTimeoutMs);
      let res: Response;
      try {
        res = await fetch(MONDAY_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: ENV.mondayApiToken,
            "API-Version": API_VERSION,
          },
          body: JSON.stringify({ query: gql }),
          signal: abort,
        });
      } catch (err) {
        ultimoErro = new MondayError(
          `O Monday demorou mais de ${requestTimeoutMs / 1000}s para responder.`,
          "api",
        );
        if (tentativa === maxAttempts) break;
        await sleep(1500 * tentativa);
        continue;
      }

      // 429 = limite atingido, 5xx = instabilidade. Os dois valem nova tentativa.
      if (res.status === 429 || res.status >= 500) {
        ultimoErro = new MondayError(
          res.status === 429
            ? "Limite de requisições do Monday atingido."
            : `Monday respondeu ${res.status}.`,
          res.status === 429 ? "rate_limit" : "api",
        );

        if (tentativa === maxAttempts) break;

        // O Monday costuma dizer quanto esperar no cabeçalho Retry-After; se
        // não disser, recuo crescente: 2s, 3s, 6s.
        const retryAfter = Number(res.headers.get("retry-after"));
        const espera = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15_000)
          : 1500 * tentativa;

        console.warn(`[Monday] ${res.status}; nova tentativa em ${Math.round(espera / 1000)}s (${tentativa}/${maxAttempts})`);
        await sleep(espera);
        continue;
      }

      if (!res.ok) throw new MondayError(`Monday respondeu ${res.status}.`, "api");

      const json = (await res.json()) as MondayResponse;
      if (json.errors?.length) {
        const msg = json.errors.map(e => e.message).join("; ");
        // O limite de complexidade também chega como erro de corpo, com 200.
        if (/complexity|rate limit|budget/i.test(msg)) {
          ultimoErro = new MondayError("Limite de requisições do Monday atingido.", "rate_limit");
          if (tentativa === maxAttempts) break;
          await sleep(4000 * tentativa);
          continue;
        }
        throw new MondayError(msg, "api");
      }
      return json;
    }

    throw ultimoErro ?? new MondayError("Falha ao consultar o Monday.", "api");
  });
}

export interface BoardData {
  boardId: string;
  boardName: string;
  leads: Lead[];
  atendimentos: AtendimentoRecord[];
}

async function fetchBoard(board: BoardRef, opts: FetchBoardsOptions = {}): Promise<BoardData> {
  const leads: Lead[] = [];
  const atendimentos: AtendimentoRecord[] = [];
  let cursor: string | null = null;
  let boardName = "";
  let profile: ProfileName | null = null;
  let mapping: ColumnMapping | null = null;
  let pages = 0;
  const prazo = Date.now() + (opts.boardTimeoutMs ?? BOARD_TIMEOUT_MS);

  do {
    if (Date.now() > prazo) {
      console.warn(`[Monday] board ${board.id}: tempo esgotado após ${pages} páginas; devolvendo o que carregou`);
      break;
    }

    const cursorArg = cursor ? `, cursor: "${cursor.replace(/"/g, '\\"')}"` : "";
    const gql = `query {
      boards(ids: [${Number(board.id)}]) {
        name
        columns { id title type }
        items_page(limit: ${PAGE_SIZE}${cursorArg}) {
          cursor
          items { id name group { title } column_values { id text } }
        }
      }
    }`;

    const json = await query(gql, opts);
    const boardData = json.data?.boards?.[0];
    if (!boardData) break;

    boardName = boardData.name;
    cursor = boardData.items_page.cursor;

    for (const item of boardData.items_page.items) {
      const cols: Record<string, string> = {};
      for (const cv of item.column_values) cols[cv.id] = cv.text ?? "";

      if (!mapping) {
        profile = detectProfile(Object.keys(cols));
        mapping = mergeMapping(COLUMN_PROFILES[profile], mappingFromTitles(boardData.columns ?? []));
      }
      const map = mapping;

      // Board de atendimento diário: linhas são dias, não pessoas.
      const at = map.atendimento;
      if (at && (cols[at.novosContatos] !== undefined || cols[at.conversasRealizadas] !== undefined)) {
        const num = (id: string) => parseFloat(cols[id] || "0") || 0;
        atendimentos.push({
          date: cols["data"] || item.name,
          novosContatos: num(at.novosContatos),
          novosAds: num(at.novosAds),
          conversasRealizadas: num(at.conversasRealizadas),
          consultaAgendada: num(at.consultaAgendada),
          agendadoAds: num(at.agendadoAds),
          procedimentoVendido: num(at.procedimentoVendido),
          boardId: board.id,
          clientName: board.clientName,
          sdrName: board.sdrName ?? "",
        });
        continue;
      }

      leads.push({
        id: item.id,
        name: item.name,
        group: item.group?.title ?? "",
        sdr: cols["person"] || board.sdrName || "",
        canal: normalizeCanal(pick(cols, map.canal)),
        procedimento: pick(cols, map.procedimento),
        dataConversao: pick(cols, map.dataConversao),
        dataConsulta: pick(cols, map.dataConsulta),
        dataFechamento: pick(cols, map.dataFechamento),
        dataProcedimento: pick(cols, map.dataProcedimento),
        compareceu: pick(cols, map.compareceu),
        statusLead: normalizeStatus(pick(cols, map.statusLead)),
        valor: parseValor(pick(cols, map.valor)),
        obs: pick(cols, map.obs),
        boardId: board.id,
        boardName,
        clientName: board.clientName,
      });
    }

    pages++;
    // trava de segurança contra cursor que não avança
    if (pages > 40) break;
  } while (cursor);

  return { boardId: board.id, boardName, leads, atendimentos };
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { at: number; data: BoardData }>();

/**
 * Busca os boards com cache de 5 minutos. O dashboard antigo refazia toda a
 * paginação a cada render do frontend, o que explicava as travas longas em
 * "Carregando dados do Monday.com...".
 */
/** Board que não pôde ser atualizado, e se sobrou cache velho para ele. */
export interface BoardIssue {
  boardId: string;
  motivo: string;
  kind: "config" | "rate_limit" | "api";
  usouCache: boolean;
}

export interface FetchResult {
  boards: BoardData[];
  /**
   * Vazio significa "tudo atualizado". Qualquer item aqui indica que os números
   * podem estar incompletos ou defasados — e é por isso que a geração de
   * relatório se recusa a rodar quando esta lista não está vazia. Publicar um
   * relatório com zeros causados por falha de API seria pior do que não gerar.
   */
  indisponiveis: BoardIssue[];
  /** Data do dado mais antigo em uso, quando algum veio do cache. */
  cacheMaisAntigo: Date | null;
}

/**
 * Compatibiliza a checagem de segurança com o contrato parcial atual. Uma
 * lista de issues sempre bloqueia relatório, inclusive quando algum board veio
 * de cache, para nunca publicar um retrato possivelmente defasado como atual.
 */
export function hasUnavailableBoards(
  result: FetchResult | Array<{ unavailable?: boolean }>,
): boolean {
  return Array.isArray(result) ? result.some(board => board.unavailable === true) : result.indisponiveis.length > 0;
}

/**
 * Nunca lança. Sempre devolve o que conseguiu, mais a lista do que faltou.
 *
 * Antes, uma falha virava board vazio silencioso, indistinguível de um board
 * que realmente não tem leads. O dashboard mostrava zero e o relatório podia
 * ser gerado em cima desse zero.
 */
export async function fetchBoards(boards: BoardRef[], opts: FetchBoardsOptions = {}): Promise<FetchResult> {
  const out: BoardData[] = [];
  const indisponiveis: BoardIssue[] = [];
  let cacheMaisAntigo: number | null = null;

  // Em sequência: em paralelo, um cliente com dois boards grandes disparava
  // duas paginações ao mesmo tempo e ajudava a estourar o limite.
  for (const board of boards) {
    const key = `${board.id}:${board.clientName}`;
    const hit = cache.get(key);

    if (!opts.force && hit && Date.now() - hit.at < CACHE_TTL_MS) {
      out.push(hit.data);
      continue;
    }

    try {
      const data = await fetchBoard(board, opts);
      cache.set(key, { at: Date.now(), data });
      out.push(data);
    } catch (err) {
      const erro = err instanceof MondayError ? err : new MondayError(String(err), "api");
      console.error(`[Monday] board ${board.id}: ${erro.message}`);

      indisponiveis.push({
        boardId: board.id,
        motivo: erro.message,
        kind: erro.kind,
        usouCache: Boolean(hit),
      });

      if (hit) {
        out.push(hit.data);
        cacheMaisAntigo = cacheMaisAntigo === null ? hit.at : Math.min(cacheMaisAntigo, hit.at);
      } else {
        out.push({ boardId: board.id, boardName: board.clientName, leads: [], atendimentos: [] });
      }
    }
  }

  return { boards: out, indisponiveis, cacheMaisAntigo: cacheMaisAntigo ? new Date(cacheMaisAntigo) : null };
}

export function invalidateCache(boardId?: string) {
  if (!boardId) return cache.clear();
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(`${boardId}:`)) cache.delete(key);
  }
}

// ─── Catálogo de boards da conta ─────────────────────────────────────────────

export interface BoardSummary {
  id: string;
  name: string;
  workspace: string | null;
  itemCount: number | null;
  updatedAt: string | null;
}

const SUBITEM_BOARD = /^(subelementos de|subitems of)\b/i;

let catalogCache: { at: number; boards: BoardSummary[] } | null = null;
// O conjunto de boards da conta muda raramente; segurar por uma hora reduz
// muito a pressão sobre o limite de requisições. O botão "Atualizar" força.
const CATALOG_TTL_MS = 60 * 60 * 1000;

/**
 * Lista TODOS os boards visíveis pelo token da agência. Alimenta a busca do
 * painel de administração, para que a gestora não precise achar ID de board na
 * URL do Monday e digitar à mão.
 */
export async function listAllBoards(opts: { force?: boolean } = {}): Promise<BoardSummary[]> {
  if (!opts.force && catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.boards;
  }

  const boards: BoardSummary[] = [];
  let page = 1;

  // A API pagina por página numerada nesta query (não por cursor).
  while (page <= 20) {
    const gql = `query {
      boards(limit: 100, page: ${page}, state: active, order_by: used_at) {
        id
        name
        updated_at
        workspace { name }
      }
    }`;

    const json = (await query(gql)) as unknown as {
      data?: {
        boards?: {
          id: string;
          name: string;
          updated_at: string | null;
          workspace: { name: string } | null;
        }[];
      };
    };

    const batch = json.data?.boards ?? [];
    if (batch.length === 0) break;

    for (const b of batch) {
      // O Monday cria um board espelho para os subitens de cada board real.
      // Eles nunca têm dados próprios e só poluem a busca da gestora — na conta
      // atual são quase metade dos resultados.
      if (SUBITEM_BOARD.test(b.name)) continue;

      boards.push({
        id: String(b.id),
        name: b.name,
        workspace: b.workspace?.name ?? null,
        // `items_count` foi retirado da consulta: é o campo mais caro no
        // orçamento de complexidade do Monday e, multiplicado por 338 boards,
        // sozinho já estourava o limite.
        itemCount: null,
        updatedAt: b.updated_at ?? null,
      });
    }

    if (batch.length < 100) break;
    page++;
  }

  catalogCache = { at: Date.now(), boards };
  return boards;
}

export function invalidateCatalog() {
  catalogCache = null;
}
