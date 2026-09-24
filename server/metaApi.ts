/**
 * Meta Graph API direct integration using user access tokens.
 * Fetches Meta Ads data (investment, leads, reach, clicks) and
 * Instagram Insights (followers, views, reach, interactions) without
 * needing a spreadsheet.
 */

import axios from "axios";
import {
  formLeadsFrom, reportedCostPer, blendCostPerLead, FORM_ACTIONS,
} from "./metaLeadActions";
import { classificarCampanha, type TipoCampanha } from "./classificarCampanha";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

export interface MetaAdsData {
  investimento: number;
  leads: number;          // messaging conversations started
  alcance: number;
  cliquesNoLink: number;
  novosSeguidores: number; // instagram follows from ads
  custoPorLead: number;
  custoPorClique: number;
  // New messaging metrics
  novosContatos: number;        // messaging_first_reply (new contacts)
  totalContatos: number;        // total_messaging_connection
  conversasRespondidas: number; // messaging_conversation_replied_7d
  leadsInstagram: number;       // leads that went to Instagram Direct
  leadsWhatsapp: number;        // leads that went to WhatsApp
  // Campaign breakdown
  mensagens: {
    investimento: number;
    leads: number;
    custoPorLead: number;
  };
  visitas: {
    investimento: number;
    alcance: number;
    custoPorVisita: number;
  };
  formulario: {
    investimento: number;
    cliques: number;
    custoPorClique: number;
    /** Leads de formulário: instantâneo do Meta ou pixel em site próprio. */
    leads: number;
    custoPorLead: number;
  };
  video: {
    investimento: number;
    /** Reproduções de 3 s (`video_view`). */
    visualizacoes: number;
    custoPorVisualizacao: number;
  };
  /** Campanhas que não casaram com nenhuma gaveta — ficam à vista, não escondidas. */
  outros: { investimento: number };
  /** Uma linha por campanha, para conferir a classificação no painel. */
  campanhasDetalhe: CampanhaDetalhe[];
}

export type CampanhaDetalhe = {
  nome: string;
  tipo: TipoCampanha;
  objective: string | null;
  investimento: number;
  conversas: number;
  leadsFormulario: number;
  visualizacoes: number;
  alcance: number;
  cliques: number;
};

export interface InstagramInsightsData {
  novosSeguidores: number;
  totalSeguidores: number;
  views: number;
  reach: number;
  interactions: number;
  profileVisits: number;
}

/**
 * Fetch Meta Ads insights for an ad account over a date range.
 * Uses the Insights API with campaign-level breakdown.
 */
