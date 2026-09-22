import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter, getSystemSetting } from "./_core/systemRouter";
import { resolverToken, CHAVE_TOKEN_AGENCIA } from "./metaTokenResolver";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { managersRouter } from "./routers/managers";
import { publicRouter } from "./routers/public";
import { aiRouter } from "./routers/ai";
import { crmRouter } from "./routers/crm";
import { leadTrackingRouter } from "./routers/leadTracking";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { verifyManagerJwt, verifyManagerOwnsClient } from "./managerAuth";
import { corpoPadrao, linkRelatorio, montarMensagemRelatorio } from "@shared/whatsappRelatorio";
import { getClientsByUserId, createClient, deleteClient, getIntegrationsByClientId,
  getIntegration, upsertIntegration, getSnapshotsByClientId,
  getSnapshotsInRange, upsertSnapshot, getDb, getClientById,
  getSalesForPeriod as getSalesForPeriodFromDb,
  getSalesUploadInfo as getSalesUploadInfoFromDb
} from "./db";
import { salesRecords, integrations, reportConfig as reportConfigTable } from "../drizzle/schema";
import { and as drizzleAnd, eq as drizzleEq, gte as drizzleGte, lte as drizzleLte } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import axios from "axios";
import crypto from "node:crypto";
import { fetchMetaAdsFromApi, fetchInstagramInsightsFromApi, fetchInstagramInsightsByIgId, validateMetaToken, listAdAccounts, listInstagramProfiles, verifyAdAccountAccess } from "./metaApi";
import { syncMondayBoard } from "./mondaySync";
import { calculateCommercialMetrics, describeRevenueSource, type RevenueSourceType } from "./kpiLineage";
import { getProfileListingToken, isPendingInstagramSelection, requireAccessibleInstagramProfile } from "./instagramOAuthSelection";
import { buildClientAdAccountIds } from "./adAccounts";
import { buildMediaLineage, getHistoricalMetaSourceConfig, shouldUseHistoricalMetaSource } from "./historicalMetaSource";

// ─── Alert Throttle (evita notificações repetidas ao recarregar o dashboard) ──
// Chave: `${clientId}:${alertType}` → timestamp do último envio
const alertThrottle = new Map<string, number>();
const ALERT_THROTTLE_MS = 24 * 60 * 60 * 1000; // 24 horas

function shouldSendAlert(clientId: number, alertType: string): boolean {
  const key = `${clientId}:${alertType}`;
  const last = alertThrottle.get(key) ?? 0;
  const now = Date.now();
  if (now - last < ALERT_THROTTLE_MS) return false;
  alertThrottle.set(key, now);
  return true;
}

// ─── Google Sheets Helper ────────────────────────────────────────────────────
// Reads a public Google Sheets CSV export and parses Meta Ads data
// Expected columns: Day, Amount Spent, Messaging Conversations Started (or similar)
// The sheet URL should be the "publish to web" CSV link or a shared sheet link

