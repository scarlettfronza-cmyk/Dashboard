/**
 * CRM Router - Monday.com leads table + Instagram top posts
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getIntegration } from "../db";
import { salesRecords, clients, integrations } from "../../drizzle/schema";
import { eq, and, desc, gte, lte, isNotNull } from "drizzle-orm";
import { resolvePreferredInstagramConnection } from "../instagramConnection";

const MONDAY_API_URL = "https://api.monday.com/v2";

async function mondayGQL(query: string, variables: Record<string, unknown>, token: string) {
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json() as any;
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

// Fetch raw leads from Monday board with pagination
export async function fetchMondayLeads(boardId: string, token: string) {
  const QUERY_FIRST = [
    "query GetItems($boardId: ID!) {",
    "  boards(ids: [$boardId]) {",
    "    columns { id title type }",
    "    items_page(limit: 200) {",
    "      cursor",
    "      items { id name created_at updated_at group { id title } column_values { id type text value } }",
    "    }",
    "  }",
    "}",
  ].join("\n");

  const QUERY_NEXT = [
    "query GetItemsNext($cursor: String!) {",
    "  next_items_page(limit: 200, cursor: $cursor) {",
    "    cursor",
    "    items { id name created_at updated_at group { id title } column_values { id type text value } }",
    "  }",
    "}",
  ].join("\n");

  const firstData = await mondayGQL(QUERY_FIRST, { boardId }, token) as any;
  const board = firstData?.boards?.[0];
  if (!board) return { columns: [], items: [] };

  const columns = board.columns as { id: string; title: string; type: string }[];
  let allItems = [...(board.items_page?.items ?? [])];
  let cursor = board.items_page?.cursor;

  while (cursor) {
    const nextData = await mondayGQL(QUERY_NEXT, { cursor }, token) as any;
    const page = nextData?.next_items_page;
    allItems = [...allItems, ...(page?.items ?? [])];
    cursor = page?.cursor ?? null;
  }

  return { columns, items: allItems };
}

// Map column values to a lead object
export function mapLead(item: any, columns: { id: string; title: string; type: string }[]) {
  const colMap: Record<string, string> = {};
  for (const col of columns) {
    colMap[col.id] = col.title.toLowerCase().trim();
  }

  const getValue = (id: string) => item.column_values?.find((c: any) => c.id === id)?.text ?? "";

  // Find columns by title keywords
  const findColId = (keywords: string[]) => {
    for (const [id, title] of Object.entries(colMap)) {
      if (keywords.some(kw => title.includes(kw))) return id;
    }
    return null;
  };

  const statusId = findColId(["status do lead", "status lead", "status do cliente", "status", "fechou", "fechado", "situação"]);
  const phoneId = findColId(["telefone", "phone", "celular", "whatsapp", "contato"]);
  const originId = findColId(["canal de aquisição", "canal", "origem", "aquisição", "source"]);
  const serviceId = findColId(["procedimento", "serviço", "servico", "produto", "tipo"]);
  const consultDateId = findColId(["data da consulta", "data consulta", "data avaliação", "data avaliacao", "data do agendamento"]);
  const conversionDateId = findColId(["data conversão", "data de conversão", "data fechamento", "data de fechamento"]);
  const valueId = findColId(["valor consulta", "valor da consulta", "valor avaliação"]);
  const surgeryValueId = findColId(["valor cirurgia", "valor procedimento", "valor implante"]);
  const closedValueId = findColId(["valor fechado", "valor do fechamento"]);
  const obsId = findColId(["observação", "observacao", "obs", "notas", "nota"]);
  const sdrId = findColId(["sdr", "vendedor", "atendente", "responsável", "pessoa"]);

  return {
    mondayId: item.id,
    name: item.name,
    groupName: item.group?.title ?? "",
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    status: statusId ? getValue(statusId) : "",
    phone: phoneId ? getValue(phoneId) : "",
    origin: originId ? getValue(originId) : "",
    service: serviceId ? getValue(serviceId) : "",
    consultDate: consultDateId ? getValue(consultDateId) : "",
    conversionDate: conversionDateId ? getValue(conversionDateId) : "",
    value: valueId ? getValue(valueId) : "",
    surgeryValue: surgeryValueId ? getValue(surgeryValueId) : "",
    closedValue: closedValueId ? getValue(closedValueId) : "",
    observation: obsId ? getValue(obsId) : "",
    sdr: sdrId ? getValue(sdrId) : "",
  };
}

// Parse a date string (YYYY-MM-DD or DD/MM/YYYY) to a comparable string YYYY-MM-DD
export function normalizeDateStr(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return null;
}

// Instagram media insights helper
export async function fetchIgMediaInsights(igId: string, token: string, limit = 20) {
  const mediaUrl = `https://graph.facebook.com/v19.0/${igId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=${limit}&access_token=${token}`;
  const mediaRes = await fetch(mediaUrl);
  const mediaData = await mediaRes.json() as any;
  if (mediaData.error) throw new Error(mediaData.error.message);

  const items = mediaData.data ?? [];
  const results = [];

  for (const item of items) {
    let insights: Record<string, number> = {
      likes: item.like_count ?? 0,
      comments: item.comments_count ?? 0,
    };

    try {
      let metrics: string;
      if (item.media_type === "VIDEO") {
        metrics = "views,total_interactions,likes,comments,shares,saved,ig_reels_avg_watch_time";
      } else {
        metrics = "impressions,reach,saved,likes,comments,shares,total_interactions";
      }
      const insUrl = `https://graph.facebook.com/v19.0/${item.id}/insights?metric=${metrics}&access_token=${token}`;
      const insRes = await fetch(insUrl);
      const insData = await insRes.json() as any;
      if (!insData.error && insData.data) {
        for (const m of insData.data) {
          insights[m.name] = m.values?.[0]?.value ?? 0;
        }
      }
    } catch {
      // keep basic insights
    }

    // Compute engagement score for ranking
    const engagementScore =
      (insights.total_interactions ?? insights.likes + insights.comments) +
      (insights.shares ?? 0) * 2 +
      (insights.saved ?? 0) * 3;

    results.push({
      id: item.id,
      mediaType: item.media_type as string,
      mediaUrl: item.media_url as string | null,
      thumbnailUrl: item.thumbnail_url as string | null,
      permalink: item.permalink as string,
      caption: (item.caption as string | null)?.slice(0, 200) ?? null,
      timestamp: item.timestamp as string,
      insights,
      engagementScore,
    });
  }

  // Sort by engagement score descending
  results.sort((a, b) => b.engagementScore - a.engagementScore);
  return results;
}

export type CrmLeadQuery = {
  clientId: number;
  status?: string;
  origin?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: "consult" | "conversion" | "any";
};

export async function getLeadsForClient(input: CrmLeadQuery) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const { systemSettings } = await import("../../drizzle/schema");
  const { eq: eqLocal } = await import("drizzle-orm");
  const globalToken = await db.select().from(systemSettings)
    .where(eqLocal(systemSettings.key, "monday_api_token"))
    .then(r => r[0]?.value ?? null);

  const clientInteg = await getIntegration(input.clientId, "monday");
  const token = globalToken ?? clientInteg?.accessToken;
  if (!token) return { leads: [], columns: [], error: "monday_not_configured" };

  const { clients: clientsTable } = await import("../../drizzle/schema");
  const clientRow = await db.select({ mondayBoardId: clientsTable.mondayBoardId })
    .from(clientsTable).where(eqLocal(clientsTable.id, input.clientId)).limit(1).then(r => r[0]);
  if (!clientRow?.mondayBoardId) return { leads: [], columns: [], error: "no_board_id" };

  const { columns, items } = await fetchMondayLeads(clientRow.mondayBoardId, token);
  let leads = items.map(item => mapLead(item, columns));

  if (input.status) leads = leads.filter(l => l.status.toLowerCase().includes(input.status!.toLowerCase()));
  if (input.origin) leads = leads.filter(l => l.origin.toLowerCase().includes(input.origin!.toLowerCase()));
  if (input.search) {
    const search = input.search.toLowerCase();
    leads = leads.filter(l => l.name.toLowerCase().includes(search) || l.phone.includes(search));
  }

  if (input.dateFrom || input.dateTo) {
    const from = input.dateFrom ?? "0000-00-00";
    const to = input.dateTo ?? "9999-99-99";
    leads = leads.filter(l => {
      const consultNorm = normalizeDateStr(l.consultDate);
      const conversionNorm = normalizeDateStr(l.conversionDate);
      const inRange = (date: string | null) => date !== null && date >= from && date <= to;
      if (input.dateField === "consult") return inRange(consultNorm);
      if (input.dateField === "conversion") return inRange(conversionNorm);
      return inRange(consultNorm) || inRange(conversionNorm);
    });
  }

  const byStatus: Record<string, number> = {};
  const byOrigin: Record<string, number> = {};
  for (const lead of leads) {
    if (lead.status) byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
    if (lead.origin) byOrigin[lead.origin] = (byOrigin[lead.origin] ?? 0) + 1;
  }
  const withConsult = leads.filter(l => l.consultDate && l.consultDate.trim() !== "").length;
  const withConversion = leads.filter(l => l.conversionDate && l.conversionDate.trim() !== "").length;
  const pendingUpdate = leads.filter(l =>
    l.status && !["fechado", "perdido", "cancelado", "não compareceu"].some(status => l.status.toLowerCase().includes(status))
    && l.consultDate && !l.conversionDate
  ).length;

  return {
    leads: leads.slice(0, 500),
    total: leads.length,
    byStatus,
    byOrigin,
    withConsult,
    withConversion,
    pendingUpdate,
    error: null,
  };
}

export async function getTopPostsForClient(input: { clientId: number; limit: number }) {
  const instagram = await resolvePreferredInstagramConnection(input.clientId);
  if (!instagram) return { posts: [], error: "instagram_not_configured" };

  try {
    const posts = await fetchIgMediaInsights(instagram.metaIgUserId, instagram.accessToken, input.limit);
    return { posts, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { posts: [], error: message };
  }
}

export const crmRouter = router({
  // Get leads from Monday board for a client
  getLeads: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      status: z.string().optional(),
      origin: z.string().optional(),
      search: z.string().optional(),
      // Date range filter
      dateFrom: z.string().optional(), // YYYY-MM-DD
      dateTo: z.string().optional(),   // YYYY-MM-DD
      // Which date field to filter on: "consult" | "conversion" | "any"
      dateField: z.enum(["consult", "conversion", "any"]).optional().default("any"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Get Monday token (global first, then per-client)
      const { systemSettings } = await import("../../drizzle/schema");
      const { eq: eqLocal } = await import("drizzle-orm");
      const globalToken = await db.select().from(systemSettings)
        .where(eqLocal(systemSettings.key, "monday_api_token"))
        .then(r => r[0]?.value ?? null);

      const clientInteg = await getIntegration(input.clientId, "monday");
      const token = globalToken ?? clientInteg?.accessToken;
      if (!token) return { leads: [], columns: [], error: "monday_not_configured" };

      // Get board ID
      const { clients: clientsTable } = await import("../../drizzle/schema");
      const clientRow = await db.select({ mondayBoardId: clientsTable.mondayBoardId })
        .from(clientsTable).where(eqLocal(clientsTable.id, input.clientId)).limit(1).then(r => r[0]);
      if (!clientRow?.mondayBoardId) return { leads: [], columns: [], error: "no_board_id" };

      const { columns, items } = await fetchMondayLeads(clientRow.mondayBoardId, token);
      let leads = items.map(item => mapLead(item, columns));

      // Apply text/status/origin filters
      if (input.status) {
        leads = leads.filter(l => l.status.toLowerCase().includes(input.status!.toLowerCase()));
      }
      if (input.origin) {
        leads = leads.filter(l => l.origin.toLowerCase().includes(input.origin!.toLowerCase()));
      }
      if (input.search) {
        const s = input.search.toLowerCase();
        leads = leads.filter(l => l.name.toLowerCase().includes(s) || l.phone.includes(s));
      }

      // Apply date range filter
      if (input.dateFrom || input.dateTo) {
        const from = input.dateFrom ?? "0000-00-00";
        const to = input.dateTo ?? "9999-99-99";

        leads = leads.filter(l => {
          const consultNorm = normalizeDateStr(l.consultDate);
          const convNorm = normalizeDateStr(l.conversionDate);

          const inRange = (d: string | null) => d !== null && d >= from && d <= to;

          if (input.dateField === "consult") return inRange(consultNorm);
          if (input.dateField === "conversion") return inRange(convNorm);
          // "any": lead appears if either date is in range
          return inRange(consultNorm) || inRange(convNorm);
        });
      }

      // Compute summary stats
      const total = leads.length;
      const byStatus: Record<string, number> = {};
      const byOrigin: Record<string, number> = {};
      for (const l of leads) {
        if (l.status) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
        if (l.origin) byOrigin[l.origin] = (byOrigin[l.origin] ?? 0) + 1;
      }

      // Count leads with consult in period vs conversion in period (for summary cards)
      const withConsult = leads.filter(l => l.consultDate && l.consultDate.trim() !== "").length;
      const withConversion = leads.filter(l => l.conversionDate && l.conversionDate.trim() !== "").length;

      // Alerts
      const pendingUpdate = leads.filter(l =>
        l.status && !["fechado", "perdido", "cancelado", "não compareceu"].some(s => l.status.toLowerCase().includes(s))
        && l.consultDate && !l.conversionDate
      ).length;

      return {
        leads: leads.slice(0, 500),
        total,
        byStatus,
        byOrigin,
        withConsult,
        withConversion,
        pendingUpdate,
        error: null,
      };
    }),

  // Get top performing Instagram posts for a client
  getTopPosts: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      limit: z.number().min(1).max(30).default(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const instagram = await resolvePreferredInstagramConnection(input.clientId);
      if (!instagram) return { posts: [], error: "instagram_not_configured" };

      try {
        const posts = await fetchIgMediaInsights(instagram.metaIgUserId, instagram.accessToken, input.limit);
        return { posts, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { posts: [], error: msg };
      }
    }),
});