export async function fetchMetaAdsFromApi(
  accessToken: string,
  adAccountId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<MetaAdsData> {
  // Normalize ad account ID (remove "act_" prefix if present, then re-add)
  const normalizedAccountId = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;

  const fields = [
    "campaign_name",
    "objective",
    "spend",
    "reach",
    "actions",
    "cost_per_action_type",
    "inline_link_clicks",
    "cost_per_inline_link_click",
  ].join(",");

  const params = {
    access_token: accessToken,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields,
    level: "campaign",
    limit: 500,
  };

  // Separate params for destination breakdown (action_breakdowns splits rows, can't mix with main query)
  const destBreakdownParams = {
    access_token: accessToken,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields: ["campaign_name", "actions"].join(","),
    level: "campaign",
    action_breakdowns: "action_destination",
    limit: 500,
  };

  console.log(`[Meta API] Fetching ads for account ${normalizedAccountId} from ${startDate} to ${endDate}`);

  // Fetch all pages to ensure all campaigns are included
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const campaigns: any[] = [];
  let nextUrl: string | null = null;
  let firstResponse;
  try {
    firstResponse = await axios.get(
      `${GRAPH_API_BASE}/${normalizedAccountId}/insights`,
      { params, timeout: 30000 }
    );
  } catch (axiosErr: any) {
    const errBody = axiosErr?.response?.data;
    console.error(`[Meta API] Detailed error for ${normalizedAccountId}:`, JSON.stringify(errBody));
    throw axiosErr;
  }
  campaigns.push(...(firstResponse.data?.data ?? []));
  nextUrl = firstResponse.data?.paging?.next ?? null;
  // Follow pagination cursors (max 10 pages to avoid infinite loops)
  let pageCount = 0;
  while (nextUrl && pageCount < 10) {
    const pageRes = await axios.get(nextUrl, { timeout: 30000 });
    campaigns.push(...(pageRes.data?.data ?? []));
    nextUrl = pageRes.data?.paging?.next ?? null;
    pageCount++;
  }
  console.log(`[Meta API] Total campaigns fetched: ${campaigns.length} (${pageCount + 1} page(s))`);

  // Fetch destination breakdown separately (action_breakdowns splits rows)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destRows: any[] = [];
  try {
    const destResp = await axios.get(
      `${GRAPH_API_BASE}/${normalizedAccountId}/insights`,
      { params: destBreakdownParams, timeout: 30000 }
    );
    destRows.push(...(destResp.data?.data ?? []));
    let destNext = destResp.data?.paging?.next ?? null;
    let destPage = 0;
    while (destNext && destPage < 10) {
      const dp = await axios.get(destNext, { timeout: 30000 });
      destRows.push(...(dp.data?.data ?? []));
      destNext = dp.data?.paging?.next ?? null;
      destPage++;
    }
  } catch (e: any) {
    console.warn(`[Meta API] Destination breakdown fetch failed (non-critical):`, e?.response?.data ?? e?.message);
  }

  // Build destination totals from destRows
  let totalLeadsInstagramFromBreakdown = 0;
  let totalLeadsWhatsappFromBreakdown = 0;
  for (const row of destRows) {
    const rowActions: any[] = row.actions ?? [];
    for (const a of rowActions) {
      if (a.action_type === "onsite_conversion.messaging_conversation_started_7d") {
        const dest = (a.action_destination ?? "").toLowerCase();
        const val = parseInt(a.value, 10) || 0;
        if (dest === "instagram" || dest === "instagram_direct") totalLeadsInstagramFromBreakdown += val;
        else if (dest === "whatsapp") totalLeadsWhatsappFromBreakdown += val;
      }
    }
  }

  let totalInvestimento = 0;
  let totalLeads = 0;
  let totalAlcance = 0;
  let totalCliques = 0;
  let totalCostPerLead = 0;
  let leadRows = 0;

  // Campaign type breakdown
  let mensagensInvestimento = 0;
  let mensagensLeads = 0;
  let mensagensCostPerLead = 0;
  let mensagensLeadRows = 0;

  let visitasInvestimento = 0;
  let visitasAlcance = 0;

  let formularioInvestimento = 0;
  let formularioCliques = 0;
  let formularioLeads = 0;
  let formularioCustoPonderado = 0;
  let formularioLeadsComCusto = 0;
  let videoInvestimento = 0;
  let videoVisualizacoes = 0;
  let outrosInvestimento = 0;
  const campanhasDetalhe: CampanhaDetalhe[] = [];
  let totalInstagramFollows = 0;
  let totalNovosContatos = 0;
  let totalTotalContatos = 0;
  let totalConversasRespondidas = 0;

  for (const campaign of campaigns) {
    const spend = parseFloat(campaign.spend ?? "0");
    const reach = parseInt(campaign.reach ?? "0", 10);
    const linkClicks = parseInt(campaign.inline_link_clicks ?? "0", 10);

    // Extract messaging conversations started
    const actions: Array<{ action_type: string; value: string }> = campaign.actions ?? [];
    const costPerAction: Array<{ action_type: string; value: string }> = campaign.cost_per_action_type ?? [];

    // Extract instagram follows (new followers from ads)
    const igFollowsAction = actions.find(a => a.action_type === "follow");
    const igFollows = igFollowsAction ? parseInt(igFollowsAction.value, 10) : 0;
    totalInstagramFollows += igFollows;

    const msgAction = actions.find(a => a.action_type === "onsite_conversion.messaging_conversation_started_7d");
    const msgConversations = msgAction ? parseInt(msgAction.value, 10) : 0;

    const msgCostAction = costPerAction.find(a => a.action_type === "onsite_conversion.messaging_conversation_started_7d");
    const msgCostPerLead = msgCostAction ? parseFloat(msgCostAction.value) : 0;

    // New messaging metrics
    const newContactsAction = actions.find((a: any) => a.action_type === "onsite_conversion.messaging_first_reply");
    const newContacts = newContactsAction ? parseInt((newContactsAction as any).value, 10) : 0;
    const totalContactsAction = actions.find((a: any) => a.action_type === "onsite_conversion.total_messaging_connection");
    const totalContacts = totalContactsAction ? parseInt((totalContactsAction as any).value, 10) : 0;
    const repliedAction = actions.find((a: any) => a.action_type === "onsite_conversion.messaging_conversation_replied_7d");
    const repliedConversations = repliedAction ? parseInt((repliedAction as any).value, 10) : 0;
    totalNovosContatos += newContacts;
    totalTotalContatos += totalContacts;
    totalConversasRespondidas += repliedConversations;

    // Leads de formulário: nunca eram lidos, apesar de já virem em `actions`.
    const formLeads = formLeadsFrom(actions);

    totalInvestimento += spend;
    totalAlcance += reach;
    totalCliques += linkClicks;
    totalLeads += msgConversations + formLeads;

    if (msgConversations > 0 && msgCostPerLead > 0) {
      totalCostPerLead += msgCostPerLead * msgConversations;
      leadRows += msgConversations;
    }

    const videoViewAction = actions.find(a => a.action_type === "video_view");
    const videoViews = videoViewAction ? parseInt(videoViewAction.value, 10) : 0;

    const tipo = classificarCampanha({
      nome: campaign.campaign_name ?? "", objective: campaign.objective ?? null,
      conversas: msgConversations, leadsFormulario: formLeads, visualizacoes: videoViews,
    });
    campanhasDetalhe.push({
      nome: campaign.campaign_name ?? "", tipo, objective: campaign.objective ?? null,
      investimento: spend, conversas: msgConversations, leadsFormulario: formLeads,
      visualizacoes: videoViews, alcance: reach, cliques: linkClicks,
    });

    if (tipo === "formulario") {
      formularioInvestimento += spend;
      formularioCliques += linkClicks;
      formularioLeads += formLeads;
      const cpl = reportedCostPer(costPerAction, FORM_ACTIONS);
      if (cpl != null && formLeads > 0) {
        formularioCustoPonderado += cpl * formLeads;
        formularioLeadsComCusto += formLeads;
      }
    } else if (tipo === "visitas") {
      visitasInvestimento += spend;
      visitasAlcance += reach;
    } else if (tipo === "video") {
      videoInvestimento += spend;
      videoVisualizacoes += videoViews;
    } else if (tipo === "outros") {
      outrosInvestimento += spend;
    } else {
      // mensagens (WPP, DIRECT, MAMO, CIRURGIA, etc.)
      mensagensInvestimento += spend;
      mensagensLeads += msgConversations;
      if (msgConversations > 0 && msgCostPerLead > 0) {
        mensagensCostPerLead += msgCostPerLead * msgConversations;
        mensagensLeadRows += msgConversations;
      }
    }
  }

  const custoPorLead = leadRows > 0 ? totalCostPerLead / leadRows : 0;
  const custoPorClique = totalCliques > 0 ? totalInvestimento / totalCliques : 0;

  return {
    investimento: totalInvestimento,
    leads: totalLeads,
    alcance: totalAlcance,
    cliquesNoLink: totalCliques,
    novosSeguidores: totalInstagramFollows,
    custoPorLead,
    custoPorClique,
    novosContatos: totalNovosContatos,
    totalContatos: totalTotalContatos,
    conversasRespondidas: totalConversasRespondidas,
    leadsInstagram: totalLeadsInstagramFromBreakdown,
    leadsWhatsapp: totalLeadsWhatsappFromBreakdown,
    mensagens: {
      investimento: mensagensInvestimento,
      leads: mensagensLeads,
      custoPorLead: mensagensLeadRows > 0 ? mensagensCostPerLead / mensagensLeadRows : 0,
    },
    visitas: {
      investimento: visitasInvestimento,
      alcance: visitasAlcance,
      custoPorVisita: visitasAlcance > 0 ? visitasInvestimento / visitasAlcance : 0,
    },
    formulario: {
      investimento: formularioInvestimento,
      cliques: formularioCliques,
      custoPorClique: formularioCliques > 0 ? formularioInvestimento / formularioCliques : 0,
      leads: formularioLeads,
      custoPorLead: blendCostPerLead(
        formularioCustoPonderado, formularioLeadsComCusto,
        formularioInvestimento, formularioLeads,
      ),
    },
    video: {
      investimento: videoInvestimento,
      visualizacoes: videoVisualizacoes,
      custoPorVisualizacao: videoVisualizacoes > 0 ? videoInvestimento / videoVisualizacoes : 0,
    },
    outros: { investimento: outrosInvestimento },
    campanhasDetalhe,
  };
}

/**
 * Fetch Instagram Business account insights for a date range.
 * Requires the user token to have instagram_manage_insights permission.
 */
export async function fetchInstagramInsightsFromApi(
  accessToken: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<InstagramInsightsData> {
  // Step 1: Get the user's Instagram Business accounts via Facebook Pages
  const pagesResp = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
    params: { access_token: accessToken, fields: "instagram_business_account,name", limit: 50 },
    timeout: 15000,
  });

  const pages = pagesResp.data?.data ?? [];
  const igAccountId = pages
    .map((p: { instagram_business_account?: { id: string } }) => p.instagram_business_account?.id)
    .find(Boolean);

  if (!igAccountId) {
    throw new Error("Nenhuma conta Instagram Business encontrada. Certifique-se de que a conta está vinculada a uma Página do Facebook.");
  }

  console.log(`[Meta API] Fetching Instagram insights for account ${igAccountId}`);

  // Step 2: Get follower count (total)
  const profileResp = await axios.get(`${GRAPH_API_BASE}/${igAccountId}`, {
    params: { access_token: accessToken, fields: "followers_count,name,username" },
    timeout: 15000,
  });
  const totalSeguidores = profileResp.data?.followers_count ?? 0;

  // Step 3: Get daily insights for the period
  // In API v21+, ALL metrics require metric_type=total_value.
  // 'impressions' is NOT valid — use 'views' instead.
  // Each metric must be fetched separately (mixing causes 400 errors).
  // Split date range into chunks of max 29 days (API limit is 30 days)
  const splitChunks = (start: string, end: string): Array<{since: number; until: number}> => {
    const chunks: Array<{since: number; until: number}> = [];
    let cur = new Date(start);
    const endDate2 = new Date(end);
    while (cur <= endDate2) {
      const chunkEnd = new Date(cur);
      chunkEnd.setDate(chunkEnd.getDate() + 28); // 29-day window
      if (chunkEnd > endDate2) chunkEnd.setTime(endDate2.getTime());
      chunks.push({
        since: Math.floor(cur.getTime() / 1000),
        until: Math.floor(new Date(chunkEnd.toISOString().split('T')[0] + 'T23:59:59').getTime() / 1000),
      });
      cur = new Date(chunkEnd);
      cur.setDate(cur.getDate() + 1);
    }
    return chunks;
  };

  const dateChunks = splitChunks(startDate, endDate);

  const fetchMetricChunked = async (metricName: string): Promise<number> => {
    let total = 0;
    for (const chunk of dateChunks) {
      try {
        const res = await axios.get(`${GRAPH_API_BASE}/${igAccountId}/insights`, {
          params: {
            access_token: accessToken,
            metric: metricName,
            period: "day",
            metric_type: "total_value",
            since: chunk.since,
            until: chunk.until,
          },
          timeout: 20000,
        });
        const data = res.data?.data ?? [];
        const found = data.find((m: { name: string }) => m.name === metricName);
        const val = found?.total_value?.value ?? 0;
        total += val;
      } catch (e: unknown) {
        const axiosErr = e as { response?: { data?: unknown }; message?: string };
        if (axiosErr.response?.data) {
          console.error(`[Meta API] Instagram metric ${metricName} error:`, JSON.stringify(axiosErr.response.data));
        } else {
          console.error(`[Meta API] Instagram metric ${metricName} error (no response):`, axiosErr.message);
        }
      }
    }
    return total;
  };

  // follower_count: try the selected period first, then fallback to follows_and_unfollows
  const fetchFollowerCountRecent = async (): Promise<number> => {
    const sinceTs = Math.floor(new Date(startDate + 'T00:00:00').getTime() / 1000);
    const untilTs = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000);
    // Try follower_count for the selected period
    try {
      const res = await axios.get(`${GRAPH_API_BASE}/${igAccountId}/insights`, {
        params: { access_token: accessToken, metric: "follower_count", period: "day", since: sinceTs, until: untilTs },
        timeout: 20000,
      });
      const data = res.data?.data ?? [];
      const found = data.find((m: { name: string }) => m.name === "follower_count");
      const total = (found?.values ?? []).reduce((s: number, v: { value: number }) => s + (v.value ?? 0), 0);
      if (total > 0) return total;
    } catch (e1: any) {
      console.warn(`[Instagram Insights] follower_count: ${JSON.stringify(e1?.response?.data ?? e1?.message)}`);
    }
    // Fallback: try follows_and_unfollows (net new followers)
    try {
      const res2 = await axios.get(`${GRAPH_API_BASE}/${igAccountId}/insights`, {
        params: { access_token: accessToken, metric: "follows_and_unfollows", period: "day", since: sinceTs, until: untilTs },
        timeout: 20000,
      });
      const data2 = res2.data?.data ?? [];
      const found2 = data2.find((m: { name: string }) => m.name === "follows_and_unfollows");
      return (found2?.values ?? []).reduce((s: number, v: { value: number }) => s + Math.max(0, v.value ?? 0), 0);
    } catch (e2: any) {
      console.warn(`[Instagram Insights] follows_and_unfollows: ${JSON.stringify(e2?.response?.data ?? e2?.message)}`);
      return 0;
    }
  };

  const [views, reach, profileVisits, websiteClicks, novosSeguidores] = await Promise.all([
    fetchMetricChunked("views"),
    fetchMetricChunked("reach"),
    fetchMetricChunked("profile_views"),
    fetchMetricChunked("website_clicks"),
    fetchFollowerCountRecent(),
  ]);

  console.log(`[Meta API] Instagram insights result: views=${views} reach=${reach} profileVisits=${profileVisits} websiteClicks=${websiteClicks} novosSeguidores=${novosSeguidores}`);

  return {
    novosSeguidores,
    totalSeguidores,
    views,
    reach,
    interactions: websiteClicks,
    profileVisits,
  };
}