function buildCsvUrl(sheetUrl: string): string {
  // Handle different Google Sheets URL formats
  // Format 1: https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
  // Format 2: https://docs.google.com/spreadsheets/d/SHEET_ID/pub?output=csv
  // Format 3: Already a CSV export URL

  if (sheetUrl.includes("output=csv") || sheetUrl.includes(".csv")) {
    return sheetUrl;
  }

  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return sheetUrl;

  const sheetId = match[1];
  const gidMatch = sheetUrl.match(/gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseMoneyValue(val: string): number {
  if (!val) return 0;
  // Remove currency symbols and spaces
  let cleaned = val.replace(/[R$\s]/g, "").trim();
  if (!cleaned) return 0;

  // Detect format:
  // Brazilian: 1.234,56 (dot=thousands, comma=decimal)
  // International/Sheets: 1234.56 or 1,234.56 (comma=thousands, dot=decimal)
  const hasDotAndComma = cleaned.includes(".") && cleaned.includes(",");
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  if (hasDotAndComma) {
    if (lastComma > lastDot) {
      // Brazilian format: 1.234,56 → remove dots, replace comma with dot
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // International format: 1,234.56 → remove commas
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    // Only comma: could be 1234,56 (BR decimal) or 1,234 (thousands)
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Treat as decimal separator: 1234,56 → 1234.56
      cleaned = cleaned.replace(",", ".");
    } else {
      // Treat as thousands separator: 1,234 → 1234
      cleaned = cleaned.replace(/,/g, "");
    }
  }
  // If only dot: keep as-is (e.g. 108.25 is already valid float)

  return parseFloat(cleaned) || 0;
}

/**
 * Detect whether a list of slash-separated date strings uses DD/MM/YYYY or MM/DD/YYYY.
 * Strategy:
 *   1. If any first segment > 12 → must be DD/MM/YYYY.
 *   2. If any second segment > 12 → must be MM/DD/YYYY.
 *   3. If second segments are all ≤ 12 but first segments are all ≤ 12 AND
 *      second segments show more variety (sequential day-like pattern) → DD/MM/YYYY.
 *   4. Default: DD/MM/YYYY (most common in Brazilian sheets).
 */
function detectDateFormat(dates: string[]): "DD/MM/YYYY" | "MM/DD/YYYY" {
  let firstGt12 = 0, secondGt12 = 0;
  const firstVals = new Set<number>();
  const secondVals = new Set<number>();
  for (const raw of dates) {
    // Strip time portion if present (e.g. "15/05/2026 21:00:58" → "15/05/2026")
    const s = raw.replace(/"/g, "").trim().split(" ")[0];
    if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) continue;
    const parts = s.split("/");
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    if (p0 > 12) firstGt12++;
    if (p1 > 12) secondGt12++;
    firstVals.add(p0);
    secondVals.add(p1);
  }
  if (firstGt12 > 0) return "DD/MM/YYYY"; // first segment has days > 12
  if (secondGt12 > 0) return "MM/DD/YYYY"; // second segment has days > 12
  // Both segments ≤ 12: use cardinality heuristic.
  // In DD/MM/YYYY the first segment (day) varies more (up to 31 values per month)
  // than the second (month, typically 1-2 values per sheet range).
  if (firstVals.size > secondVals.size) return "DD/MM/YYYY";
  if (secondVals.size > firstVals.size) return "MM/DD/YYYY";
  // Tie: default to DD/MM/YYYY (Brazilian sheets are the norm here)
  return "DD/MM/YYYY";
}

/**
 * Parse a single date string given a known format.
 */
function parseSheetDateWithFormat(raw: string, fmt: "DD/MM/YYYY" | "MM/DD/YYYY" | "ISO"): Date | null {
  if (!raw) return null;
  // Strip time portion if present (e.g. "15/05/2026 21:00:58" → "15/05/2026")
  const s = raw.replace(/"/g, "").trim().split(" ")[0];
  if (!s) return null;
  if (fmt === "ISO" || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = s.split("/");
  let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000;
  let day: number, month: number;
  if (fmt === "DD/MM/YYYY") {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else {
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
  }
  const d = new Date(`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a date from a Google Sheets CSV cell (single-date fallback, no context).
 * Uses the > 12 heuristic only. Prefer parseSheetDateWithFormat when format is known.
 */
function parseSheetDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.replace(/"/g, "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const parts = s.split("/");
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (p0 > 12) {
      return parseSheetDateWithFormat(raw, "DD/MM/YYYY");
    }
    if (p1 > 12) {
      return parseSheetDateWithFormat(raw, "MM/DD/YYYY");
    }
    // Ambiguous — default to DD/MM/YYYY (Brazilian)
    return parseSheetDateWithFormat(raw, "DD/MM/YYYY");
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
async function fetchGoogleSheetsData(sheetUrl: string, from: string, to: string) {
  try {
    const csvUrl = buildCsvUrl(sheetUrl);
    const res = await axios.get(csvUrl, {
      timeout: 15000,
      responseType: "text",
      headers: { "Accept": "text/csv,text/plain,*/*" },
    });

    const lines = (res.data as string).split("\n").filter((l: string) => l.trim());
    if (lines.length < 2) return null;

    // Parse header row to find column indices
    const headers = parseCsvLine(lines[0]).map((h: string) => h.toLowerCase().trim().replace(/"/g, ""));

    // Find relevant columns by common names
    const findCol = (...names: string[]) => {
      for (const name of names) {
        const idx = headers.findIndex((h: string) => h.includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const campaignIdx = findCol("campaign name", "campaign", "campanha");
    const dateIdx = findCol("day", "date", "data", "dia");
    const spendIdx = findCol("amount spent", "spend", "investimento", "gasto", "custo");
    const leadsIdx = findCol("messaging conversations started", "messaging conversations", "leads", "conversas", "messages started", "lead");
    const followersIdx = findCol("instagram follows", "instagram follow", "followers", "seguidores", "new followers", "page likes", "novos seguidores");
    const reachIdx = findCol("reach", "alcance");
    const cpcIdx = findCol("cpc (cost per link click)", "cpc", "cost per link click", "custo por clique");
    const costPerMsgIdx = findCol("cost per messaging conversation started", "cost per messaging", "custo por mensagem", "cost per result");
    const linkClicksIdx = findCol("link clicks", "link click", "cliques no link", "clicks");

    // Campaign type classifier
    // IMPORTANT: check FORMULARIO/LINK first — they have priority over WPP
    // e.g. [FORMULARIO][WPP] and (LINK FORMULARIO)(WPP) should be "formulario"
    const classifyCampaign = (name: string): "mensagens" | "visitas" | "formulario" | "outro" => {
      const n = name.toUpperCase();
      // Formulário has highest priority — even if WPP is in the name
      if (n.includes("FORMULARIO") || n.includes("FORMULÁRIO") || n.includes("LINK/FORMULARIO") || n.includes("LINK FORMULARIO")) return "formulario";
      // Visitas (seguidores)
      if (n.includes("SEGUIDORA") || n.includes("SEGUIDOR")) return "visitas";
      // Mensagens WPP
      if (n.includes("WPP") || n.includes("DIRECT") || n.includes("MAMO") || n.includes("CIRURGIA") ||
          n.includes("PROTESE") || n.includes("LIPO") || n.includes("ABDOMINOPLASTIA")) return "mensagens";
      return "outro";
    };

       const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59");
    // Detect date format from all date values in the sheet
    const allDatesForDetection = lines.slice(1).map((l: string) => {
      const c = parseCsvLine(l);
      return dateIdx !== -1 ? (c[dateIdx]?.replace(/"/g, "").trim() ?? "") : "";
    }).filter(Boolean);
    const detectedFmt = detectDateFormat(allDatesForDetection);
    // Totals
    let investimento = 0;
    let leads = 0;
    let novosSeguidores = 0;
    let alcance = 0;
    // Per campaign type
    const byType = {
      mensagens: { investimento: 0, leads: 0, custoPorMsgWeighted: 0, alcance: 0 },
      visitas:   { investimento: 0, leads: 0, custoPorMsgWeighted: 0, alcance: 0 },
      formulario:{ investimento: 0, leads: 0, custoPorMsgWeighted: 0, alcance: 0, cliques: 0 },
      outro:     { investimento: 0, leads: 0, custoPorMsgWeighted: 0, alcance: 0 },
    };
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (!cols.length) continue;
      // Skip rows with no date (totals/summary rows)
      const rawDateMeta = dateIdx !== -1 ? cols[dateIdx]?.replace(/"/g, "").trim() : "";
      if (!rawDateMeta) continue;
      const itemDateMeta = parseSheetDateWithFormat(rawDateMeta, detectedFmt);
      if (!itemDateMeta || itemDateMeta < fromDate || itemDateMeta > toDate) continue;;
      // Determine campaign type
      const campaignName = campaignIdx !== -1 ? (cols[campaignIdx]?.replace(/"/g, "").trim() ?? "") : "";
      const tipo = classifyCampaign(campaignName);

      const daySpend = spendIdx !== -1 ? parseMoneyValue(cols[spendIdx]?.replace(/"/g, "") ?? "") : 0;
      const dayLeads = leadsIdx !== -1 ? (parseInt(cols[leadsIdx]?.replace(/"/g, "").trim() ?? "0", 10) || 0) : 0;
      const dayReach = reachIdx !== -1 ? (parseInt(cols[reachIdx]?.replace(/"/g, "").trim() ?? "0", 10) || 0) : 0;
      const dayFollowers = followersIdx !== -1 ? (parseInt(cols[followersIdx]?.replace(/"/g, "").trim() ?? "0", 10) || 0) : 0;
      const costPerMsg = costPerMsgIdx !== -1 ? parseMoneyValue(cols[costPerMsgIdx]?.replace(/"/g, "") ?? "") : 0;
      const cpcVal = cpcIdx !== -1 ? parseMoneyValue(cols[cpcIdx]?.replace(/"/g, "") ?? "") : 0;
      const dayLinkClicks = linkClicksIdx !== -1 ? (parseInt(cols[linkClicksIdx]?.replace(/"/g, "").trim() ?? "0", 10) || 0) : 0;

      investimento += daySpend;
      leads += dayLeads;
      novosSeguidores += dayFollowers;
      alcance += dayReach;

      byType[tipo].investimento += daySpend;
      byType[tipo].leads += dayLeads;
      byType[tipo].alcance += dayReach;
      // Weighted: accumulate costPerMsg * dayLeads so we can divide by total leads later
      if (costPerMsg > 0 && dayLeads > 0) byType[tipo].custoPorMsgWeighted += costPerMsg * dayLeads;
      // Use direct Link Clicks if available, otherwise estimate from CPC
      if (tipo === "formulario") {
        if (dayLinkClicks > 0) {
          byType.formulario.cliques += dayLinkClicks;
        } else if (cpcVal > 0 && daySpend > 0) {
          byType.formulario.cliques += Math.round(daySpend / cpcVal);
        }
      }
    }

    // Compute derived KPIs per type
    const msg = byType.mensagens;
    const vis = byType.visitas;
    const form = byType.formulario;

    // Custo por lead (mensagens): weighted average of Cost per Messaging Conversation Started
    // = sum(costPerMsg * dayLeads) / totalLeads — mirrors how Meta Ads calculates it
    const custoPorLeadDireto = msg.leads > 0 ? msg.custoPorMsgWeighted / msg.leads : 0;
    // Custo por visita ao perfil: investimento seguidoras ÷ alcance seguidoras
    const custoPorVisita = vis.alcance > 0 ? vis.investimento / vis.alcance : 0;
    // Cliques formulário and custo por clique
    const cliquesFormulario = form.cliques;
    const custoPorClique = cliquesFormulario > 0 ? form.investimento / cliquesFormulario : 0;

    // Legacy totals (for backward compat)
    const cliquesEstimados = cliquesFormulario;

    return {
      investimento,
      leads: msg.leads, // only messaging leads
      novosSeguidores,
      alcance: vis.alcance, // only profile visit reach
      cliquesEstimados,
      custoPorClique,
      custoPorLeadDireto,
      // Split by campaign type
      campanhas: {
        mensagens: { investimento: msg.investimento, leads: msg.leads, custoPorLead: custoPorLeadDireto },
        visitas:   { investimento: vis.investimento, alcance: vis.alcance, custoPorVisita },
        formulario:{ investimento: form.investimento, cliques: cliquesFormulario, custoPorClique },
      },
    };
  } catch (err: any) {
    console.error("[Google Sheets] Error:", err?.message);
    return null;
  }
}

// ─── Sales Sheet (Google Sheets) ─────────────────────────────────────────────
// Reads a public Google Sheets CSV with columns: DATA, VENDAS, TOTAL EM VENDAS
// Date format: DD/MM/YYYY, values: R$ XX.XXX,XX (Brazilian)
async function fetchSalesSheetData(sheetUrl: string, from: string, to: string) {
  try {
    const csvUrl = buildCsvUrl(sheetUrl);
    const res = await axios.get(csvUrl, {
      timeout: 15000,
      responseType: "text",
      headers: { "Accept": "text/csv,text/plain,*/*" },
    });

    const lines = (res.data as string).split("\n").filter((l: string) => l.trim());
    if (lines.length < 2) return null;

    const headers = parseCsvLine(lines[0]).map((h: string) => h.toLowerCase().trim().replace(/"/g, ""));

    const findCol = (...names: string[]) => {
      for (const name of names) {
        const idx = headers.findIndex((h: string) => h.includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

        const dateIdx = findCol("data", "date", "dia");
    const vendasIdx = findCol("vendas", "sales", "conversoes", "conversões");
    // E-commerce format: "Total" column (not "Total em Vendas" or "Subtotal")
    // Use exact match first to avoid "subtotal" matching "total"
    const totalIdxExact = headers.findIndex(h => h === "total");
    const totalIdx = findCol("total em vendas", "total vendas", "receita", "revenue") !== -1
      ? findCol("total em vendas", "total vendas", "receita", "revenue")
      : totalIdxExact !== -1 ? totalIdxExact : findCol("total", "valor");
    // E-commerce: Status do Pagamento column for filtering
    const paymentStatusIdx = findCol("status do pagamento", "status pagamento", "pagamento", "payment status", "payment");
    // E-commerce: Número do Pedido column (each row = 1 order)
    const orderNumberIdx = findCol("número do pedido", "numero do pedido", "pedido", "order", "order number");
    const isEcommerceFormat = paymentStatusIdx !== -1 && orderNumberIdx !== -1;

    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59");
    // Detect date format from all date values in the sheet
    const allSalesDates = lines.slice(1).map((l: string) => {
      const c = parseCsvLine(l);
      return dateIdx !== -1 ? (c[dateIdx]?.replace(/"/g, "").trim() ?? "") : "";
    }).filter(Boolean);
    const salesFmt = detectDateFormat(allSalesDates);
    let vendas = 0;
    let totalEmVendas = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (!cols.length) continue;
      // Skip rows with no date (e.g. totals/summary rows at the bottom of the sheet)
      const rawDate = dateIdx !== -1 ? cols[dateIdx]?.replace(/"/g, "").trim() : "";
      if (!rawDate) continue;
      const itemDate = parseSheetDateWithFormat(rawDate, salesFmt);
      if (!itemDate || itemDate < fromDate || itemDate > toDate) continue;
      // E-commerce format: filter by payment status = "Confirmado"
      if (isEcommerceFormat && paymentStatusIdx !== -1) {
        const paymentStatus = cols[paymentStatusIdx]?.replace(/"/g, "").trim().toLowerCase() ?? "";
        if (paymentStatus !== "confirmado" && paymentStatus !== "confirmed") continue;
      }
      // Count orders: in e-commerce format each row = 1 order; in legacy format use vendasIdx
      if (isEcommerceFormat) {
        vendas += 1;
      } else if (vendasIdx !== -1) {
        vendas += parseInt(cols[vendasIdx]?.replace(/"/g, "").trim() ?? "0", 10) || 0;
      }
      if (totalIdx !== -1) {
        totalEmVendas += parseMoneyValue(cols[totalIdx]?.replace(/"/g, "") ?? "");
      }
    }

    return { vendas, totalEmVendas };
  } catch (err: any) {
    console.error("[Sales Sheet] Error:", err?.message);
    return null;
  }
}

// ─── Followers Sheet (Google Sheets) ────────────────────────────────────────
// Reads a public Google Sheets CSV with columns: Day, New Followers
async function fetchFollowersSheetData(sheetUrl: string, from: string, to: string) {
  try {
    const csvUrl = buildCsvUrl(sheetUrl);
    const res = await axios.get(csvUrl, {
      timeout: 15000,
      responseType: "text",
      headers: { "Accept": "text/csv,text/plain,*/*" },
    });

    const lines = (res.data as string).split("\n").filter((l: string) => l.trim());
    if (lines.length < 2) return null;

    const headers = parseCsvLine(lines[0]).map((h: string) => h.toLowerCase().trim().replace(/"/g, ""));
    const findCol = (...names: string[]) => {
      for (const name of names) {
        const idx = headers.findIndex((h: string) => h.includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

       const dateIdx = findCol("day", "date", "data", "dia");
    const followersIdx = findCol("new followers", "followers", "seguidores", "novos seguidores");
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59");
    // Detect date format from all date values in the sheet
    const allFollowersDates = lines.slice(1).map((l: string) => {
      const c = parseCsvLine(l);
      return dateIdx !== -1 ? (c[dateIdx]?.replace(/"/g, "").trim() ?? "") : "";
    }).filter(Boolean);
    const followersFmt = detectDateFormat(allFollowersDates);
    let novosSeguidores = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (!cols.length) continue;
      // Skip rows with no date (totals/summary rows)
      const rawDateFollowers = dateIdx !== -1 ? cols[dateIdx]?.replace(/"/g, "").trim() : "";
      if (!rawDateFollowers) continue;
      const itemDateFollowers = parseSheetDateWithFormat(rawDateFollowers, followersFmt);
      if (!itemDateFollowers || itemDateFollowers < fromDate || itemDateFollowers > toDate) continue;;
      if (followersIdx !== -1) {
        novosSeguidores += parseInt(cols[followersIdx]?.replace(/"/g, "").trim() ?? "0", 10) || 0;
      }
    }

    return { novosSeguidores };
  } catch (err: any) {
    console.error("[Followers Sheet] Error:", err?.message);
    return null;
  }
}

///// Use getSalesForPeriod from db.ts (filters by uploadedAt, not consultDate)
const getSalesForPeriod = getSalesForPeriodFromDb;
async function getSalesUploadInfo(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const allRows = await db.select().from(salesRecords)
    .where(drizzleEq(salesRecords.clientId, clientId));
  if (allRows.length === 0) return null;
  const latest = allRows.reduce((a, b) => a.uploadedAt > b.uploadedAt ? a : b);
  return { totalRecords: allRows.length, uploadedAt: latest.uploadedAt };
}

// ─── Shared KPI Fetcher (used by getKpis and generateReport) ────────────────
export async function fetchClientKpis(clientId: number, from: string, to: string, salesChannelFilter?: string | null) {
  const [metaTokenIntegrationRaw, sheetsIntegration, salesIntegration, followersIntegration, tokenAgencia] = await Promise.all([
    getIntegration(clientId, "meta_token"),
    getIntegration(clientId, "google_sheets"),
    getIntegration(clientId, "sales_sheet"),
    getIntegration(clientId, "followers_sheet"),
    getSystemSetting(CHAVE_TOKEN_AGENCIA),
  ]);

  // O token pode vir da agência; a conta de anúncio é sempre do cliente.
  const tokenMeta = resolverToken(tokenAgencia, metaTokenIntegrationRaw);
  const metaTokenIntegration = tokenMeta.token
    ? { ...(metaTokenIntegrationRaw ?? {}), accessToken: tokenMeta.token, adAccountId: tokenMeta.adAccountId }
    : metaTokenIntegrationRaw;
  let investimento = 0, leads = 0, novosSeguidores = 0, vendas = 0, totalEmVendas = 0;
  let revenueSource: RevenueSourceType = "unavailable";
  let revenueUploadedAt: Date | null = null;
  let alcance = 0, cliquesEstimados = 0, custoPorClique = 0, custoPorLeadDireto = 0;
  let campanhas: {
    mensagens: { investimento: number; leads: number; custoPorLead: number };
    visitas: { investimento: number; alcance: number; custoPorVisita: number };
    formulario: { investimento: number; cliques: number; custoPorClique: number };
    video?: { investimento: number; visualizacoes: number; custoPorVisualizacao: number };
    outros?: { investimento: number };
  } | undefined;
  let campanhasDetalhe: import('./metaApi').CampanhaDetalhe[] = [];
  let metaApiSuccess = false;
  let metaDataRef: import('./metaApi').MetaAdsData | null = null;
  const historicalMetaSource = getHistoricalMetaSourceConfig(sheetsIntegration?.extraConfig);
  const useHistoricalMetaSheet = shouldUseHistoricalMetaSource(historicalMetaSource, to);
  let usedGoogleSheetMedia = false;
  if (metaTokenIntegration?.accessToken && metaTokenIntegration?.adAccountId && !useHistoricalMetaSheet) {
    try {
      console.log(`[Meta API] Using direct token for client ${clientId}`);
      // Build list of all ad accounts (primary + additional from extraConfig)
      const extraConfig = metaTokenIntegration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null;
      const additionalAccounts = extraConfig?.additionalAccounts ?? [];
      const allAccountIds = buildClientAdAccountIds(metaTokenIntegration.adAccountId, additionalAccounts);
      if (allAccountIds.length > 1) {
        console.log(`[Meta API] Fetching ${allAccountIds.length} accounts for client ${clientId}: ${allAccountIds.join(', ')}`);
      }
      // Fetch all accounts in parallel and consolidate
      const allResults = await Promise.all(
        allAccountIds.map((accountId) =>
          fetchMetaAdsFromApi(metaTokenIntegration.accessToken!, accountId, from, to)
        )
      );
      const metaData = allResults[0];
      metaDataRef = metaData;
      for (let i = 1; i < allResults.length; i++) {
        const r = allResults[i];
        metaData.investimento += r.investimento;
        metaData.leads += r.leads;
        metaData.alcance += r.alcance;
        metaData.cliquesNoLink += r.cliquesNoLink;
        metaData.novosSeguidores += r.novosSeguidores;
        metaData.novosContatos += r.novosContatos ?? 0;
        metaData.totalContatos += r.totalContatos ?? 0;
        metaData.conversasRespondidas += r.conversasRespondidas ?? 0;
        metaData.leadsInstagram += r.leadsInstagram ?? 0;
        metaData.leadsWhatsapp += r.leadsWhatsapp ?? 0;
        if (r.mensagens) {
          metaData.mensagens = metaData.mensagens
            ? { investimento: metaData.mensagens.investimento + r.mensagens.investimento, leads: metaData.mensagens.leads + r.mensagens.leads, custoPorLead: 0 }
            : r.mensagens;
        }
        if (r.visitas) {
          metaData.visitas = metaData.visitas
            ? { investimento: metaData.visitas.investimento + r.visitas.investimento, alcance: metaData.visitas.alcance + r.visitas.alcance, custoPorVisita: 0 }
            : r.visitas;
        }
        if (r.formulario) {
          metaData.formulario = metaData.formulario
            ? { investimento: metaData.formulario.investimento + r.formulario.investimento, cliques: metaData.formulario.cliques + r.formulario.cliques, custoPorClique: 0, leads: metaData.formulario.leads + r.formulario.leads, custoPorLead: 0 }
            : r.formulario;
        }
        if (r.video) {
          metaData.video = metaData.video
            ? { investimento: metaData.video.investimento + r.video.investimento, visualizacoes: metaData.video.visualizacoes + r.video.visualizacoes, custoPorVisualizacao: 0 }
            : r.video;
        }
        if (r.outros) {
          metaData.outros = metaData.outros ? { investimento: metaData.outros.investimento + r.outros.investimento } : r.outros;
        }
        metaData.campanhasDetalhe = [...(metaData.campanhasDetalhe ?? []), ...(r.campanhasDetalhe ?? [])];
      }
      // Recalculate derived metrics after summing
      metaData.custoPorLead = metaData.leads > 0 ? metaData.investimento / metaData.leads : 0;
      metaData.custoPorClique = metaData.cliquesNoLink > 0 ? metaData.investimento / metaData.cliquesNoLink : 0;
      if (metaData.mensagens) metaData.mensagens.custoPorLead = metaData.mensagens.leads > 0 ? metaData.mensagens.investimento / metaData.mensagens.leads : 0;
      if (metaData.visitas) metaData.visitas.custoPorVisita = metaData.visitas.alcance > 0 ? metaData.visitas.investimento / metaData.visitas.alcance : 0;
      if (metaData.formulario) {
        metaData.formulario.custoPorClique = metaData.formulario.cliques > 0 ? metaData.formulario.investimento / metaData.formulario.cliques : 0;
        metaData.formulario.custoPorLead = metaData.formulario.leads > 0 ? metaData.formulario.investimento / metaData.formulario.leads : 0;
      }
      if (metaData.video) metaData.video.custoPorVisualizacao = metaData.video.visualizacoes > 0 ? metaData.video.investimento / metaData.video.visualizacoes : 0;
      investimento = metaData.investimento;
      leads = metaData.leads;
      alcance = metaData.alcance;
      cliquesEstimados = metaData.cliquesNoLink;
      custoPorClique = metaData.custoPorClique;
      custoPorLeadDireto = metaData.custoPorLead;
      campanhas = metaData.mensagens || metaData.visitas || metaData.formulario
        ? { mensagens: metaData.mensagens, visitas: metaData.visitas, formulario: metaData.formulario, video: metaData.video, outros: metaData.outros }
        : undefined;
      campanhasDetalhe = [...(metaData.campanhasDetalhe ?? [])].sort((a, b) => b.investimento - a.investimento);
      metaApiSuccess = true;
      novosSeguidores = metaData.novosSeguidores;
    } catch (apiErr: any) {
      console.error(`[Meta API] Error fetching data: ${apiErr?.message}. Falling back to sheets.`);
      metaApiSuccess = false;
    }
  }
  if (!metaApiSuccess && sheetsIntegration?.accessToken) {
    const sheetsData = await fetchGoogleSheetsData(sheetsIntegration.accessToken, from, to);
    if (sheetsData) {
      investimento = sheetsData.investimento;
      leads = sheetsData.leads;
      novosSeguidores = sheetsData.novosSeguidores;
      alcance = sheetsData.alcance ?? 0;
      cliquesEstimados = sheetsData.cliquesEstimados ?? 0;
      custoPorClique = sheetsData.custoPorClique ?? 0;
      custoPorLeadDireto = sheetsData.custoPorLeadDireto ?? 0;
      campanhas = sheetsData.campanhas;
      usedGoogleSheetMedia = true;
      if (useHistoricalMetaSheet) metaApiSuccess = true;
    }
  }
  if (salesIntegration?.accessToken) {
    const salesData = await fetchSalesSheetData(salesIntegration.accessToken, from, to);
    if (salesData) {
      vendas = salesData.vendas;
      totalEmVendas = salesData.totalEmVendas;
      revenueSource = "sales_sheet";
    }
  }
  if (!metaTokenIntegration?.accessToken && followersIntegration?.accessToken) {
    const followersData = await fetchFollowersSheetData(followersIntegration.accessToken, from, to);
    if (followersData) { novosSeguidores = followersData.novosSeguidores; }
  }
  const xlsxSales = await getSalesForPeriod(clientId, from, to, salesChannelFilter);
  let consultas = 0, totalCirurgias = 0;
  // XLSX data always takes priority over sheets/legacy data when available
  if (xlsxSales.hasData) {
    consultas = xlsxSales.consultas;
    vendas = xlsxSales.fechamentos;
    totalEmVendas = xlsxSales.totalEmVendas;
    totalCirurgias = xlsxSales.totalCirurgias ?? 0;
    revenueSource = "sales_records";
    revenueUploadedAt = (await getSalesUploadInfoFromDb(clientId))?.uploadedAt ?? null;
  }
  // If novosSeguidores is still 0 (Meta Ads API failed or no data), fallback to Instagram Insights follower_count
  if (novosSeguidores === 0) {
    try {
      // Only use instagram_oauth for igUserId — never fall back to meta_token
      // (meta_token.metaIgUserId may belong to a different client and cause data leakage)
      const igInteg = await getIntegration(clientId, "instagram_oauth");
      const igUserId = igInteg?.metaIgUserId;
      // Use meta_token first (valid token), then instagram_oauth token
      const igToken = igInteg?.accessToken || metaTokenIntegration?.accessToken;
      if (igUserId && igToken) {
        // follower_count API only supports last 30 days, and has a ~3 day data delay
        const today = new Date();
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const threeDaysAgoStr = threeDaysAgo.toISOString().substring(0, 10);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().substring(0, 10);
        // Clamp the requested range to the available window (last 30 days, up to 3 days ago)
        const followerSince = from >= thirtyDaysAgoStr ? from : thirtyDaysAgoStr;
        const followerUntil = to <= threeDaysAgoStr ? to : threeDaysAgoStr;
        if (followerSince <= followerUntil) {
          const res = await axios.get(`https://graph.facebook.com/v21.0/${igUserId}/insights`, {
            params: { metric: "follower_count", period: "day", since: followerSince, until: followerUntil, access_token: igToken },
            timeout: 20000,
          });
          const data = res.data.data ?? [];
          const found = data.find((m: { name: string }) => m.name === "follower_count");
          const sum = (found?.values ?? []).reduce((s: number, v: { value: number }) => s + (v.value ?? 0), 0);
          console.log(`[fetchClientKpis] IG follower_count fallback: igUserId=${igUserId} since=${followerSince} until=${followerUntil} sum=${sum}`);
          if (sum > 0) novosSeguidores = sum;
        } else {
          console.log(`[fetchClientKpis] IG follower_count: period ${from}-${to} outside available window, skipping`);
        }
      }
    } catch (e: any) {
      console.error(`[fetchClientKpis] IG fallback error: ${e?.message}`, e?.response?.data ? JSON.stringify(e.response.data) : '');
    }
  }
  const totalConsultas = xlsxSales?.hasData ? (xlsxSales.totalConsultas ?? 0) : 0;
  const novosContatos = metaApiSuccess ? (metaDataRef?.novosContatos ?? 0) : 0;
  const totalContatosMeta = metaApiSuccess ? (metaDataRef?.totalContatos ?? 0) : 0;
  const conversasRespondidas = metaApiSuccess ? (metaDataRef?.conversasRespondidas ?? 0) : 0;
  const leadsInstagram = metaApiSuccess ? (metaDataRef?.leadsInstagram ?? 0) : 0;
  const leadsWhatsapp = metaApiSuccess ? (metaDataRef?.leadsWhatsapp ?? 0) : 0;
  const commercialMetrics = calculateCommercialMetrics({ investimento, leads, consultas, fechamentos: vendas, totalConsultas, totalCirurgias, totalEmVendas });
  const revenueLineage = describeRevenueSource(revenueSource, revenueUploadedAt);
  const mediaLineage = buildMediaLineage(historicalMetaSource, useHistoricalMetaSheet && usedGoogleSheetMedia, metaApiSuccess && !useHistoricalMetaSheet, usedGoogleSheetMedia);
  return { investimento, leads, consultas, vendas, totalEmVendas, totalCirurgias, totalConsultas, novosSeguidores, alcance, cliquesEstimados, custoPorClique, custoPorLeadDireto, campanhas, campanhasDetalhe, novosContatos, totalContatosMeta, conversasRespondidas, leadsInstagram, leadsWhatsapp, metaApiSuccess, mediaDataAvailable: metaApiSuccess || Boolean(sheetsIntegration?.accessToken), ...commercialMetrics, revenueLineage, mediaLineage };
}

