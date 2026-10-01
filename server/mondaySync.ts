/**
 * Monday.com Board Sync
 * Uses the Monday.com GraphQL API directly via fetch (no manus-mcp-cli dependency).
 * Token is read from the integrations table (provider = "monday").
 * Supports optional date range filtering by consultDate.
 */
import { getDb } from "./db";
import { salesRecords, clients, integrations } from "../drizzle/schema";
import { chaveDeduplicacao } from "./registrosVendas";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSystemSetting } from "./_core/systemRouter";
import mysql2 from "mysql2/promise";

const MONDAY_API_URL = "https://api.monday.com/v2";

// Types

interface MondayColumnValue {
  id: string;
  type: string;
  text: string | null;
  value: string | null;
}

interface MondayItem {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  group?: { id: string; title: string };
  column_values: MondayColumnValue[];
}

export interface BoardColumn {
  id: string;
  title: string;
  type: string;
}

// GraphQL helper

async function mondayGraphQL(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  timeoutMs = 120_000
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        "API-Version": "2024-01",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new Error("Monday API timeout: a requisição demorou mais de 120s. Tente sincronizar novamente.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Monday API HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    data?: unknown;
    errors?: { message: string }[];
  };

  if (data.errors && data.errors.length > 0) {
    throw new Error(`Monday API error: ${data.errors.map((e) => e.message).join(", ")}`);
  }

  return data.data;
}

// Board schema

export async function getBoardSchema(boardId: string, token: string): Promise<BoardColumn[]> {
  const query = `
    query GetBoardSchema($boardId: ID!) {
      boards(ids: [$boardId]) {
        columns { id title type }
      }
    }
  `;
  const data = (await mondayGraphQL(query, { boardId }, token)) as {
    boards: { columns: BoardColumn[] }[];
  };
  return data.boards[0]?.columns ?? [];
}

// Board items with pagination
// Note: queries use string arrays joined to avoid esbuild misinterpreting GraphQL curly braces as template interpolation
const QUERY_NEXT_PAGE = [
  "query GetItemsNextPage($cursor: String!) {",
  "  next_items_page(limit: 200, cursor: $cursor) {",
  "    cursor",
  "    items { id name created_at updated_at group { id title } column_values { id type text value } }",
  "  }",
  "}",
].join("\n");

const QUERY_FIRST_PAGE = [
  "query GetBoardItems($boardId: ID!) {",
  "  boards(ids: [$boardId]) {",
  "    items_page(limit: 200) {",
  "      cursor",
  "      items { id name created_at updated_at group { id title } column_values { id type text value } }",
  "    }",
  "  }",
  "}",
].join("\n");

async function getBoardItemsPage(
  boardId: string,
  token: string,
  cursor?: string
): Promise<{ items: MondayItem[]; nextCursor: string | null }> {
  if (cursor) {
    const data = (await mondayGraphQL(QUERY_NEXT_PAGE, { cursor }, token)) as {
      next_items_page: { cursor: string | null; items: MondayItem[] };
    };
    return {
      items: data.next_items_page.items,
      nextCursor: data.next_items_page.cursor,
    };
  } else {
    const data = (await mondayGraphQL(QUERY_FIRST_PAGE, { boardId }, token)) as {
      boards: { items_page: { cursor: string | null; items: MondayItem[] } }[];
    };
    const board = data.boards[0];
    return {
      items: board.items_page.items,
      nextCursor: board.items_page.cursor,
    };
  }
}

// Column detection

export interface ColumnMap {
  consultValueId?: string;
  surgeryValueId?: string;
  consultDateId?: string;
  consultDatePriority?: number; // Higher = higher priority (prevents low-priority cols from overwriting)
  conversionDateId?: string; // Data de Conversão (quando o lead virou paciente/fechamento)
  conversionDatePriority?: number; // Higher = higher priority (prevents low-priority cols from overwriting)
  acquisitionChannelId?: string; // Canal de Aquisição (ex: Trafego, Organico)
  statusId?: string;
  closedValueId?: string;
  format: "A" | "B" | "C";
}