/**
 * List all Instagram Business accounts accessible via the token.
 * Goes through /me/accounts (Facebook Pages) and gets linked Instagram accounts.
 */
export async function listInstagramProfiles(
  accessToken: string
): Promise<Array<{ igUserId: string; username: string; name: string; followersCount: number; profilePictureUrl?: string }>> {
  // Mesma correção das contas de anúncio: sem percorrer as páginas, perfis
  // ficavam de fora sem que nada indicasse o corte.
  const pages = await paginarGraph<{ id?: string; name?: string; instagram_business_account?: { id: string; username: string; name: string; followers_count: number; profile_picture_url?: string } }>(
    `${GRAPH_API_BASE}/me/accounts`,
    {
      access_token: accessToken,
      fields: "id,name,instagram_business_account{id,username,name,followers_count,profile_picture_url}",
      limit: 100,
    },
  );
  const profiles: Array<{ igUserId: string; username: string; name: string; followersCount: number; profilePictureUrl?: string }> = [];

  for (const page of pages) {
    const ig = page.instagram_business_account;
    if (ig?.id) {
      profiles.push({
        igUserId: ig.id,
        username: ig.username ?? "",
        name: ig.name ?? page.name ?? "",
        followersCount: ig.followers_count ?? 0,
        profilePictureUrl: ig.profile_picture_url,
      });
    }
  }

  return profiles;
}

