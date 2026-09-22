import { z } from "zod";
import { jwtVerify } from "jose";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { clients, integrations, managerClients, publicReportAccessLogs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getIntegration, getClientById } from "../db";
import { fetchClientKpis } from "../routers";
import { fetchInstagramInsightsByIgId } from "../metaApi";
import { getSystemSetting } from "../_core/systemRouter";
import { resolverToken, CHAVE_TOKEN_AGENCIA } from "../metaTokenResolver";
import { invokeLLM } from "../_core/llm";
import { resolvePreferredInstagramConnection } from "../instagramConnection";
import { fingerprintPublicReportToken, isValidPublicReportToken } from "../publicReportSecurity";

const publicReportTokenSchema = z.string().refine(isValidPublicReportToken, "Link inválido ou expirado");
const managerTokenSchema = z.string().min(20).optional();

async function getManagerIdFromToken(token?: string): Promise<number | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const result = await jwtVerify(token, secret);
    const managerId = Number(result.payload.managerId);
    return Number.isInteger(managerId) && managerId > 0 ? managerId : null;
  } catch {
    return null;
  }
}

async function alertCrossClientAccess(managerId: number, clientId: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Alerta de segurança: gestor ${managerId} tentou abrir o relatório público do cliente ${clientId}, sem vínculo ativo. A tentativa foi bloqueada.`,
      }),
    });
  } catch (error) {
    console.error("[PublicReportSecurity] Telegram alert failed", error);
  }
}

async function requirePublicClient(token: string, eventType: string, managerToken?: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const result = await db.select().from(clients)
    .where(and(eq(clients.publicToken, token), eq(clients.active, 1)))
    .limit(1);

  if (result.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Link inválido ou expirado" });
  }

  const client = result[0];
  const managerId = await getManagerIdFromToken(managerToken);
  const tokenFingerprint = fingerprintPublicReportToken(token);

  if (managerId) {
    const assignment = await db.select({ managerId: managerClients.managerId })
      .from(managerClients)
      .where(and(eq(managerClients.managerId, managerId), eq(managerClients.clientId, client.id)))
      .limit(1);

    if (assignment.length === 0) {
      await registrarAcesso(db, { clientId: client.id, managerId, eventType: "manager_cross_client_blocked", tokenFingerprint });
      await alertCrossClientAccess(managerId, client.id);
      throw new TRPCError({ code: "FORBIDDEN", message: "Este relatório não pertence à sua carteira." });
    }
  }

  await registrarAcesso(db, { clientId: client.id, managerId, eventType, tokenFingerprint });

  return { db, client };
}

/**
 * Registro de auditoria. Se falhar (tabela ausente num banco restaurado de
 * backup, por exemplo), o relatório do cliente continua abrindo: auditoria
 * não pode valer mais que o serviço que ela audita.
 */
async function registrarAcesso(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  valores: { clientId: number; managerId: number | null; eventType: string; tokenFingerprint: string },
) {
  try {
    await db.insert(publicReportAccessLogs).values(valores);
  } catch (e) {
    console.error("[PublicReport] Falha ao registrar acesso:", e instanceof Error ? e.message : e);
  }
}

export const publicRouter = router({
  // ── Get client data by public token (no auth required) ────────────────────
  getClientByToken: publicProcedure
    .input(z.object({ token: publicReportTokenSchema, managerToken: managerTokenSchema }))
    .query(async ({ input }) => {
      const { db, client } = await requirePublicClient(input.token, "public_report_open", input.managerToken);

      // Get integrations to know what's configured
      const clientIntegrations = await db.select({
        provider: integrations.provider,
        adAccountId: integrations.adAccountId,
        metaIgUserId: integrations.metaIgUserId,
        metaIgUsername: integrations.metaIgUsername,
      }).from(integrations).where(eq(integrations.clientId, client.id));

      const hasMetaAds = clientIntegrations.some(i => i.provider === "meta_token" && i.adAccountId);
      const igIntegration = clientIntegrations.find(i => i.provider === "instagram_oauth" && i.metaIgUserId)
        ?? clientIntegrations.find(i => i.provider === "meta_token" && i.metaIgUserId);
      return {
        id: client.id,
        name: client.name,
        hasMetaAds,
        igUsername: igIntegration?.metaIgUsername ?? null,
        whatsappNumber: client.whatsappNumber ?? null,
        mondayBoardId: client.mondayBoardId ?? null,
        logoUrl: client.logoUrl ?? null,
        brandColor: client.brandColor ?? null,
        reportTheme: client.reportTheme ?? "dark",
      };
    }),

  // ── Get public KPIs by client token (no auth required) ────────────────────
  // Uses the SAME fetchClientKpis function as the internal dashboard to guarantee identical data
  getPublicKpis: publicProcedure
    .input(z.object({ token: publicReportTokenSchema, from: z.string(), to: z.string(), managerToken: managerTokenSchema }))
    .query(async ({ input }) => {
      const { client } = await requirePublicClient(input.token, "public_kpis_read", input.managerToken);
      const clientId = client.id;
      const { from, to } = input;

      // Load client for salesChannelFilter
      const clientInfo = await getClientById(clientId);
      const salesChannelFilter = clientInfo?.salesChannelFilter ?? null;

      // Use the SAME function as the internal dashboard — no more divergence
      const kpis = await fetchClientKpis(clientId, from, to, salesChannelFilter);

      return kpis;
    }),

  // ── Get Instagram Insights by client token (no auth required) ────────────
  getPublicInstagramInsights: publicProcedure
    .input(z.object({ token: publicReportTokenSchema, from: z.string(), to: z.string(), managerToken: managerTokenSchema }))
    .query(async ({ input }) => {
      const { client } = await requirePublicClient(input.token, "public_instagram_read", input.managerToken);
      const clientId = client.id;

      const instagram = await resolvePreferredInstagramConnection(clientId);
      if (!instagram) return { connected: false, username: null, totals: null };

      try {
        const insights = await fetchInstagramInsightsByIgId(instagram.accessToken, instagram.metaIgUserId, input.from, input.to);
        return {
          connected: true,
          username: instagram.metaIgUsername,
          totals: insights,
        };
      } catch (e) {
        console.error("[PublicInstagram] Error:", e);
        return { connected: false, username: null, totals: null };
      }
    }),

  // ── Get public CRM leads by client token (no auth required) ───────────
  getPublicLeads: publicProcedure
    .input(z.object({
      token: z.string(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      dateField: z.enum(["consult", "conversion", "any"]).optional().default("any"),
    }))
    .query(async () => {
      // Public links deliberately expose only aggregate performance, never lead-level CRM data.
      throw new TRPCError({ code: "FORBIDDEN", message: "CRM Leads não está disponível em links públicos." });
    }),

  // ── Get public Instagram top posts by client token (no auth required) ────
  getPublicTopPosts: publicProcedure
    .input(z.object({ token: publicReportTokenSchema, limit: z.number().min(1).max(30).default(12), managerToken: managerTokenSchema }))
    .query(async ({ input }) => {
      const { client } = await requirePublicClient(input.token, "public_content_read", input.managerToken);
      const { id: clientId } = client;

      const instagram = await resolvePreferredInstagramConnection(clientId);
      if (!instagram) return { posts: [], error: "instagram_not_configured" };

      try {
        const { fetchIgMediaInsights } = await import("./crm");
        const posts = await fetchIgMediaInsights(instagram.metaIgUserId, instagram.accessToken, input.limit);
        return { posts, error: null };
      } catch (err) {
        return { posts: [], error: err instanceof Error ? err.message : String(err) };
      }
    }),

  // ── Get public ad creatives by client token (no auth required) ───────────
  getPublicCreatives: publicProcedure
    .input(z.object({ token: publicReportTokenSchema, from: z.string(), to: z.string(), managerToken: managerTokenSchema }))
    .query(async ({ input }) => {
      const { client } = await requirePublicClient(input.token, "public_creatives_read", input.managerToken);
      const { id: clientId } = client;

      const metaInteg = await getIntegration(clientId, "meta_token");
      // O token é o da agência quando existir; a conta continua por cliente.
      const { token: metaToken, adAccountId } = resolverToken(await getSystemSetting(CHAVE_TOKEN_AGENCIA), metaInteg);
      if (!metaToken || !adAccountId) {
        return { creatives: [], error: "meta_not_configured" };
      }

      const { fetchActiveCreatives } = await import("../metaApi");
      // Build list of all ad accounts (primary + additional from extraConfig)
      const extraCfg = metaInteg?.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null;
      const additionalAccts = extraCfg?.additionalAccounts ?? [];
      const primaryIds = adAccountId.includes(",")
        ? adAccountId.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [adAccountId];
      const allAccountIds = [...primaryIds, ...additionalAccts.map((a) => a.id)];

      const results = await Promise.all(
        allAccountIds.map((accountId: string) =>
          fetchActiveCreatives(metaToken, accountId, input.from, input.to)
        )
      );
      const creatives = results.flat().sort((a, b) => b.spend - a.spend);
      return { creatives, error: null };
    }),

  // ── Generate public AI report by client token (no auth required) ──────────
  generatePublicReport: publicProcedure
    .input(z.object({ token: publicReportTokenSchema, from: z.string(), to: z.string(), managerToken: managerTokenSchema }))
    .mutation(async ({ input }) => {
      const { client } = await requirePublicClient(input.token, "public_ai_report_generated", input.managerToken);
      const { id: clientId, name: clientName } = client;

      const clientInfo = await getClientById(clientId);
      const salesChannelFilter = clientInfo?.salesChannelFilter ?? null;

      // Use the same fetchClientKpis for consistent data
      const kpis = await fetchClientKpis(clientId, input.from, input.to, salesChannelFilter);
      const roas = kpis.roas;
      const custoPorLead = kpis.custoPorLead;

      const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

      const prompt = `Você é um especialista em tráfego pago. Analise os seguintes dados de performance do cliente "${clientName}" no período de ${input.from} a ${input.to} e gere um relatório executivo em português brasileiro.

DADOS DE PERFORMANCE:
- Investimento: ${fmt(kpis.investimento)}
- Leads: ${kpis.leads}
- Custo por Lead: ${fmt(custoPorLead)}
- ROAS: ${roas.toFixed(2)}x
- Consultas/Vendas: ${kpis.consultas ?? 0}
- Fechamentos: ${kpis.vendas}
- Total em Vendas: ${fmt(kpis.totalEmVendas)}
- Alcance: ${kpis.alcance.toLocaleString("pt-BR")}
- Cliques: ${kpis.cliquesEstimados.toLocaleString("pt-BR")}

Gere um relatório com: resumo executivo, pontos positivos, pontos de atenção e recomendações estratégicas. Seja objetivo e use dados concretos.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um especialista em marketing digital e tráfego pago. Gere relatórios executivos claros e objetivos." },
          { role: "user", content: prompt },
        ],
      });

      const analysis = response.choices[0]?.message?.content ?? "Não foi possível gerar a análise.";
      return { analysis };
    }),
});