export function detectColumnMap(columns: BoardColumn[]): ColumnMap {
  const map: ColumnMap = { format: "A" };

  for (const col of columns) {
    const title = col.title.toLowerCase().trim();

    if (title === "valor fechado" || title === "valor do fechamento") {
      map.closedValueId = col.id;
      map.format = "C";
    }
    if (
      title === "valor consulta" ||
      title === "valor da consulta" ||
      title === "valor de consulta" ||
      title === "valor avaliação" ||
      title === "valor da avaliação" ||
      title === "valor avaliacao" ||
      title === "valor da avaliacao"
    ) {
      map.consultValueId = col.id;
    }
    if (
      title === "valor cirurgia" ||
      title === "valor da cirurgia" ||
      title === "valor procedimento" ||
      title === "valor do procedimento" ||
      title === "valor da cirurgia/procedimento" ||
      title === "valor implante" ||
      title === "valor do implante"
    ) {
      map.surgeryValueId = col.id;
      if (map.format !== "C") map.format = "B";
    }
    // Coluna que diz de que mês é a consulta, por prioridade (definição da
    // gestora: consulta = mês em que o lead virou paciente):
    //   3 (maior): "Data de conversão" — quando o lead converteu.
    //   2: "Data da consulta/avaliação" — dia do atendimento, se não houver a de cima.
    //   1: "Data" genérica do Monday.
    // A escolha por cliente em "Como contar vendas" vence tudo isso.
    {
      let consultPriority = 0;
      if (
        title === "data de conversao" ||
        title === "data de conversão" ||
        title === "data conversao" ||
        title === "data conversão"
      ) {
        consultPriority = 3;
      } else if (
        title === "data da consulta" ||
        title === "data consulta" ||
        title === "data de consulta" ||
        title === "data da avaliação" ||
        title === "data da avaliacao" ||
        title === "data avaliação" ||
        title === "data avaliacao"
      ) {
        consultPriority = 2;
      } else if (
        title === "data da avaliação" ||
        title === "data da avaliacao" ||
        title === "data avaliação" ||
        title === "data avaliacao"
      ) {
        // já mapeado acima com priority 2, mas garantir que "data da avaliação" seja reconhecida
        consultPriority = 2;
      } else if (title === "data") {
        consultPriority = 1;
      }
      if (consultPriority > 0 && consultPriority >= (map.consultDatePriority ?? 0)) {
        map.consultDateId = col.id;
        map.consultDatePriority = consultPriority;
      }
    }
    // Detect conversionDate column with priority system:
    // Priority 3 (highest): "Data Procedimento Fechado" / "Data do Procedimento Fechado" — confirmed procedure
    //                        "Data Fechamento" / "Data do Fechamento" / "Data de Fechamento" — commercial closing date
    //                        Typo variants from Dr Mario Bongiolo board
    // Priority 2: "Data Cirurgia" / "Data da Cirurgia" / "Data Procedimento" / "Data do Procedimento" — scheduled procedure
    // Priority 1 (lowest): generic conversion/closing column names
    {
      let priority = 0;
      if (
        title === "data procedimento fechado" ||
        title === "data do procedimento fechado" ||
        title === "data fechamento" ||     // Neo Hair / Dr Jonas Lenzi board
        title === "data de fechamento" ||
        title === "data do fechamento" ||
        title === "datac de fechamneto" || // Dr Mario Bongiolo board (typo)
        title === "data de fechamneto" ||
        title === "data fechamneto" ||
        title === "datac fechamento"
      ) {
        priority = 3;
      } else if (
        title === "data cirurgia" ||
        title === "data da cirurgia" ||
        title === "data procedimento" ||
        title === "data do procedimento"
      ) {
        priority = 2;
      } else if (
        title === "conversão" ||
        title === "conversao" ||
        title === "fechamento"
      ) {
        priority = 1;
      }
      // Note: "data conversao" is intentionally NOT mapped here — it maps to consultDate above
      // Only accept date-type columns for conversionDate (ignore text columns like "Data da Cirurgia" stored as text)
      if (priority > 0 && col.type === "date" && priority >= (map.conversionDatePriority ?? 0)) {
        map.conversionDateId = col.id;
        map.conversionDatePriority = priority;
      }
    }
    if (
      title === "canal de aquisição" ||
      title === "canal de aquisicao" ||
      title === "canal aquisição" ||
      title === "canal aquisicao" ||
      title === "canal"
    ) {
      map.acquisitionChannelId = col.id;
    }
    if (
      title === "status" ||
      title === "status do lead" ||
      title === "status lead" ||
      title === "status do cliente" ||
      title === "fechou" ||
      title === "fechado" ||
      title === "situação" ||
      title === "situacao"
    ) {
      map.statusId = col.id;
    }
  }

  return map;
}