/**
 * Validate a Meta access token and return basic user info.
 */
export async function validateMetaToken(accessToken: string): Promise<{ valid: boolean; name?: string; userId?: string; error?: string }> {
  try {
    const resp = await axios.get(`${GRAPH_API_BASE}/me`, {
      params: { access_token: accessToken, fields: "id,name" },
      timeout: 10000,
    });
    return { valid: true, name: resp.data.name, userId: resp.data.id };
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: { message?: string } } } };
    return { valid: false, error: error.response?.data?.error?.message ?? "Token inválido" };
  }
}

/**
 * List ad accounts accessible by the token.
 */
/** Teto de páginas: evita laço infinito se a API devolver `next` sem fim. */
const MAX_PAGINAS = 20;

/**
 * Percorre uma listagem da Graph API até o fim.
 *
 * As listagens paravam na primeira página. Quem administra muitas contas — o
 * caso de uma agência — não via as demais, e a ausência parecia falta de
 * permissão em vez de corte de lista, o que leva a procurar o problema no
 * lugar errado.
 */
export async function paginarGraph<T>(
  urlInicial: string,
  params: Record<string, string | number>,
  maxPaginas = MAX_PAGINAS,
): Promise<T[]> {
  const itens: T[] = [];
  let url: string | null = urlInicial;
  let query: Record<string, string | number> | undefined = params;

  for (let pagina = 0; url && pagina < maxPaginas; pagina++) {
    const resp: { data?: { data?: T[]; paging?: { next?: string } } } =
      await axios.get(url, { params: query, timeout: 20000 });
    for (const item of resp.data?.data ?? []) itens.push(item);
    // O `next` já traz token e cursor embutidos; repetir params duplicaria.
    url = resp.data?.paging?.next ?? null;
    query = undefined;
  }
  return itens;
}