// ─── Dashboard Router ───────────────────────────────────────────────────
const dashboardRouter = router({
  getClients: protectedProcedure.query(async ({ ctx }) => {
    return getClientsByUserId(ctx.user.id);
  }),

  createClient: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return createClient({ userId: ctx.user.id, name: input.name, slug: "", active: 1 });
    }),

  deleteClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteClient(input.clientId, ctx.user.id);
    }),

  getIntegrations: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return getIntegrationsByClientId(input.clientId);
    }),

  saveIntegration: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      provider: z.enum(["google_sheets", "sales_sheet", "followers_sheet"]),
      sheetUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await upsertIntegration({
        clientId: input.clientId,
        provider: input.provider,
        accessToken: input.sheetUrl ?? null,
        adAccountId: null,
        boardId: null,
      });
      return { success: true };
    }),

  removeIntegration: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      provider: z.enum(["google_sheets", "sales_sheet", "followers_sheet"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(integrations)
        .where(drizzleAnd(
          drizzleEq(integrations.clientId, input.clientId),
          drizzleEq(integrations.provider as any, input.provider),
        ));
      return { success: true };
    }),

  clearSalesRecords: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(salesRecords)
        .where(drizzleEq(salesRecords.clientId, input.clientId));
      return { success: true };
    }),

  // ─── Meta Token Integration ───────────────────────────────────────────────
  saveMetaToken: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      accessToken: z.string(),
      adAccountId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await upsertIntegration({
        clientId: input.clientId,
        provider: "meta_token",
        accessToken: input.accessToken,
        adAccountId: input.adAccountId,
        boardId: null,
      });
      return { success: true };
    }),

  validateMetaToken: protectedProcedure
    .input(z.object({ accessToken: z.string() }))
    .mutation(async ({ input }) => {
      return validateMetaToken(input.accessToken);
    }),

  listAdAccounts: protectedProcedure
    .input(z.object({ accessToken: z.string() }))
    .mutation(async ({ input }) => {
      return listAdAccounts(input.accessToken);
    }),

  getMetaTokenStatus: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration?.accessToken) return { connected: false, adAccountId: null };
      return { connected: true, adAccountId: integration.adAccountId ?? null };
    }),

  // Verify access to a specific ad account by ID (for accounts in client BMs)
  verifyAdAccountAccess: protectedProcedure
    .input(z.object({ accessToken: z.string(), adAccountId: z.string() }))
    .mutation(async ({ input }) => {
      return verifyAdAccountAccess(input.accessToken, input.adAccountId);
    }),

  // List ad accounts using the token already saved for a client (no need to re-enter token)
  listAdAccountsForClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration?.accessToken) throw new Error("Token Meta não configurado para este cliente");
      return listAdAccounts(integration.accessToken);
    }),

  // Update only the ad account ID for a client (token stays the same)
  updateClientAdAccount: protectedProcedure
    .input(z.object({ clientId: z.number(), adAccountId: z.string(), adAccountName: z.string().optional() }))
    .mutation(async ({ input }) => {
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration?.accessToken) throw new Error("Token Meta não configurado para este cliente");
      await upsertIntegration({
        clientId: input.clientId,
        provider: "meta_token",
        accessToken: integration.accessToken,
        adAccountId: input.adAccountId,
        boardId: null,
      });
      return { success: true };
    }),

  // Get additional ad accounts for a client
  getAdditionalAccounts: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration) return { primaryAccount: null, additionalAccounts: [] };
      const extraConfig = integration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null;
      return {
        primaryAccount: integration.adAccountId ? { id: integration.adAccountId, name: "Conta Principal" } : null,
        additionalAccounts: extraConfig?.additionalAccounts ?? [],
      };
    }),

  // Add an additional ad account to a client
  addAdditionalAccount: protectedProcedure
    .input(z.object({ clientId: z.number(), accountId: z.string(), accountName: z.string() }))
    .mutation(async ({ input }) => {
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration?.accessToken) throw new Error("Token Meta não configurado para este cliente");
      const extraConfig = (integration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null) ?? {};
      const existing = extraConfig.additionalAccounts ?? [];
      if (existing.find((a) => a.id === input.accountId)) throw new Error("Conta já adicionada");
      if (integration.adAccountId === input.accountId) throw new Error("Esta é a conta principal");
      const updated = [...existing, { id: input.accountId, name: input.accountName }];
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(integrations)
        .set({ extraConfig: { ...extraConfig, additionalAccounts: updated } })
        .where(drizzleAnd(drizzleEq(integrations.clientId, input.clientId), drizzleEq(integrations.provider, "meta_token")));
      return { success: true, additionalAccounts: updated };
    }),

  // Remove an additional ad account from a client
  removeAdditionalAccount: protectedProcedure
    .input(z.object({ clientId: z.number(), accountId: z.string() }))
    .mutation(async ({ input }) => {
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration) throw new Error("Integração não encontrada");
      const extraConfig = (integration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null) ?? {};
      const updated = (extraConfig.additionalAccounts ?? []).filter((a) => a.id !== input.accountId);
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(integrations)
        .set({ extraConfig: { ...extraConfig, additionalAccounts: updated } })
        .where(drizzleAnd(drizzleEq(integrations.clientId, input.clientId), drizzleEq(integrations.provider, "meta_token")));
      return { success: true, additionalAccounts: updated };
    }),

  removeMetaToken: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { integrations } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new Error("DB not available");
      await drizzleDb.delete(integrations).where(
        and(eq(integrations.clientId, input.clientId), eq(integrations.provider, "meta_token"))
      );
      return { success: true };
    }),
  // List all Instagram Business profiles accessible via the client's Meta token
  listInstagramProfiles: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const [oauthIntegration, metaIntegration] = await Promise.all([
        getIntegration(input.clientId, "instagram_oauth"),
        getIntegration(input.clientId, "meta_token"),
      ]);
      const accessToken = getProfileListingToken(oauthIntegration?.accessToken, metaIntegration?.accessToken);
      if (!accessToken) throw new Error("Nenhuma autorização Meta disponível para listar perfis");
      return listInstagramProfiles(accessToken);
    }),
  // Save the selected Instagram profile for a client
  saveInstagramProfile: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      igUserId: z.string(),
      igUsername: z.string(),
    }))
    .mutation(async ({ input }) => {
      const metaToken = await getIntegration(input.clientId, "meta_token");
      const existingIg = await getIntegration(input.clientId, "instagram_oauth");
      const tokenToUse = getProfileListingToken(existingIg?.accessToken, metaToken?.accessToken);
      if (!tokenToUse) throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma autorização Meta disponível para confirmar o perfil" });
      const profiles = await listInstagramProfiles(tokenToUse);
      const selected = requireAccessibleInstagramProfile(profiles, input.igUserId);
      await upsertIntegration({
        clientId: input.clientId,
        provider: "instagram_oauth",
        accessToken: tokenToUse,
        adAccountId: null,
        boardId: null,
        metaIgUserId: selected.igUserId,
        metaIgUsername: selected.username || input.igUsername,
        extraConfig: {},
      });
      return { success: true };
    }),
  // Get the currently linked Instagram profile for a client
  getInstagramProfile: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const ig = await getIntegration(input.clientId, "instagram_oauth");
      if (!ig?.metaIgUserId) return { connected: false, pending: isPendingInstagramSelection(ig), igUserId: null, username: null, tokenExpired: false, updatedAt: null };
      // Token expires after 60 days; warn if older than 50 days
      const updatedAt = ig.updatedAt ? new Date(ig.updatedAt).toISOString() : null;
      const daysSince = updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000) : 999;
      const tokenExpired = daysSince > 60;
      const tokenWarning = daysSince > 50 && !tokenExpired;
      return { connected: true, pending: false, igUserId: ig.metaIgUserId, username: ig.metaIgUsername ?? null, tokenExpired, tokenWarning, daysSince, updatedAt };
    }),
  testIntegration: protectedProcedure
    .input(z.object({ clientId: z.number(), provider: z.enum(["google_sheets", "sales_sheet", "followers_sheet"]) }))
    .mutation(async ({ input }) => {
      const integration = await getIntegration(input.clientId, input.provider);
      if (!integration?.accessToken) return { success: false, message: "Configuração não encontrada" };

      if (input.provider === "google_sheets") {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const result = await fetchGoogleSheetsData(integration.accessToken, weekAgo, today);
        return result !== null
          ? { success: true, message: `Planilha Meta Ads conectada! Investimento: R$ ${result.investimento.toFixed(2)}` }
          : { success: false, message: "Falha ao ler planilha — verifique se a URL está correta e a planilha está pública" };
      }

      if (input.provider === "sales_sheet") {
        const today = new Date().toISOString().slice(0, 10);
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const result = await fetchSalesSheetData(integration.accessToken, monthAgo, today);
        return result !== null
          ? { success: true, message: `Planilha de Vendas conectada! ${result.vendas} vendas / R$ ${result.totalEmVendas.toFixed(2)}` }
          : { success: false, message: "Falha ao ler planilha de vendas — verifique se a URL está correta e a planilha está pública" };
      }

      if (input.provider === "followers_sheet") {
        const today = new Date().toISOString().slice(0, 10);
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const result = await fetchFollowersSheetData(integration.accessToken, monthAgo, today);
        return result !== null
          ? { success: true, message: `Planilha de Seguidores conectada! ${result.novosSeguidores} novos seguidores no último mês` }
          : { success: false, message: "Falha ao ler planilha de seguidores — verifique se a URL está correta e a planilha está pública" };
      }

      return { success: false, message: "Provider desconhecido" };
    }),

  getKpis: protectedProcedure
    .input(z.object({ clientId: z.number(), from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      const { clientId, from, to } = input;
      const clientData = await getClientById(clientId);
      const salesChannelFilter = clientData?.salesChannelFilter ?? null;
      const result = await fetchClientKpis(clientId, from, to, salesChannelFilter);
      return result;
    }),
  getTrends: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const snaps = await getSnapshotsByClientId(input.clientId, 30);
      return snaps.reverse().map((s) => ({
        date: s.snapshotDate,
        investimento: parseFloat(String(s.investimento ?? 0)),
        leads: s.leads ?? 0,
        vendas: s.vendas ?? 0,
        totalEmVendas: parseFloat(String(s.totalEmVendas ?? 0)),
      }));
    }),

  saveSnapshot: protectedProcedure
    .input(z.object({ clientId: z.number(), date: z.string() }))
    .mutation(async ({ input }) => {
      const { clientId, date } = input;
      const [sheetsIntegration, salesIntegration] = await Promise.all([
        getIntegration(clientId, "google_sheets"),
        getIntegration(clientId, "sales_sheet"),
      ]);

      let investimento = 0, leads = 0, novosSeguidores = 0, vendas = 0, totalEmVendas = 0;
      let rawMetaData: any = null;
      let rawSalesData: any = null;

      if (sheetsIntegration?.accessToken) {
        const sheetsData = await fetchGoogleSheetsData(sheetsIntegration.accessToken, date, date);
        if (sheetsData) {
          investimento = sheetsData.investimento;
          leads = sheetsData.leads;
          novosSeguidores = sheetsData.novosSeguidores;
          rawMetaData = sheetsData;
        }
      }

      if (salesIntegration?.accessToken) {
        const salesData = await fetchSalesSheetData(salesIntegration.accessToken, date, date);
        if (salesData) {
          vendas = salesData.vendas;
          totalEmVendas = salesData.totalEmVendas;
          rawSalesData = salesData;
        }
      }

      await upsertSnapshot({
        clientId,
        snapshotDate: date,
        investimento: String(investimento) as any,
        leads,
        vendas,
        totalEmVendas: String(totalEmVendas) as any,
        novosSeguidores,
        rawMetaData,
        rawMondayData: rawSalesData,
      });

      return { success: true };
    }),

  diagnoseMondayBoard: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const integration = await getIntegration(input.clientId, "monday");
      if (!integration?.accessToken || !integration.boardId) {
        return { error: "Monday não configurado" };
      }
      try {
        const query = `
          query {
            boards(ids: [${integration.boardId}]) {
              name
              columns { id title type }
              items_page(limit: 3) {
                items {
                  id
                  name
                  column_values { id text title type }
                }
              }
            }
          }
        `;
        const res = await axios.post(
          "https://api.monday.com/v2",
          { query },
          { headers: { Authorization: integration.accessToken, "Content-Type": "application/json" }, timeout: 15000 }
        );
        const board = res.data?.data?.boards?.[0];
        return {
          boardName: board?.name,
          columns: board?.columns ?? [],
          sampleItems: board?.items_page?.items ?? [],
          rawResponse: res.data,
        };
      } catch (err: any) {
        return { error: err?.response?.data ?? err.message };
      }
    }),

  generateReport: protectedProcedure
    .input(z.object({ clientId: z.number(), from: z.string(), to: z.string(), clientName: z.string() }))
    .mutation(async ({ input }) => {
      const { clientId, from, to, clientName } = input;
      // Use shared fetchClientKpis — same logic as dashboard getKpis
      const clientDataForReport = await getClientById(clientId);
      const salesChannelFilterForReport = clientDataForReport?.salesChannelFilter ?? null;
      const kpis = await fetchClientKpis(clientId, from, to, salesChannelFilterForReport);
      const { investimento, leads, novosSeguidores, alcance, cliquesEstimados, custoPorClique, custoPorLeadDireto } = kpis;
      let { vendas, totalEmVendas } = kpis;
      const consultas = kpis.consultas;
      const totalCirurgias = kpis.totalCirurgias;
      const totalConsultas = kpis.totalConsultas ?? 0;
      const hasMondayData = consultas > 0 || totalCirurgias > 0;

      // Fetch Instagram Insights if available
      let igReach = 0, igEngaged = 0, igLinkTaps = 0, igFollows = 0, igFollowers = 0, igUsername = "";
      let hasInstagram = false;
      try {
        const igInteg = await getIntegration(clientId, "instagram_oauth");
        if (igInteg?.metaIgUserId) {
          const metaTokenInteg = await getIntegration(clientId, "meta_token");
          const igToken = metaTokenInteg?.accessToken || igInteg.accessToken;
          if (igToken) {
            const igId = igInteg.metaIgUserId;
            igUsername = igInteg.metaIgUsername ?? "";
            // Daily reach
            try {
              const rRes = await axios.get(`https://graph.facebook.com/v21.0/${igId}/insights`, {
                params: { metric: "reach", period: "day", since: from, until: to, access_token: igToken }, timeout: 15000,
              });
              igReach = (rRes.data.data ?? []).find((m: { name: string }) => m.name === "reach")
                ?.values?.reduce((s: number, v: { value: number }) => s + v.value, 0) ?? 0;
            } catch { /* ignore */ }
            // Aggregate metrics (accounts_engaged, profile_links_taps, follows_and_unfollows)
            try {
              const aRes = await axios.get(`https://graph.facebook.com/v21.0/${igId}/insights`, {
                params: { metric: "accounts_engaged,profile_links_taps,follows_and_unfollows", period: "total_over_range", metric_type: "total_value", since: from, until: to, access_token: igToken }, timeout: 15000,
              });
              for (const m of (aRes.data.data ?? [])) {
                if (m.name === "accounts_engaged") igEngaged = m.values?.[0]?.value ?? 0;
                else if (m.name === "profile_links_taps") igLinkTaps = m.values?.[0]?.value ?? 0;
                else if (m.name === "follows_and_unfollows") igFollows = m.values?.[0]?.value ?? 0;
              }
            } catch { /* ignore */ }
            // Followers total count
            try {
              const fRes = await axios.get(`https://graph.facebook.com/v21.0/${igId}`, {
                params: { fields: "followers_count", access_token: igToken }, timeout: 10000,
              });
              igFollowers = fRes.data.followers_count ?? 0;
            } catch { /* ignore */ }
            hasInstagram = true;
            // novosSeguidores: use Meta Ads action_type=follow (already set from metaData.novosSeguidores)
            // igFollows from Instagram Insights is shown as a separate card only
          }
        }
      } catch { /* ignore Instagram errors in report */ }

      const taxaConversao = leads > 0 ? (consultas / leads) * 100 : 0;
      // ROAS: receita total = consultas pagas + procedimentos/cirurgias fechados
      // For e-commerce clients (planilha de vendas), totalEmVendas is used as fallback
      const roas = kpis.roas;
      const custoPorLead = kpis.custoPorLead;
      const custoPorVenda = kpis.custoPorVenda;
      const ticketMedio = kpis.ticketMedio;
      const custoPorConsulta = hasMondayData && consultas > 0 ? investimento / consultas : 0;

      const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

      // Calculate total interactions and real cost per result
      const totalInteracoes = leads + cliquesEstimados;
      const custoPorResultadoReal = totalInteracoes > 0 ? investimento / totalInteracoes : 0;

      // Build Instagram section for prompt (only include non-zero metrics)
      const igLines: string[] = [];
      if (hasInstagram) {
        if (igFollowers > 0) igLines.push(`Seguidores totais (${igUsername ? `@${igUsername}` : 'Instagram'}): ${igFollowers.toLocaleString('pt-BR')}`);
        // igFollows (follows_and_unfollows) shown separately; novosSeguidores from Meta Ads is used in main KPIs
        // Alcance orgânico removed - Instagram Insights has 3-4 day delay, unreliable for current period
        if (igEngaged > 0) igLines.push(`Contas engajadas: ${igEngaged.toLocaleString('pt-BR')}`);
        if (igLinkTaps > 0) igLines.push(`Cliques no perfil: ${igLinkTaps.toLocaleString('pt-BR')}`);
      }
            const igSection = igLines.length > 0 ? `\n${igLines.join('\n')}` : '';
      const igFormatSection = igLines.length > 0 ? `${igLines.map(l => l.replace(/:.+/, ': [n]')).join('\n')}\n` : '';
      // Load custom report config saved by ai.chat
      let customTone = "";
      let customIntroText = "";
      let customInstructions = "";
      try {
        const dbForConfig = await getDb();
        if (dbForConfig) {
          const cfgRows = await dbForConfig.select().from(reportConfigTable).where(drizzleEq(reportConfigTable.clientId, clientId)).limit(1);
          if (cfgRows.length > 0) {
            customTone = cfgRows[0].tone ?? "";
            customIntroText = cfgRows[0].introText ?? "";
            customInstructions = cfgRows[0].customInstructions ?? "";
          }
        }
      } catch { /* ignore config errors */ }
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
              content: `Você é Scarlett, gestora de tráfego pago especializada em saúde e estética. Escreva o relatório de performance como se fosse uma mensagem de WhatsApp — próxima, direta, com personalidade. Sem travessões. Sem linguagem corporativa.

ESTRUTURA OBRIGATÓRIA — siga exatamente esta ordem:

1. Primeira linha sempre: "Olá! Tudo bem?"
2. Bloco de métricas (cada uma em linha separada, omita as que forem zero ou R$ 0,00)
3. Análise em 2-3 parágrafos curtos:
   - Parágrafo 1: contextualize os números principais (volume de leads, CPL, alcance, cliques) com uma observação concreta sobre o que eles significam para o negócio do cliente
   - Parágrafo 2: comente sobre tendência das campanhas, otimizações ou o que os dados revelam sobre a estratégia (se não houver dados suficientes, fale sobre o que está sendo observado e o que vem a seguir)
   - Parágrafo 3 (opcional, use quando fizer sentido): fechamento motivador com perspectiva para o próximo período — pode usar uma metáfora leve ou emoji, mas com moderação
4. Perguntinhas (exatamente as 3 abaixo, sem alterar)

EXEMPLOS DE ANÁLISE NO ESTILO CERTO (use como referência de tom e profundidade, não copie):

Exemplo A (sem vendas registradas):
"Nesse período conseguimos gerar 81 leads com um CPL de R$19,40, mantendo um custo relativamente controlado e um bom alcance das campanhas, com mais de 51 mil pessoas impactadas. Também tivemos mais de 1.100 cliques, mostrando que os anúncios estão despertando interesse e levando pessoas para o contato.
As campanhas mais recentes já começaram a apresentar uma melhora nos custos, com conjuntos trazendo conversas mais baratas e consistentes comparado às campanhas anteriores. Isso mostra que as otimizações e ajustes realizados estão ajudando a direcionar melhor o investimento e melhorar a entrega dos anúncios.
Mesmo sem consultas e fechamentos registrados até o momento, os dados mostram que estamos conseguindo gerar interesse e movimentar o público. Agora o foco será continuar refinando as campanhas para melhorar a qualidade dos leads e aumentar o aproveitamento no atendimento."

Exemplo B (com vendas):
"Nesse início de mês, as campanhas geraram 28 leads com CPL de R$12,48, mantendo um custo saudável para geração de oportunidades. Já tivemos 2 vendas registradas no período, totalizando R$750,00 em faturamento e ROAS de 2,15. O ticket médio ficou em R$375,00 e a taxa de conversão em 7,14%, mostrando que o funil já começou a gerar resultados mesmo com poucos dias de campanha rodando.
Hoje também realizei otimizações nas campanhas para melhorar ainda mais a performance e aproveitar melhor os leads que estão entrando. Seguimos acompanhando o desempenho para aumentar o volume de oportunidades e melhorar ainda mais o aproveitamento comercial. Esse é só o comecinho do mês… agora é continuar regando essa estratégia para fazer esse girassol brilhar cada vez mais 🌻✨"

REGRAS:
- Sem "Chegou a hora do relatório", "Que período incrível", "os números vieram redondinhos" ou qualquer frase genérica de abertura
- Sem asteriscos, sem markdown, sem títulos em caixa alta
- Métricas do bloco NÃO se repetem na análise em forma de lista — só aparecem integradas ao texto quando relevante
- Se não houver dados de vendas/consultas, foque no volume de leads, CPL e alcance
${customTone && customTone !== 'profissional' ? `\nTOM PARA ESTE CLIENTE: ${customTone === 'descontraido' ? 'bem descontraído e informal' : customTone === 'motivacional' ? 'motivacional e empolgante' : customTone === 'formal' ? 'formal e profissional' : customTone}.` : ''}${customIntroText ? `\nINTRODUÇÃO PERSONALIZADA (use no lugar de "Olá! Tudo bem?"): ${customIntroText}` : ''}${customInstructions ? `\nINSTRUÇÕES ESPECIAIS (SIGA OBRIGATORIAMENTE): ${customInstructions}` : ''}

SAÍDA ESPERADA — escreva exatamente neste formato, substituindo os valores reais:
Olá! Tudo bem?
Investimento: R$ X
Leads: X
Custo por lead: R$ X
[demais métricas com valor real, uma por linha]

[Parágrafo 1 da análise — contextualize os números]

[Parágrafo 2 da análise — tendência e otimizações]

[Parágrafo 3 opcional — fechamento motivador]

✨ Perguntinhas:
1️⃣ Como você classifica a qualidade dos leads desse período? 👉 Ótimo | Mediano | Ruim | Péssimo
2️⃣ Como foi o engajamento desses leads?
3️⃣ Teve alguma objeção ou padrão que se repetiu?

ATENÇÃO: escreva os parágrafos de análise com o conteúdo real. Não escreva "[análise]" nem "[parágrafo]" literalmente — substitua pelo texto real. As perguntas devem aparecer exatamente como mostrado acima, com os emojis.`,
          },
          {
            role: "user",
            content: (() => {
              // Build data lines, omitting zero/empty values
              const lines: string[] = [];
              lines.push(`Investimento: ${fmt(investimento)}`);
              if (leads > 0) lines.push(`Leads: ${leads}`);
              if (custoPorLead > 0) lines.push(`Custo por lead: ${fmt(custoPorLead)}`);
              if (hasMondayData) {
                if (consultas > 0) lines.push(`Consultas agendadas: ${consultas}`);
                if (consultas > 0 && custoPorConsulta > 0) lines.push(`Custo por consulta: ${fmt(custoPorConsulta)}`);
                if (vendas > 0) lines.push(`Fechamentos: ${vendas}`);
                if (totalEmVendas > 0) lines.push(`Total em consultas: ${fmt(totalEmVendas)}`);
                if (totalCirurgias > 0) lines.push(`Total em fechamentos: ${fmt(totalCirurgias)}`);
              } else {
                if (vendas > 0) lines.push(`Vendas: ${vendas}`);
                if (custoPorVenda > 0) lines.push(`Custo por venda: ${fmt(custoPorVenda)}`);
                if (totalEmVendas > 0) lines.push(`Faturamento: ${fmt(totalEmVendas)}`);
              }
              if (roas > 0) lines.push(`ROAS: ${roas.toFixed(2)}`);
              if (ticketMedio > 0) lines.push(`Ticket médio: ${fmt(ticketMedio)}`);
              if (alcance > 0) lines.push(`Visitas ao perfil: ${alcance.toLocaleString('pt-BR')}`);
              if (cliquesEstimados > 0) lines.push(`Cliques em formulário: ${cliquesEstimados.toLocaleString('pt-BR')}`);
              if (custoPorClique > 0) lines.push(`Custo por clique: ${fmt(custoPorClique)}`);
              if (novosSeguidores > 0) lines.push(`Novos seguidores: ${novosSeguidores}`);
              lines.push(`Total de interações: ${totalInteracoes.toLocaleString('pt-BR')}`);
              lines.push(`Custo por resultado real: ${fmt(custoPorResultadoReal)}`);
              if (igSection) lines.push(igSection.trim());
              return `Gere o relatório do cliente "${clientName}" no período ${from} a ${to}:\n\n${lines.join('\n')}`;
            })(),
          },
        ],
      });

       const rawAnalysisContent = llmResponse.choices?.[0]?.message?.content ?? "Análise não disponível.";
       const analysis = typeof rawAnalysisContent === "string" ? rawAnalysisContent : "Análise não disponível.";

      return {
        period: { from, to },
        clientName,
        kpis: { investimento, leads, custoPorLead, taxaConversao, roas, vendas, custoPorVenda, totalEmVendas, ticketMedio, novosSeguidores, consultas, totalCirurgias, hasMondayData, custoPorConsulta, igReach, igEngaged, igLinkTaps, igFollows, igFollowers, igUsername, hasInstagram },
        analysis,
      };
    }),

  // ─── Sync All Clients ────────────────────────────────────────────────────────
  syncAllClients: protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const clients = await getClientsByUserId(ctx.user.id);
      const results: { clientId: number; clientName: string; success: boolean; error?: string }[] = [];
      for (const client of clients) {
        try {
          const [sheetsIntegration, salesIntegration, followersIntegration] = await Promise.all([
            getIntegration(client.id, "google_sheets"),
            getIntegration(client.id, "sales_sheet"),
            getIntegration(client.id, "followers_sheet"),
          ]);
          // Skip clients with no integrations configured
          if (!sheetsIntegration?.accessToken && !salesIntegration?.accessToken && !followersIntegration?.accessToken) {
            results.push({ clientId: client.id, clientName: client.name, success: false, error: "Sem planilhas configuradas" });
            continue;
          }
          // Fetch all data in parallel
          const [sheetsData, salesData, followersData] = await Promise.all([
            sheetsIntegration?.accessToken ? fetchGoogleSheetsData(sheetsIntegration.accessToken, input.from, input.to) : Promise.resolve(null),
            salesIntegration?.accessToken ? fetchSalesSheetData(salesIntegration.accessToken, input.from, input.to) : Promise.resolve(null),
            followersIntegration?.accessToken ? fetchFollowersSheetData(followersIntegration.accessToken, input.from, input.to) : Promise.resolve(null),
          ]);
          results.push({ clientId: client.id, clientName: client.name, success: true });
        } catch (err: any) {
          results.push({ clientId: client.id, clientName: client.name, success: false, error: err?.message ?? "Erro desconhecido" });
        }
      }
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success && r.error !== "Sem planilhas configuradas").length;
      const skipped = results.filter(r => r.error === "Sem planilhas configuradas").length;
      return { results, succeeded, failed, skipped, total: clients.length };
    }),

  updateWhatsapp: protectedProcedure
    .input(z.object({ clientId: z.number(), whatsappNumber: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      await db
        .update(clientsSchema)
        .set({ whatsappNumber: input.whatsappNumber || null })
        .where(drizzleEq(clientsSchema.id, input.clientId));
      return { success: true };
    }),

  // ─── Pre-paid budget toggle ───────────────────────────────────────────────
  setPrePaid: protectedProcedure
    .input(z.object({ clientId: z.number(), isPrePaid: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      await db
        .update(clientsSchema)
        .set({ isPrePaid: input.isPrePaid ? 1 : 0 })
        .where(drizzleEq(clientsSchema.id, input.clientId));
      return { success: true };
    }),
  // ─── Upload client logo to S3 ─────────────────────────────────────────────
  uploadClientLogo: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      base64: z.string(),
      mimeType: z.string().default("image/png"),
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import("./storage");
      const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1]?.split("+")[0] || "png";
      const key = `client-logos/${input.clientId}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      await db.update(clientsSchema).set({ logoUrl: url }).where(drizzleEq(clientsSchema.id, input.clientId));
      return { url };
    }),

  // ─── Update client branding (logo + brand color) ──────────────────────────
  updateClientBranding: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      logoUrl: z.string().nullable().optional(),
      brandColor: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      const updateData: Record<string, unknown> = {};
      if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
      if (input.brandColor !== undefined) updateData.brandColor = input.brandColor;
      await db
        .update(clientsSchema)
        .set(updateData)
        .where(drizzleEq(clientsSchema.id, input.clientId));
      return { success: true };
    }),

  // ─── Update client slug (friendly URL) ────────────────────────────────────
  updateClientSlug: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      const { or, eq: drizzleEqOr } = await import("drizzle-orm");
      // Check if slug is already taken by another client
      const existing = await db.select({ id: clientsSchema.id })
        .from(clientsSchema)
        .where(drizzleEqOr(clientsSchema.slug, input.slug))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== input.clientId) {
        throw new Error("Este slug já está em uso por outro cliente");
      }
      await db
        .update(clientsSchema)
        .set({ slug: input.slug })
        .where(drizzleEq(clientsSchema.id, input.clientId));
      return { success: true, slug: input.slug };
    }),

  // ─── Rotate public report token (revokes every previous link) ──────────────
  regeneratePublicReportToken: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      const publicToken = crypto.randomBytes(32).toString("hex");
      await db.update(clientsSchema)
        .set({ publicToken })
        .where(drizzleEq(clientsSchema.id, input.clientId));
      return { publicToken };
    }),

  // ─── Get / Save report theme ───────────────────────────────────────────────────
  getReportTheme: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      const client = await db.select({ reportTheme: clientsSchema.reportTheme }).from(clientsSchema).where(drizzleEq(clientsSchema.id, input.clientId)).limit(1);
      return { reportTheme: client[0]?.reportTheme ?? "dark" };
    }),
  saveReportTheme: protectedProcedure
    .input(z.object({ clientId: z.number(), reportTheme: z.enum(["dark", "light"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      await db.update(clientsSchema).set({ reportTheme: input.reportTheme }).where(drizzleEq(clientsSchema.id, input.clientId));
      return { success: true };
    }),

  // ─── Fetch ad account balance (for prepaid accounts) ─────────────────────
  saveCampaignTypes: protectedProcedure
    .input(z.object({ clientId: z.number(), campaignTypes: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      await db
        .update(clientsSchema)
        .set({ campaignTypes: JSON.stringify(input.campaignTypes) })
        .where(drizzleEq(clientsSchema.id, input.clientId));
      return { success: true };
    }),
  getCampaignTypes: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { campaignTypes: [] as string[] };
      const { clients: clientsSchema } = await import("../drizzle/schema");
      const result = await db.select({ campaignTypes: clientsSchema.campaignTypes }).from(clientsSchema).where(drizzleEq(clientsSchema.id, input.clientId)).limit(1);
      const raw = result[0]?.campaignTypes;
      try { return { campaignTypes: (raw ? JSON.parse(raw) : []) as string[] }; } catch { return { campaignTypes: [] as string[] }; }
    }),
  getAdAccountBudget: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration?.accessToken || !integration?.adAccountId) {
        return { available: false, balance: null, amountSpent: null, spendCap: null, currency: "BRL" };
      }
      const { fetchAdAccountBudget } = await import("./metaApi");
      const budget = await fetchAdAccountBudget(integration.accessToken, integration.adAccountId);
      if (!budget) return { available: false, balance: null, amountSpent: null, spendCap: null, currency: "BRL" };
      return { available: true, ...budget };
    }),

  // ─── Check all prepaid clients and send Telegram alert if balance < threshold ─
  checkAllBudgets: protectedProcedure
    .input(z.object({ threshold: z.number().default(100) }))
    .mutation(async ({ input }) => {
      const { ENV } = await import("./_core/env");
      const { fetchAdAccountBudget } = await import("./metaApi");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsSchema } = await import("../drizzle/schema");
      const { eq: drizzleEqLocal } = await import("drizzle-orm");
      const allClients = await db.select().from(clientsSchema).where(drizzleEqLocal(clientsSchema.isPrePaid, 1));
      const alerts: Array<{ name: string; balance: number; currency: string }> = [];
      for (const client of allClients) {
        const integration = await getIntegration(client.id, "meta_token");
        if (!integration?.accessToken || !integration?.adAccountId) continue;
        const budget = await fetchAdAccountBudget(integration.accessToken, integration.adAccountId);
        if (!budget) continue;
        if (budget.balance <= input.threshold) {
          alerts.push({ name: client.name, balance: budget.balance, currency: budget.currency });
        }
      }
      if (alerts.length > 0 && ENV.telegramBotToken && ENV.telegramChatId) {
        const lines = alerts.map(a =>
          `⚠️ *${a.name}*\nSaldo restante: R$ ${a.balance.toFixed(2)}`
        ).join("\n\n");
        const text = `🚨 *Alerta de Saldo Baixo*\n\n${lines}\n\n_Recarregue antes que as campanhas pausem!_`;
        await axios.post(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
          chat_id: ENV.telegramChatId,
          text,
          parse_mode: "Markdown",
        });
      }
      return { checked: allClients.length, alerts: alerts.length, details: alerts };
    }),

  // ─── Refine report text with AI instruction ───────────────────────────────
  refineReport: protectedProcedure
    .input(z.object({
      currentText: z.string(),
      instruction: z.string().min(1).max(500),
    }))
    .mutation(async ({ input }) => {
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é uma gestora de tráfego pago chamada Scarlett. Reescreva o relatório abaixo aplicando a instrução da usuária, mantendo o seu jeitinho: leve, animado, caloroso e próximo, como se fosse uma mensagem de voz transcrita para texto.

REGRAS OBRIGATÓRIAS:
- NUNCA copie literalmente frases ou expressões da instrução da usuária no texto do relatório. Use as informações como contexto e reescreva com suas próprias palavras.
- Se a instrução pedir um tom (ex: "mais animado", "mais informal"), aplique esse tom em todo o texto narrativo de forma natural, sem forçar.
- Se a instrução adicionar dados novos (ex: "25 preenchimentos, mas só 4 viraram consulta"), incorpore-os no texto de forma integrada e natural.
- NUNCA exiba bloco de dados brutos. As métricas já estão nas linhas do relatório.
- Mantenha o mesmo formato e estrutura do relatório original (métricas em linhas separadas, parágrafos narrativos, perguntinhas no final).
- Não use travões, asteriscos ou markdown.
- Retorne APENAS o texto do relatório ajustado, sem explicações, sem prefácio, sem comentários.`,
          },
          {
            role: "user",
            content: `INSTRUÇÃO DA USUÁRIA: ${input.instruction}\n\nRELATÓRIO ATUAL (reescreva aplicando a instrução acima):\n${input.currentText}`,
          },
        ],
      });
      const raw = llmResponse.choices?.[0]?.message?.content ?? input.currentText;
      const refined = typeof raw === "string" ? raw : input.currentText;
      return { analysis: refined };
    }),

  // ── Get active ad creatives for a client ─────────────────────────────────────────────
  getCreatives: protectedProcedure
    .input(z.object({ clientId: z.number(), from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      const { fetchActiveCreatives } = await import("./metaApi");
      const metaInteg = await getIntegration(input.clientId, "meta_token");
      if (!metaInteg?.accessToken || !metaInteg?.adAccountId) {
        return { creatives: [], error: "meta_not_configured" };
      }
      // Build list of all ad accounts (primary + additional from extraConfig)
      const extraConfig = metaInteg.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null;
      const additionalAccounts = extraConfig?.additionalAccounts ?? [];
      const primaryIds = metaInteg.adAccountId.includes(",")
        ? metaInteg.adAccountId.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [metaInteg.adAccountId];
      const allAccountIds = [...primaryIds, ...additionalAccounts.map((a) => a.id)];
      // Fetch from all ad accounts and merge
      const results = await Promise.all(
        allAccountIds.map((accountId: string) =>
          fetchActiveCreatives(metaInteg.accessToken!, accountId, input.from, input.to)
        )
      );
      const creatives = results.flat().sort((a, b) => b.spend - a.spend);
      return { creatives, error: null };
    }),
});
// ─── Instagram Router ───────────────────────────────────────────────────────
const instagramRouter = router({
  getOAuthUrl: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = await getClientById(input.clientId);
      if (!client || client.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado a este cliente" });
      }
      const { buildMetaOAuthUrl } = await import("./metaOAuth");
      return { url: await buildMetaOAuthUrl(input.clientId) };
    }),

  getOAuthUrlAsManager: publicProcedure
    .input(z.object({ clientId: z.number(), token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { managerId } = await verifyManagerOwnsClient(input.token, input.clientId);
      const { buildMetaOAuthUrl } = await import("./metaOAuth");
      return { url: await buildMetaOAuthUrl(input.clientId, managerId) };
    }),

  getConnection: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const ig = await getIntegration(input.clientId, "instagram_oauth");
      if (!ig || !ig.accessToken) return { connected: false, username: null, igUserId: null };
      return { connected: true, username: ig.metaIgUsername ?? null, igUserId: ig.metaIgUserId ?? null };
    }),

  disconnect: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { integrations } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new Error("DB not available");
      await drizzleDb.delete(integrations).where(
        and(eq(integrations.clientId, input.clientId), eq(integrations.provider, "instagram_oauth"))
      );
      return { success: true };
    }),

  getInsights: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      since: z.string(),
      until: z.string(),
    }))
    .query(async ({ input }) => {
      const ig = await getIntegration(input.clientId, "instagram_oauth");
      console.log(`[getInsights] clientId=${input.clientId} ig=${ig ? 'found' : 'null'} metaIgUserId=${ig?.metaIgUserId ?? 'none'}`);
      if (!ig || !ig.metaIgUserId) {
        return { connected: false, username: null, totalFollowers: 0, totals: null, daily: null };
      }
      // Prefer instagram_oauth token (has instagram_manage_insights permission)
      // Fall back to meta_token only if instagram_oauth token is missing
      const metaTokenInteg = await getIntegration(input.clientId, "meta_token");
      const token = ig.accessToken || metaTokenInteg?.accessToken;
      const tokenSource = ig.accessToken ? 'instagram_oauth' : (metaTokenInteg ? 'meta_token' : 'NONE');
      console.log(`[getInsights] token source: ${tokenSource} token=${token ? token.substring(0,20)+'...' : 'NONE'}`);
      if (!token) {
        return { connected: false, username: null, totalFollowers: 0, totals: null, daily: null };
      }
      const igId = ig.metaIgUserId;
      console.log(`[getInsights] Fetching metrics for igId=${igId} since=${input.since} until=${input.until}`);

      // ── Instagram Insights API v21+ ────────────────────────────────────────────────
      // API behavior discovered through testing (validated against Meta Business Suite):
      //   - reach: use metric_type=total_value → returns correct total matching Meta BS
      //     (reach+daily sums to ~2x the actual reach due to deduplication)
      //   - follower_count: returns daily new followers array (no metric_type, last 30 days only)
      //   - views, profile_views, website_clicks, total_interactions, accounts_engaged:
      //     require metric_type=total_value → return only a single total, no daily breakdown
      // IMPORTANT: API limit = max 30 days per request. For longer periods, we chunk into
      // 29-day windows and aggregate results.
      // Strategy: for reach, fetch with total_value per chunk and build daily chart from chunk totals.
      // For total-only metrics, fetch the total and spread as a single data point for the chart.
      type DailyPoint = { date: string; value: number };

      // Split a date range into chunks of at most 29 days (API limit is 30 days)
      const splitIntoChunks = (since: string, until: string): Array<{since: string; until: string}> => {
        const chunks: Array<{since: string; until: string}> = [];
        let start = new Date(since);
        const end = new Date(until);
        while (start <= end) {
          const chunkEnd = new Date(start);
          chunkEnd.setDate(chunkEnd.getDate() + 28); // 29-day window (0..28 = 29 days)
          if (chunkEnd > end) chunkEnd.setTime(end.getTime());
          chunks.push({
            since: start.toISOString().substring(0, 10),
            until: chunkEnd.toISOString().substring(0, 10),
          });
          start = new Date(chunkEnd);
          start.setDate(start.getDate() + 1);
        }
        return chunks;
      };

      const dateChunks = splitIntoChunks(input.since, input.until);
      console.log(`[getInsights] Date chunks: ${dateChunks.length} (${input.since} to ${input.until})`);

      // Fetch metrics that return daily values array (old-style, no metric_type needed)
      // Automatically chunks requests if period > 29 days
      const fetchDailyMetric = async (metricName: string): Promise<DailyPoint[]> => {
        const allPoints: DailyPoint[] = [];
        for (const chunk of dateChunks) {
          try {
            const res = await axios.get(`https://graph.facebook.com/v21.0/${igId}/insights`, {
              params: { metric: metricName, period: "day", since: chunk.since, until: chunk.until, access_token: token },
              timeout: 20000,
            });
            const data = res.data.data ?? [];
            const found = data.find((m: { name: string }) => m.name === metricName);
            if (found?.values) {
              const points = found.values.map((v: { value: number; end_time: string }) => ({
                date: v.end_time.substring(0, 10),
                value: v.value ?? 0,
              }));
              allPoints.push(...points);
            }
          } catch (e: unknown) {
            const axiosErr = e as { response?: { data?: unknown } };
            if (axiosErr.response?.data) console.error(`[Instagram Insights] ${metricName} chunk ${chunk.since}-${chunk.until}:`, JSON.stringify(axiosErr.response.data));
          }
        }
        return allPoints;
      };

      // Fetch metrics that only return a total (metric_type=total_value required)
      // Automatically chunks requests if period > 29 days and sums the totals
      const fetchTotalMetric = async (metricName: string): Promise<number> => {
        let total = 0;
        for (const chunk of dateChunks) {
          try {
            const res = await axios.get(`https://graph.facebook.com/v21.0/${igId}/insights`, {
              params: { metric: metricName, period: "day", metric_type: "total_value", since: chunk.since, until: chunk.until, access_token: token },
              timeout: 20000,
            });
            const data = res.data.data ?? [];
            const found = data.find((m: { name: string }) => m.name === metricName);
            total += found?.total_value?.value ?? 0;
          } catch (e: unknown) {
            const axiosErr = e as { response?: { data?: unknown } };
            if (axiosErr.response?.data) console.error(`[Instagram Insights] ${metricName} chunk ${chunk.since}-${chunk.until}:`, JSON.stringify(axiosErr.response.data));
          }
        }
        return total;
      };

      // follower_count API limitation: only supports periods within the last 30 days from today.
      // Strategy: if the selected period is within the last 30 days, use it directly.
      // Otherwise, fall back to the last 30 days available.
      const today = new Date();
      const todayStr = today.toISOString().substring(0, 10);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().substring(0, 10);
      // Use the selected period if it's within the last 30 days, otherwise use last 30 days
      const followerSince = input.since >= thirtyDaysAgoStr ? input.since : thirtyDaysAgoStr;
      const followerUntil = input.until <= todayStr ? input.until : todayStr;

      const fetchFollowerCount = async (): Promise<DailyPoint[]> => {
        try {
          const res = await axios.get(`https://graph.facebook.com/v21.0/${igId}/insights`, {
            params: { metric: "follower_count", period: "day", since: followerSince, until: followerUntil, access_token: token },
            timeout: 20000,
          });
          const data = res.data.data ?? [];
          const found = data.find((m: { name: string }) => m.name === "follower_count");
          if (!found?.values) return [];
          return found.values.map((v: { value: number; end_time: string }) => ({
            date: v.end_time.substring(0, 10),
            value: v.value ?? 0,
          }));
        } catch (e: unknown) {
          const axiosErr = e as { response?: { data?: unknown } };
          if (axiosErr.response?.data) console.error(`[Instagram Insights] follower_count:`, JSON.stringify(axiosErr.response.data));
          return [];
        }
      };

      // For reach: fetch total_value per chunk, then build a pseudo-daily array from chunk totals
      // This matches Meta Business Suite values (daily sum double-counts deduplicated reach)
      const fetchReachByChunks = async (): Promise<DailyPoint[]> => {
        const points: DailyPoint[] = [];
        for (const chunk of dateChunks) {
          try {
            const res = await axios.get(`https://graph.facebook.com/v21.0/${igId}/insights`, {
              params: { metric: "reach", period: "day", metric_type: "total_value", since: chunk.since, until: chunk.until, access_token: token },
              timeout: 20000,
            });
            const data = res.data.data ?? [];
            const found = data.find((m: { name: string }) => m.name === "reach");
            const val = found?.total_value?.value ?? 0;
            if (val > 0) points.push({ date: chunk.until, value: val });
          } catch (e: unknown) {
            const axiosErr = e as { response?: { data?: unknown } };
            if (axiosErr.response?.data) console.error(`[Instagram Insights] reach chunk ${chunk.since}-${chunk.until}:`, JSON.stringify(axiosErr.response.data));
          }
        }
        return points;
      };

      const [dailyReach, dailyFollowerCount, totalViews, totalProfileViews, totalInteractions] =
        await Promise.all([
          fetchReachByChunks(),  // reach with total_value per chunk (matches Meta Business Suite)
          fetchFollowerCount(),  // always last 30 days (API limitation)
          fetchTotalMetric("views"),
          fetchTotalMetric("profile_views"),
          fetchTotalMetric("total_interactions"),  // total_interactions matches Meta BS better than accounts_engaged
        ]);

      // ── Followers count (profile total) ────────────────────────────────────────
      let totalFollowers = 0;
      try {
        const fRes = await axios.get(`https://graph.facebook.com/v21.0/${igId}`, {
          params: { fields: "followers_count", access_token: token }, timeout: 10000,
        });
        totalFollowers = fRes.data.followers_count ?? 0;
      } catch { /* ignore */ }

      // For total-only metrics, create a single data point at the end date for the chart
      const totalAsDaily = (total: number): DailyPoint[] =>
        total > 0 ? [{ date: input.until, value: total }] : [];

      // ── Compute totals ─────────────────────────────────────────────────────────
      const sumArr = (arr: DailyPoint[]) => arr.reduce((s, v) => s + v.value, 0);
      // follower_count gives daily new followers; sum = total new followers in period
      const totalNewFollowers = sumArr(dailyFollowerCount);
      // reach: sum of chunk totals (each chunk has total_value, not daily points)
      const totalReach = sumArr(dailyReach);

      // ── Build byMetric map ───────────────────────────────────────────
      const byMetric: Record<string, DailyPoint[]> = {
        views: totalAsDaily(totalViews),
        reach: dailyReach,  // chunk-level totals used as chart points
        profile_views: totalAsDaily(totalProfileViews),
        follows_and_unfollows: dailyFollowerCount,       // daily new followers
        accounts_engaged: totalAsDaily(totalInteractions),  // total_interactions
      };

      console.log(`[getInsights] Results: views=${totalViews} reach=${totalReach} profileViews=${totalProfileViews} newFollowers=${totalNewFollowers} interactions=${totalInteractions}`);

      return {
        connected: true,
        username: ig.metaIgUsername ?? null,
        totalFollowers,
        totals: {
          impressions: totalViews,
          reach: totalReach,
          profileViews: totalProfileViews,
          interactions: totalInteractions,
          newFollowers: totalNewFollowers,
        },
        daily: byMetric,
      };
    }),
});
// ─── Sales Router ──────────────────────────────────────────────────
const salesRouter = router({
  getForPeriod: protectedProcedure
    .input(z.object({ clientId: z.number(), from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      return getSalesForPeriod(input.clientId, input.from, input.to);
    }),
  getUploadInfo: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return getSalesUploadInfo(input.clientId);
    }),
  // Manager version (uses JWT token)
  getForPeriodAsManager: publicProcedure
    .input(z.object({ clientId: z.number(), from: z.string(), to: z.string(), managerToken: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.managerToken, input.clientId);
      return getSalesForPeriod(input.clientId, input.from, input.to);
    }),
  getUploadInfoAsManager: publicProcedure
    .input(z.object({ clientId: z.number(), managerToken: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.managerToken, input.clientId);
      return getSalesUploadInfo(input.clientId);
    }),
  // Admin version (uses session cookie via protectedProcedure)
  getUploadInfoAsAdmin: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return getSalesUploadInfo(input.clientId);
    }),
});