// Value parsers

function parseNumberValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === "" || s === "null" || s === "0") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseDateValue(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === "null") return null;
  const d = new Date(s + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

function getColumnText(item: MondayItem, columnId: string): string | null {
  const cv = item.column_values.find((c) => c.id === columnId);
  if (!cv) return null;
  // Try text first (most columns expose a human-readable text)
  const text = cv.text;
  if (text && String(text).trim() && String(text).trim() !== "null") {
    return String(text).trim();
  }
  // Fallback: parse value JSON for date columns (Monday returns {"date":"YYYY-MM-DD"} or {"changed_at":"..."})
  if (cv.value && cv.value !== "null") {
    try {
      const parsed = JSON.parse(String(cv.value));
      // Date column: {"date": "2026-05-11", "time": null}
      if (parsed.date) return String(parsed.date);
      // Fallback: changed_at is the last-modified timestamp, not the actual date value — skip it
    } catch (_) {}
  }
  return null;
}

// Item parser

interface ParsedRecord {
  patientName: string;
  consultDate?: Date;
  conversionDate?: Date;
  acquisitionChannel?: string;
  consultValue: number | null;
  surgeryValue: number | null;
  closedValue: number | null;
  closed: boolean;
}

function parseItem(item: MondayItem, colMap: ColumnMap): ParsedRecord {
  const patientName = item.name || "Paciente sem nome";

  const dateText = colMap.consultDateId ? getColumnText(item, colMap.consultDateId) : null;
  // Debug: log raw column value for consultDate to diagnose parsing issues
  if (colMap.consultDateId) {
    const rawCv = item.column_values.find((c) => c.id === colMap.consultDateId);
    if (rawCv) {
      console.log(`[Monday Sync] consultDate raw for ${item.name}: text=${JSON.stringify(rawCv.text)} value=${JSON.stringify(rawCv.value)} type=${rawCv.type}`);
    }
  }
  const consultDate = parseDateValue(dateText) ?? undefined;

  const convDateText = colMap.conversionDateId ? getColumnText(item, colMap.conversionDateId) : null;
  const conversionDate = parseDateValue(convDateText) ?? undefined;

  const channelText = colMap.acquisitionChannelId ? getColumnText(item, colMap.acquisitionChannelId) : null;
  const acquisitionChannel = channelText ?? undefined;

  const consultText = colMap.consultValueId ? getColumnText(item, colMap.consultValueId) : null;
  const consultValue = parseNumberValue(consultText);

  const surgeryText = colMap.surgeryValueId ? getColumnText(item, colMap.surgeryValueId) : null;
  const surgeryValue = parseNumberValue(surgeryText);

  // Venda = data de fechamento preenchida, e só isso. Status, "compareceu"
  // ou valor de procedimento não contam: cada vendedora preenche o quadro
  // de um jeito, e a gestora quer a receita do mês em que o cliente pagou —
  // o procedimento pode ser semanas depois.
  const closed = !!conversionDate;
  const closedValText = colMap.closedValueId ? getColumnText(item, colMap.closedValueId) : null;
  const closedValue: number | null = closedValText != null ? parseNumberValue(closedValText) : null;

  return { patientName, consultDate, conversionDate, acquisitionChannel, consultValue, surgeryValue, closedValue, closed };
}

// Main sync function

export interface SyncResult {
  success: boolean;
  synced?: boolean;
  reason?: string;
  imported: number;
  skipped: number;
  closed: number;
  totalConsultas: number;
  totalCirurgias: number;
  format?: "A" | "B" | "C";
  boardName?: string;
  error?: string;
  /** Títulos das colunas que a sincronização usou (para a gestora conferir). */
  colunasUsadas?: { dataFechamento: string | null; valorVenda: string | null; dataConsulta: string | null; valorConsulta: string | null };
}

function tituloColuna(columns: BoardColumn[], id: string | undefined): string | null {
  if (!id) return null;
  return columns.find((c) => c.id === id)?.title ?? `(coluna ${id} não existe mais)`;
}

export interface SyncOptions {
  startDate?: Date;
  endDate?: Date;
}

/** Token do Monday: o da agência (system_settings) primeiro; o antigo por cliente como reserva. */
export async function obterTokenMonday(clientId: number): Promise<string | null> {
  const global = await getSystemSetting("monday_api_token");
  if (global) return global;
  const { getIntegration } = await import("./db");
  const integration = await getIntegration(clientId, "monday");
  return integration?.accessToken ?? null;
}

/**
 * Escolha da gestora, por cliente, de quais colunas do quadro valem como
 * data de fechamento e valor da venda. Fica no extraConfig da integração
 * "monday" do cliente. Sem escolha, vale a detecção pelo nome da coluna.
 */
export type ConfigMonday = {
  colunaDataFechamentoId?: string | null;
  colunaValorVendaId?: string | null;
  colunaDataConsultaId?: string | null;
  colunaValorConsultaId?: string | null;
};

export async function lerConfigMonday(clientId: number): Promise<ConfigMonday> {
  const { getIntegration } = await import("./db");
  const row = await getIntegration(clientId, "monday");
  const cfg = (row?.extraConfig ?? {}) as ConfigMonday;
  return {
    colunaDataFechamentoId: cfg.colunaDataFechamentoId ?? null, colunaValorVendaId: cfg.colunaValorVendaId ?? null,
    colunaDataConsultaId: cfg.colunaDataConsultaId ?? null, colunaValorConsultaId: cfg.colunaValorConsultaId ?? null,
  };
}

export async function salvarConfigMonday(clientId: number, cfg: ConfigMonday): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existente = await db.select({ id: integrations.id }).from(integrations)
    .where(and(eq(integrations.clientId, clientId), eq(integrations.provider, "monday"))).limit(1);
  if (existente[0]) {
    await db.update(integrations).set({ extraConfig: cfg }).where(eq(integrations.id, existente[0].id));
  } else {
    await db.insert(integrations).values({ clientId, provider: "monday", accessToken: null, extraConfig: cfg });
  }
}