export async function listAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string; currency: string }>> {
  const contas = await paginarGraph<{ id: string; name: string; currency: string }>(
    `${GRAPH_API_BASE}/me/adaccounts`,
    { access_token: accessToken, fields: "id,name,currency,account_status", limit: 200 },
  );
  return contas.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
}

/**
 * Verify if the token has access to a specific ad account by ID.
 * Useful for accounts in client BMs that don't appear in me/adaccounts.
 */
export async function verifyAdAccountAccess(accessToken: string, adAccountId: string): Promise<{ valid: boolean; name?: string; currency?: string; error?: string }> {
  try {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const resp = await axios.get(`${GRAPH_API_BASE}/${accountId}`, {
      params: { access_token: accessToken, fields: "id,name,currency,account_status" },
      timeout: 10000,
    });
    return { valid: true, name: resp.data.name, currency: resp.data.currency };
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: { message?: string } } } };
    return { valid: false, error: error.response?.data?.error?.message ?? "Sem acesso a esta conta" };
  }
}

/**
 * Fetch Instagram Insights using a known igUserId (no need to look up via /me/accounts).
 * Used by the public report page where igUserId is already stored in the database.
 */
export async function fetchInstagramInsightsByIgId(
  accessToken: string,
  igUserId: string,
  startDate: string,
  endDate: string
): Promise<InstagramInsightsData> {
  // Get follower count (total)
  let totalSeguidores = 0;
  try {
    const profileResp = await axios.get(`${GRAPH_API_BASE}/${igUserId}`, {
      params: { access_token: accessToken, fields: "followers_count" },
      timeout: 15000,
    });
    totalSeguidores = profileResp.data?.followers_count ?? 0;
  } catch { /* ignore */ }

  const splitChunks = (start: string, end: string): Array<{since: number; until: number}> => {
    const chunks: Array<{since: number; until: number}> = [];
    let cur = new Date(start);
    const endD = new Date(end);
    while (cur <= endD) {
      const chunkEnd = new Date(cur);
      chunkEnd.setDate(chunkEnd.getDate() + 28);
      if (chunkEnd > endD) chunkEnd.setTime(endD.getTime());
      chunks.push({
        since: Math.floor(cur.getTime() / 1000),
        until: Math.floor(new Date(chunkEnd.toISOString().split('T')[0] + 'T23:59:59').getTime() / 1000),
      });
      cur = new Date(chunkEnd);
      cur.setDate(cur.getDate() + 1);
    }
    return chunks;
  };

  const dateChunks = splitChunks(startDate, endDate);

  const fetchMetricChunked = async (metricName: string): Promise<number> => {
    let total = 0;
    for (const chunk of dateChunks) {
      try {
        const res = await axios.get(`${GRAPH_API_BASE}/${igUserId}/insights`, {
          params: {
            access_token: accessToken,
            metric: metricName,
            period: "day",
            metric_type: "total_value",
            since: chunk.since,
            until: chunk.until,
          },
          timeout: 20000,
        });
        const data = res.data?.data ?? [];
        const found = data.find((m: { name: string }) => m.name === metricName);
        total += found?.total_value?.value ?? 0;
      } catch { /* ignore metric errors */ }
    }
    return total;
  };

  const fetchFollowerCountRecent = async (): Promise<number> => {
    // follower_count API: only supports last 30 days, has ~3 day data delay
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const threeDaysAgoStr = threeDaysAgo.toISOString().substring(0, 10);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().substring(0, 10);
    // Clamp the requested range to the available window
    const clampedStart = startDate >= thirtyDaysAgoStr ? startDate : thirtyDaysAgoStr;
    const clampedEnd = endDate <= threeDaysAgoStr ? endDate : threeDaysAgoStr;
    if (clampedStart > clampedEnd) return 0; // period outside available window
    const sinceTs = Math.floor(new Date(clampedStart + 'T00:00:00').getTime() / 1000);
    const untilTs = Math.floor(new Date(clampedEnd + 'T23:59:59').getTime() / 1000);
    // Try follower_count for the clamped period
    try {
      const res = await axios.get(`${GRAPH_API_BASE}/${igUserId}/insights`, {
        params: { access_token: accessToken, metric: "follower_count", period: "day", since: sinceTs, until: untilTs },
        timeout: 20000,
      });
      const data = res.data?.data ?? [];
      const found = data.find((m: { name: string }) => m.name === "follower_count");
      const total = (found?.values ?? []).reduce((s: number, v: { value: number }) => s + (v.value ?? 0), 0);
      console.log(`[getInsights] follower_count: since=${clampedStart} until=${clampedEnd} total=${total}`);
      if (total > 0) return total;
    } catch { /* try fallback */ }
    // Fallback: follows_and_unfollows (net new followers)
    try {
      const res2 = await axios.get(`${GRAPH_API_BASE}/${igUserId}/insights`, {
        params: { access_token: accessToken, metric: "follows_and_unfollows", period: "day", since: sinceTs, until: untilTs },
        timeout: 20000,
      });
      const data2 = res2.data?.data ?? [];
      const found2 = data2.find((m: { name: string }) => m.name === "follows_and_unfollows");
      return (found2?.values ?? []).reduce((s: number, v: { value: number }) => s + Math.max(0, v.value ?? 0), 0);
    } catch { return 0; }
  };

  const [views, reach, profileVisits, interactions, novosSeguidores] = await Promise.all([
    fetchMetricChunked("views"),
    fetchMetricChunked("reach"),
    fetchMetricChunked("profile_views"),
    fetchMetricChunked("total_interactions"),
    fetchFollowerCountRecent(),
  ]);

  return { novosSeguidores, totalSeguidores, views, reach, interactions, profileVisits };
}