// ─── Monday Router ───────────────────────────────────────────────
const mondayRouter = router({
  // Sync board data for a client (admin)
  syncBoard: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      boardId: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // syncMondayBoard already handles token lookup (global system_settings first, then per-client fallback)
      return syncMondayBoard(input.clientId, input.boardId, {
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }),
  // Sync board data for a client (manager via JWT)
  syncBoardAsManager: publicProcedure
    .input(z.object({
      clientId: z.number(),
      boardId: z.string(),
      managerToken: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.managerToken, input.clientId);
      // syncMondayBoard already handles token lookup (global system_settings first, then per-client fallback)
      return syncMondayBoard(input.clientId, input.boardId, {
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }),
  // Save board ID for a client (admin)
  saveBoardId: protectedProcedure
    .input(z.object({ clientId: z.number(), boardId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsTable } = await import("../drizzle/schema");
      const { eq: drizzleEqLocal } = await import("drizzle-orm");
      await db.update(clientsTable)
        .set({ mondayBoardId: input.boardId })
        .where(drizzleEqLocal(clientsTable.id, input.clientId));
      return { success: true };
    }),
  // Save board ID for a client (manager via JWT)
  saveBoardIdAsManager: publicProcedure
    .input(z.object({ clientId: z.number(), boardId: z.string(), managerToken: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.managerToken, input.clientId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsTable } = await import("../drizzle/schema");
      const { eq: drizzleEqLocal } = await import("drizzle-orm");
      await db.update(clientsTable)
        .set({ mondayBoardId: input.boardId })
        .where(drizzleEqLocal(clientsTable.id, input.clientId));
      return { success: true };
    }),
  // Get board ID and last sync for a client (admin)
  getStatus: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { boardId: null, lastSync: null };
      const { clients: clientsTable } = await import("../drizzle/schema");
      const { eq: drizzleEqLocal } = await import("drizzle-orm");
      const rows = await db.select({
        mondayBoardId: clientsTable.mondayBoardId,
        mondayLastSync: clientsTable.mondayLastSync,
      }).from(clientsTable).where(drizzleEqLocal(clientsTable.id, input.clientId)).limit(1);
      const row = rows[0];
      return { boardId: row?.mondayBoardId ?? null, lastSync: row?.mondayLastSync ?? null };
    }),
  // Get board ID and last sync for a client (manager via JWT)
  getStatusAsManager: publicProcedure
    .input(z.object({ clientId: z.number(), managerToken: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.managerToken, input.clientId);
      const db = await getDb();
      if (!db) return { boardId: null, lastSync: null, hasToken: false };
      const { clients: clientsTable, integrations: integrationsTable } = await import("../drizzle/schema");
      const { eq: drizzleEqLocal, and: drizzleAndLocal } = await import("drizzle-orm");
      const rows = await db.select({
        mondayBoardId: clientsTable.mondayBoardId,
        mondayLastSync: clientsTable.mondayLastSync,
      }).from(clientsTable).where(drizzleEqLocal(clientsTable.id, input.clientId)).limit(1);
      const row = rows[0];
      // Check if monday token exists
      const integRows = await db.select({ accessToken: integrationsTable.accessToken })
        .from(integrationsTable)
        .where(drizzleAndLocal(drizzleEqLocal(integrationsTable.clientId, input.clientId), drizzleEqLocal(integrationsTable.provider, "monday")))
        .limit(1);
      const hasToken = !!(integRows[0]?.accessToken);
      return { boardId: row?.mondayBoardId ?? null, lastSync: row?.mondayLastSync ?? null, hasToken };
    }),

  // Auto-sync: called when opening a client report — syncs if token+boardId configured
  // Returns { synced: true, ... } if sync happened, { synced: false } if not configured
  autoSync: publicProcedure
    .input(z.object({ clientId: z.number(), managerToken: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await verifyManagerOwnsClient(input.managerToken, input.clientId);
      } catch {
        return { synced: false, reason: "unauthorized" };
      }
      const db = await getDb();
      if (!db) return { synced: false, reason: "db_unavailable" };
      const { clients: clientsTable, integrations: integrationsTable } = await import("../drizzle/schema");
      const { eq: eqLocal, and: andLocal } = await import("drizzle-orm");
      // Check if client has boardId
      const clientRows = await db.select({ mondayBoardId: clientsTable.mondayBoardId })
        .from(clientsTable).where(eqLocal(clientsTable.id, input.clientId)).limit(1);
      const boardId = clientRows[0]?.mondayBoardId;
      if (!boardId) return { synced: false, reason: "no_board_id" };
      // Check if client has monday token
      const integRows = await db.select({ accessToken: integrationsTable.accessToken })
        .from(integrationsTable)
        .where(andLocal(eqLocal(integrationsTable.clientId, input.clientId), eqLocal(integrationsTable.provider, "monday")))
        .limit(1);
      if (!integRows[0]?.accessToken) return { synced: false, reason: "no_token" };
      // Sync!
      try {
        const result = await syncMondayBoard(input.clientId, boardId);
        return { synced: true, ...result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { synced: false, reason: "sync_error", error: msg };
      }
    }),

  // Sync all clients that have monday token + boardId (admin only)
  syncAll: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsTable, integrations: integrationsTable } = await import("../drizzle/schema");
      const { isNotNull } = await import("drizzle-orm");
      // Get all clients with a boardId
      const clientsWithBoard = await db.select({ id: clientsTable.id, name: clientsTable.name, mondayBoardId: clientsTable.mondayBoardId })
        .from(clientsTable)
        .where(isNotNull(clientsTable.mondayBoardId));
      // Get all monday integrations
      const allIntegrations = await db.select({ clientId: integrationsTable.clientId, accessToken: integrationsTable.accessToken })
        .from(integrationsTable)
        .where(isNotNull(integrationsTable.accessToken));
      const tokenMap = new Map(allIntegrations.map(i => [i.clientId, i.accessToken]));
      const results: { clientId: number; name: string; status: string; imported?: number }[] = [];
      for (const client of clientsWithBoard) {
        if (!client.mondayBoardId) continue;
        const hasToken = tokenMap.has(client.id);
        if (!hasToken) {
          results.push({ clientId: client.id, name: client.name, status: "no_token" });
          continue;
        }
        try {
          const r = await syncMondayBoard(client.id, client.mondayBoardId);
          results.push({ clientId: client.id, name: client.name, status: "ok", imported: r.imported });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ clientId: client.id, name: client.name, status: "error: " + msg });
        }
      }
      return { results, total: results.length, synced: results.filter(r => r.status === "ok").length };
    }),
});