/** Colunas do quadro e o que a detecção automática escolheria — para a tela de escolha. */
export async function listarColunasMonday(clientId: number, boardId: string) {
  const token = await obterTokenMonday(clientId);
  if (!token) throw new Error("Token do Monday não configurado. Salve-o em Configurações.");
  const colunas = await getBoardSchema(boardId, token);
  const detectado = detectColumnMap(colunas);
  return {
    colunas,
    detectado: {
      dataFechamentoId: detectado.conversionDateId ?? null,
      valorVendaId: detectado.closedValueId ?? detectado.surgeryValueId ?? null,
      dataConsultaId: detectado.consultDateId ?? null,
      valorConsultaId: detectado.consultValueId ?? null,
    },
  };
}

export async function syncMondayBoard(
  clientId: number,
  boardId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const token = await obterTokenMonday(clientId);

  if (!token) {
    // No token configured — return silently without error (client may not use Monday)
    return { success: false, synced: false, reason: "no_token", imported: 0, skipped: 0, closed: 0, totalConsultas: 0, totalCirurgias: 0 };
  }
  console.log(`[Monday Sync] Starting sync for client ${clientId}, board ${boardId}`);

  // 2. Get board schema
  const columns = await getBoardSchema(boardId, token);
  const colMap = detectColumnMap(columns);
  // A escolha da gestora vence a detecção pelo nome.
  const cfg = await lerConfigMonday(clientId);
  if (cfg.colunaDataFechamentoId) { colMap.conversionDateId = cfg.colunaDataFechamentoId; colMap.conversionDatePriority = 99; }
  if (cfg.colunaValorVendaId) { colMap.closedValueId = cfg.colunaValorVendaId; colMap.format = "C"; }
  if (cfg.colunaDataConsultaId) { colMap.consultDateId = cfg.colunaDataConsultaId; colMap.consultDatePriority = 99; }
  if (cfg.colunaValorConsultaId) colMap.consultValueId = cfg.colunaValorConsultaId;
  console.log(`[Monday Sync] Detected format: ${colMap.format} | conversionDateId: ${colMap.conversionDateId ?? 'NONE'} (priority: ${colMap.conversionDatePriority ?? 0}) | consultDateId: ${colMap.consultDateId ?? 'NONE'}`);
  // Debug: always log all date columns to help diagnose missing dates
  const dateCols = columns.filter(c => c.type === 'date');
  console.log(`[Monday Sync] DEBUG board ${boardId} date columns:`, dateCols.map(c => `${c.id}=${c.title}`).join(' | '));

  // 3. Fetch all items with pagination
  const allItems: MondayItem[] = [];
  let cursor: string | null | undefined;
  let pageCount = 0;

  do {
    const page = await getBoardItemsPage(boardId, token, cursor ?? undefined);
    allItems.push(...page.items);
    cursor = page.nextCursor;
    pageCount++;
    console.log(`[Monday Sync] Page ${pageCount}: ${page.items.length} items (total: ${allItems.length})`);
  } while (cursor && pageCount < 50);

  console.log(`[Monday Sync] Total items: ${allItems.length}`);

  // Log unique group names for debugging
  const uniqueGroups = Array.from(new Set(allItems.map((i) => i.group?.title ?? "(no group)")));
  console.log(`[Monday Sync] Groups in board ${boardId}: ${uniqueGroups.slice(0, 20).join(" | ")}`);

  // 4. Parse ALL records (no date filter — filtering happens at query time in getSalesForPeriod)
  // Per-client acquisition channel blocklists: exclude items whose Canal de Aquisição matches any blocked pattern
  const CLIENT_CHANNEL_BLOCKLIST: Record<number, string[]> = {
    // MAJESTIC: exclude organic/referral/non-paid channels
    120005: [
      "indicacao",
      "indicação",
      "gabriela",
      "sem fonte",
      "social selling / geovana",
      "social selling/geovana",
      "parceiro/gabi",
      "parceiro / gabi",
    ],
  };
  const channelBlocklist = CLIENT_CHANNEL_BLOCKLIST[clientId];

  // First pass: parse all items to get acquisition channels
  const filteredItems = allItems.filter((item) => {
    const groupTitle = (item.group?.title ?? "").toLowerCase();
    // Global blocklist: filter out groups containing "Recep" in the name
    if (/recep/i.test(groupTitle)) {
      return false;
    }
    // If this client has a channel blocklist, exclude items whose acquisition channel matches any blocked pattern
    if (channelBlocklist) {
      const channelText = colMap.acquisitionChannelId
        ? (item.column_values.find((c) => c.id === colMap.acquisitionChannelId)?.text ?? "").toLowerCase()
        : "";
      const blocked = channelBlocklist.some((pattern) => channelText.includes(pattern));
      if (blocked) return false;
    }
    return true;
  });
  const skippedByGroup = allItems.length - filteredItems.length;
  if (skippedByGroup > 0) {
    console.log(`[Monday Sync] Skipped ${skippedByGroup} items (channel filter: blocklist)`);
  }

  const batch = randomUUID();
  const skippedCount = skippedByGroup;

  const allParsed = filteredItems.map((item) => ({ item, parsed: parseItem(item, colMap) }));

  const records = allParsed.map(({ item, parsed }) => ({
    clientId,
    patientName: parsed.patientName,
    groupName: item.group?.title ?? null,
    consultDate: parsed.consultDate ?? null,
    conversionDate: parsed.conversionDate ?? null,
    acquisitionChannel: parsed.acquisitionChannel ?? null,
    consultValue: parsed.consultValue !== null ? String(parsed.consultValue) : null,
    surgeryValue: parsed.surgeryValue !== null ? String(parsed.surgeryValue) : null,
    closedValue: parsed.closedValue !== null ? String(parsed.closedValue) : null,
    closed: parsed.closed,
    lastUpdated: new Date(item.updated_at),
    uploadBatch: batch,
  }));

  // Deduplicação: com data de conversão, um por paciente por mês (fica o de
  // maior valor); sem ela, linhas idênticas viram uma só. Ver registrosVendas.ts.
  const deduped = new Map<string, typeof records[0]>();
  for (const rec of records) {
    const monthKey = chaveDeduplicacao(rec);
    const existing = deduped.get(monthKey);
    if (!existing) {
      deduped.set(monthKey, rec);
    } else {
      // Keep the one with higher closedValue, or if equal, more recent lastUpdated
      const existingVal = parseFloat(existing.closedValue ?? '0');
      const newVal = parseFloat(rec.closedValue ?? '0');
      if (newVal > existingVal || (newVal === existingVal && rec.lastUpdated > existing.lastUpdated)) {
        deduped.set(monthKey, rec);
      }
    }
  }
  const dedupedRecords = Array.from(deduped.values());
  if (dedupedRecords.length < records.length) {
    console.log(`[Monday Sync] Deduplication removed ${records.length - dedupedRecords.length} duplicate records`);
  }

  // Debug: log records with conversionDate
  const withConvDate = dedupedRecords.filter(r => r.conversionDate);
  console.log(`[Monday Sync] Records with conversionDate: ${withConvDate.length}`);
  withConvDate.slice(0, 5).forEach(r => console.log(`  - ${r.patientName} | ${r.conversionDate}`));
  console.log(`[Monday Sync] After filter: ${records.length} included, ${skippedCount} skipped`);

  // 5. Replace records — use raw mysql2 to ensure Date fields (conversionDate, consultDate) are persisted correctly
  // Drizzle ORM silently drops Date values in batch inserts with mysql2 driver
  const rawConn = await mysql2.createConnection(process.env.DATABASE_URL!);
  await rawConn.execute('DELETE FROM sales_records WHERE clientId = ?', [clientId]);
  if (dedupedRecords.length > 0) {
    const BATCH_SIZE = 200;
    for (let i = 0; i < dedupedRecords.length; i += BATCH_SIZE) {
      const batch = dedupedRecords.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      const values = batch.flatMap(r => [
        r.clientId,
        r.patientName,
        r.groupName ?? null,
        r.consultDate ?? null,
        r.conversionDate ?? null,
        r.acquisitionChannel ?? null,
        r.consultValue ?? null,
        r.surgeryValue ?? null,
        r.closedValue ?? null,
        r.closed ? 1 : 0,
        r.lastUpdated,
        r.uploadBatch,
      ]);
      await rawConn.execute(
        `INSERT INTO sales_records (clientId, patientName, groupName, consultDate, conversionDate, acquisitionChannel, consultValue, surgeryValue, closedValue, closed, lastUpdated, uploadBatch) VALUES ${placeholders}`,
        values
      );
    }
  }
  await rawConn.end();

  // 6. Update last sync timestamp
  await db
    .update(clients)
    .set({ mondayLastSync: new Date(), mondayBoardId: boardId })
    .where(eq(clients.id, clientId));

  const closedCount = dedupedRecords.filter((r) => r.closed).length;
  const totalConsultas = dedupedRecords.reduce((s, r) => s + (r.consultValue ? parseFloat(r.consultValue) : 0), 0);
  // totalCirurgias: soma apenas registros com closed=true (status Negócio Fechado)
  const totalCirurgias = dedupedRecords.reduce((s, r) => {
    if (!r.closed) return s; // só soma se fechado
    if (colMap.format === "C") return s + (r.closedValue ? parseFloat(r.closedValue) : 0);
    return s + (r.surgeryValue ? parseFloat(r.surgeryValue) : 0);
  }, 0);

  console.log(`[Monday Sync] Done: ${records.length} records, ${closedCount} closed`);

  return {
    success: true,
    imported: records.length,
    skipped: skippedCount,
    closed: closedCount,
    totalConsultas,
    totalCirurgias,
    format: colMap.format,
    boardName: `Board ${boardId}`,
    colunasUsadas: {
      dataFechamento: tituloColuna(columns, colMap.conversionDateId),
      valorVenda: tituloColuna(columns, colMap.format === "C" ? colMap.closedValueId : colMap.surgeryValueId),
      dataConsulta: tituloColuna(columns, colMap.consultDateId),
      valorConsulta: tituloColuna(columns, colMap.consultValueId),
    },
  };
}