/**
 * Fetch the budget/balance info for a prepaid ad account.
 * Returns balance (remaining), amountSpent, and spendCap.
 * Only relevant for prepaid accounts (PIX/boleto).
 */
export async function fetchAdAccountBudget(
  accessToken: string,
  adAccountId: string
): Promise<{ balance: number; amountSpent: number; spendCap: number; currency: string; accountStatus: number; disableReason: number | null } | null> {
  const normalizedAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  try {
    const resp = await axios.get(`${GRAPH_API_BASE}/${normalizedAccountId}`, {
      params: {
        access_token: accessToken,
        fields: "balance,amount_spent,spend_cap,currency,account_status,disable_reason,funding_source_details",
      },
      timeout: 15000,
    });
    const data = resp.data;
    // DEBUG: log raw API response for balance diagnosis
    console.log(`[Meta API] Budget raw for ${normalizedAccountId}:`, JSON.stringify({
      balance: data.balance,
      amount_spent: data.amount_spent,
      spend_cap: data.spend_cap,
      currency: data.currency,
      account_status: data.account_status,
      funding_source_details: data.funding_source_details,
    }));
    // Meta returns values in cents for balance/amount_spent/spend_cap
    // Priority 1: funding_source_details.display_string (most reliable for prepaid)
    // Priority 2: (spend_cap - amount_spent) / 100 (reliable fallback)
    // Priority 3: balance / 100 (least reliable — sometimes stale)
    let balance = 0;
    if (data.funding_source_details?.display_string) {
      // Extract numeric value from string like "Available Balance (R$520.47 BRL)"
      const match = data.funding_source_details.display_string.match(/[\d,]+\.?\d*/g);
      if (match && match.length > 0) {
        const parsed = parseFloat(match[match.length - 1].replace(",", ""));
        if (!isNaN(parsed) && parsed >= 0) balance = parsed;
      }
    }
    // Fallback: spend_cap - amount_spent (both in cents)
    if (balance === 0 && data.spend_cap && data.amount_spent) {
      const remaining = (parseFloat(data.spend_cap) - parseFloat(data.amount_spent)) / 100;
      if (!isNaN(remaining) && remaining > 0) balance = remaining;
    }
    // Last resort: balance field in cents
    if (balance === 0 && data.balance) {
      balance = parseFloat(data.balance) / 100;
    }
    return {
      balance,
      amountSpent: parseFloat(data.amount_spent ?? "0") / 100,
      spendCap: parseFloat(data.spend_cap ?? "0") / 100,
      currency: data.currency ?? "BRL",
      accountStatus: data.account_status ?? 1,
      disableReason: data.disable_reason ?? null,
    };
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown } };
    console.error(`[Meta API] fetchAdAccountBudget error for ${normalizedAccountId}:`, JSON.stringify(e?.response?.data ?? err));
    return null;
  }
}

export interface AdCreative {
  adId: string;
  adName: string;
  adsetName: string;
  campaignName: string;
  status: string; // ACTIVE | PAUSED | etc.
  effectiveStatus: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  videoId: string | null;
  format: "image" | "video" | "carousel" | "unknown";
  title: string | null;
  body: string | null;
  callToAction: string | null;
  // Performance metrics for the last 30 days
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpl: number;
}