// ─── WhatsApp Router ─────────────────────────────────────────────
/**
 * Monta e envia a mensagem de relatório do cliente. Compartilhado pelas
 * rotas de admin e de gestor para as duas não divergirem (antes eram duas
 * cópias, e as duas mandavam o slug em vez do token público — link quebrado).
 */
async function enviarRelatorioDoCliente(input: { clientId: number; from: string; to: string; reportText?: string; origin: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { clients: clientsTable } = await import("../drizzle/schema");
  const rows = await db.select({
    name: clientsTable.name,
    publicToken: clientsTable.publicToken,
    whatsappGroupId: clientsTable.whatsappGroupId,
  }).from(clientsTable).where(drizzleEq(clientsTable.id, input.clientId)).limit(1);
  const client = rows[0];
  if (!client) throw new Error("Cliente não encontrado");
  if (!client.whatsappGroupId) throw new Error("Grupo de WhatsApp não configurado para este cliente");
  if (!client.publicToken) throw new Error("Este cliente não tem link público — gere um nas configurações do cliente");
  const link = linkRelatorio(input.origin, client.publicToken, input.from, input.to);
  const message = montarMensagemRelatorio({ clienteNome: client.name, from: input.from, to: input.to, texto: input.reportText }, link);
  const { sendGroupMessage } = await import("./zapApi");
  const r = await sendGroupMessage(client.whatsappGroupId, message);
  if (!r.success) throw new Error(r.error || "O Z-API não aceitou a mensagem");
  return { success: true as const, message };
}

const envioInput = z.object({
  clientId: z.number(),
  from: z.string(),
  to: z.string(),
  reportText: z.string().max(4000).optional(),
  origin: z.string().url(),
});

const whatsappRouter = router({
  // Get Z-API connection status (admin)
  getStatus: protectedProcedure
    .query(async () => {
      const { checkStatus } = await import("./zapApi");
      return checkStatus();
    }),

  // Status para a gestora: existe configuração? o celular está pareado?
  statusAsManager: publicProcedure
    .input(z.object({ managerToken: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerJwt(input.managerToken);
      const { checkStatus } = await import("./zapApi");
      return checkStatus();
    }),

  // List all WhatsApp groups available in the Z-API instance (admin)
  listGroups: protectedProcedure
    .query(async () => {
      const { listGroups } = await import("./zapApi");
      return listGroups();
    }),

  // Idem para a gestora. Exige o JWT: a lista de grupos da agência não é pública.
  listGroupsAsManager: publicProcedure
    .input(z.object({ managerToken: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerJwt(input.managerToken);
      const { listGroups } = await import("./zapApi");
      return listGroups();
    }),

  // Save WhatsApp group ID for a client (admin)
  saveGroupId: protectedProcedure
    .input(z.object({ clientId: z.number(), groupId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsTable } = await import("../drizzle/schema");
      await db.update(clientsTable)
        .set({ whatsappGroupId: input.groupId || null })
        .where(drizzleEq(clientsTable.id, input.clientId));
      return { success: true };
    }),

  // Save WhatsApp group ID for a client (manager via JWT)
  saveGroupIdAsManager: publicProcedure
    .input(z.object({ clientId: z.number(), groupId: z.string(), managerToken: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.managerToken, input.clientId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsTable } = await import("../drizzle/schema");
      await db.update(clientsTable)
        .set({ whatsappGroupId: input.groupId || null })
        .where(drizzleEq(clientsTable.id, input.clientId));
      return { success: true };
    }),

  // Prévia do que vai ser enviado, para a gestora ler e ajustar antes.
  previewReportAsManager: publicProcedure
    .input(z.object({ clientId: z.number(), from: z.string(), to: z.string(), origin: z.string().url(), managerToken: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.managerToken, input.clientId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { clients: clientsTable } = await import("../drizzle/schema");
      const rows = await db.select({ name: clientsTable.name, publicToken: clientsTable.publicToken, whatsappGroupId: clientsTable.whatsappGroupId })
        .from(clientsTable).where(drizzleEq(clientsTable.id, input.clientId)).limit(1);
      const client = rows[0];
      if (!client) throw new Error("Cliente não encontrado");
      return {
        corpo: corpoPadrao({ from: input.from, to: input.to }),
        link: client.publicToken ? linkRelatorio(input.origin, client.publicToken, input.from, input.to) : null,
        grupoConfigurado: !!client.whatsappGroupId,
      };
    }),

  // Send report link to WhatsApp group (admin)
  sendReport: protectedProcedure
    .input(envioInput)
    .mutation(async ({ input }) => enviarRelatorioDoCliente(input)),

  // Send report link to WhatsApp group (manager via JWT)
  sendReportAsManager: publicProcedure
    .input(envioInput.extend({ managerToken: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.managerToken, input.clientId);
      return enviarRelatorioDoCliente(input);
    }),
});

// ─── App Router ───────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: dashboardRouter,
  instagram: instagramRouter,
  managers: managersRouter,
  public: publicRouter,
  sales: salesRouter,
  monday: mondayRouter,
  ai: aiRouter,
  crm: crmRouter,
  leadTracking: leadTrackingRouter,
  whatsapp: whatsappRouter,
});

export type AppRouter = typeof appRouter;