/**
 * Fetch active ad creatives for an ad account.
 * Returns ads with their creative assets (thumbnail/image/video) and
 * performance metrics (spend, impressions, reach, clicks, leads).
 */
export async function fetchActiveCreatives(
  accessToken: string,
  adAccountId: string,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string    // YYYY-MM-DD
): Promise<AdCreative[]> {
  const normalizedAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  try {
    // Step 1: Get ads with creative info (only ACTIVE + PAUSED to keep it manageable)
    const adsResp = await axios.get(`${GRAPH_API_BASE}/${normalizedAccountId}/ads`, {
      params: {
        access_token: accessToken,
        fields: [
          "id",
          "name",
          "status",
          "effective_status",
          "adset{name}",
          "campaign{name}",
          "creative{id,name,title,body,call_to_action_type,thumbnail_url,image_url,video_id,object_story_spec{link_data{picture,image_hash,message,name,child_attachments{picture,image_hash}},photo_data{url}},asset_feed_spec{images{hash,url},videos{thumbnail_url}}}",
        ].join(","),
        filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]),
        limit: 50,
      },
      timeout: 20000,
    });

    const adsData = adsResp.data?.data ?? [];
    if (!adsData.length) return [];

    // Step 2: Get insights for these ads
    const adIds = adsData.map((a: any) => a.id);
    let insightsMap: Record<string, { spend: number; impressions: number; reach: number; clicks: number; leads: number }> = {};

    try {
      const insightsResp = await axios.get(`${GRAPH_API_BASE}/${normalizedAccountId}/insights`, {
        params: {
          access_token: accessToken,
          fields: "ad_id,spend,impressions,reach,inline_link_clicks,actions",
          level: "ad",
          time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
          filtering: JSON.stringify([{ field: "ad.id", operator: "IN", value: adIds }]),
          limit: 200,
        },
        timeout: 20000,
      });

      for (const row of (insightsResp.data?.data ?? [])) {
        const leads = (row.actions ?? []).find((a: any) =>
          ["onsite_conversion.messaging_conversation_started_7d", "lead", "offsite_conversion.fb_pixel_lead"].includes(a.action_type)
        )?.value ?? 0;
        insightsMap[row.ad_id] = {
          spend: parseFloat(row.spend ?? "0"),
          impressions: parseInt(row.impressions ?? "0"),
          reach: parseInt(row.reach ?? "0"),
          clicks: parseInt(row.inline_link_clicks ?? "0"),
          leads: parseInt(leads),
        };
      }
    } catch (e) {
      console.warn("[Meta API] fetchActiveCreatives: insights fetch failed, continuing without metrics", e);
    }

    // Step 2b: For video ads, fetch high-res thumbnails from video endpoint
    const videoIds = Array.from(new Set(adsData.map((a: any) => a.creative?.video_id).filter(Boolean))) as string[];
    const videoThumbnailMap: Record<string, string> = {};
    if (videoIds.length > 0) {
      try {
        // Batch fetch video thumbnails (max 50 per request)
        const batchResp = await axios.get(`${GRAPH_API_BASE}`, {
          params: {
            access_token: accessToken,
            ids: videoIds.slice(0, 50).join(","),
            fields: "id,thumbnails{uri,width,height}",
          },
          timeout: 15000,
        });
        for (const [vid, vdata] of Object.entries(batchResp.data ?? {})) {
          const thumbs: any[] = (vdata as any)?.thumbnails?.data ?? [];
          // Pick the highest-resolution thumbnail available
          const best = thumbs.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
          if (best?.uri) videoThumbnailMap[vid] = best.uri;
        }
      } catch (e) {
        console.warn("[Meta API] fetchActiveCreatives: video thumbnails fetch failed", e);
      }
    }

    // Step 3: Map to AdCreative objects
    const creatives: AdCreative[] = adsData.map((ad: any) => {
      const cr = ad.creative ?? {};
      const metrics = insightsMap[ad.id] ?? { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 };

      // Determine format
      let format: AdCreative["format"] = "unknown";
      if (cr.video_id) format = "video";
      else if (cr.asset_feed_spec?.images?.length > 1 || cr.object_story_spec?.link_data?.child_attachments?.length) format = "carousel";
      else if (cr.image_url || cr.thumbnail_url) format = "image";

      // Best thumbnail: prefer high-res sources first
      // 1. videoThumbnailMap (high-res from video endpoint — best for video ads)
      // 2. object_story_spec.link_data.picture (high-res image from link ad)
      // 3. object_story_spec.photo_data.url (photo ad)
      // 4. asset_feed_spec.images[0].url (feed spec)
      // 5. image_url (medium res)
      // 6. thumbnail_url (low res fallback for video)
      const highResPicture =
        (cr.video_id ? videoThumbnailMap[cr.video_id] : undefined) ??
        cr.object_story_spec?.link_data?.picture ??
        cr.object_story_spec?.link_data?.child_attachments?.[0]?.picture ??
        cr.object_story_spec?.photo_data?.url ??
        cr.asset_feed_spec?.images?.[0]?.url ??
        cr.asset_feed_spec?.videos?.[0]?.thumbnail_url ??
        null;
      const thumbnailUrl = highResPicture ?? cr.image_url ?? cr.thumbnail_url ?? null;
      const imageUrl = cr.image_url ?? null;

      const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
      const cpl = metrics.leads > 0 ? metrics.spend / metrics.leads : 0;

      return {
        adId: ad.id,
        adName: ad.name ?? "",
        adsetName: ad.adset?.name ?? "",
        campaignName: ad.campaign?.name ?? "",
        status: ad.status ?? "",
        effectiveStatus: ad.effective_status ?? "",
        thumbnailUrl,
        imageUrl,
        videoId: cr.video_id ?? null,
        format,
        title: cr.title ?? cr.object_story_spec?.link_data?.name ?? null,
        body: cr.body ?? cr.object_story_spec?.link_data?.message ?? null,
        callToAction: cr.call_to_action_type ?? null,
        spend: metrics.spend,
        impressions: metrics.impressions,
        reach: metrics.reach,
        clicks: metrics.clicks,
        leads: metrics.leads,
        ctr: parseFloat(ctr.toFixed(2)),
        cpl: parseFloat(cpl.toFixed(2)),
      };
    });

    // Filter only truly active ads and sort by spend descending
      return creatives
        .filter(c => c.effectiveStatus === "ACTIVE")
        .sort((a, b) => b.spend - a.spend);
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown } };
    console.error("[Meta API] fetchActiveCreatives error:", JSON.stringify(e?.response?.data ?? err));
    return [];
  }
}

// ─── Meta Lead Ads: buscar leads dos formulários nativos ────────────────────
export interface MetaLeadAdLead {
  leadId: string;
  formId: string;
  adId: string;
  adName: string;
  adSetId: string;
  adSetName: string;
  campaignId: string;
  campaignName: string;
  phone: string; // normalizado: só dígitos
  createdTime: string; // ISO timestamp
}

// Normaliza telefone: remove tudo que não é dígito
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

// Busca todos os leads de um ad account via Meta Lead Ads API
export async function fetchMetaLeadAdLeads(
  accessToken: string,
  adAccountId: string,
  daysBack = 90
): Promise<MetaLeadAdLead[]> {
  const normalizedAccountId = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;

  const since = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);

  const formsUrl = `${GRAPH_API_BASE}/${normalizedAccountId}/leadgen_forms?fields=id,name&limit=100&access_token=${accessToken}`;
  let formsRes: any;
  try {
    formsRes = await axios.get(formsUrl, { timeout: 30000 });
  } catch (err: any) {
    console.error("[Meta LeadAds] Error fetching forms:", err?.response?.data ?? err);
    return [];
  }

  const forms: { id: string; name: string }[] = formsRes.data?.data ?? [];
  if (!forms.length) return [];

  const allLeads: MetaLeadAdLead[] = [];

  for (const form of forms) {
    const leadsUrl = `${GRAPH_API_BASE}/${form.id}/leads?fields=id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,field_data,created_time&limit=200&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}}]&access_token=${accessToken}`;
    try {
      let nextUrl: string | null = leadsUrl;
      while (nextUrl) {
        const res: { data: any } = await axios.get(nextUrl, { timeout: 30000 });
        const items: any[] = res.data?.data ?? [];
        for (const lead of items) {
          const phoneField = (lead.field_data ?? []).find((f: any) =>
            ["phone_number", "phone", "telefone", "celular", "whatsapp"].includes(
              (f.name ?? "").toLowerCase()
            )
          );
          const rawPhone = phoneField?.values?.[0] ?? "";
          const phone = normalizePhone(rawPhone);
          if (!phone) continue;

          allLeads.push({
            leadId: lead.id,
            formId: form.id,
            adId: lead.ad_id ?? "",
            adName: lead.ad_name ?? "",
            adSetId: lead.adset_id ?? "",
            adSetName: lead.adset_name ?? "",
            campaignId: lead.campaign_id ?? "",
            campaignName: lead.campaign_name ?? "",
            phone,
            createdTime: lead.created_time ?? "",
          });
        }
        nextUrl = res.data?.paging?.next ?? null;
      }
    } catch (err: any) {
      console.error(`[Meta LeadAds] Error fetching leads for form ${form.id}:`, err?.response?.data ?? err);
    }
  }

  return allLeads;
}

// Envia evento de conversão offline para a Meta Conversions API
export async function sendCAPIConversionEvent(params: {
  pixelId: string;
  capiToken: string;
  phone: string;
  eventName: string;
  eventTime: number;
  value?: number;
  currency?: string;
}): Promise<boolean> {
  const crypto = await import("crypto");
  const phoneHash = crypto.createHash("sha256").update(params.phone).digest("hex");

  const payload = {
    data: [{
      event_name: params.eventName,
      event_time: params.eventTime,
      action_source: "other",
      user_data: { ph: [phoneHash] },
      custom_data: {
        currency: params.currency ?? "BRL",
        value: params.value ?? 0,
      },
    }],
  };

  try {
    const url = `${GRAPH_API_BASE}/${params.pixelId}/events?access_token=${params.capiToken}`;
    await axios.post(url, payload, { timeout: 15000 });
    return true;
  } catch (err: any) {
    console.error("[Meta CAPI] Error sending event:", err?.response?.data ?? err);
    return false;
  }
}
