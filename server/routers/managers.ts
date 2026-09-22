import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb, getIntegration, upsertIntegration } from "../db";
import { managers, managerClients, clients, integrations, salesRecords, snapshots, reportConfig, reportChatHistory, leadAdMatches, capiEvents, creativeAnalyses, creativeBriefs, creativeAssets, beforeAfterPairs, beforeAfterCreatives } from "../../drizzle/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { fetchActiveCreatives, listAdAccounts, listInstagramProfiles, verifyAdAccountAccess, validateMetaToken } from "../metaApi";
import { getClientById, getSalesForPeriod, getSnapshotsByClientId, getSnapshotsInRange } from "../db";
import { calculateMappingReadiness } from "../intelligence";
import { calculateOpportunityRanking } from "../opportunityRanking";
import { invokeLLM } from "../_core/llm";
import { buildCreativeClassificationPrompt, fallbackCreativeClassification } from "../creativeAnalyst";
import { diagnoseCreativePerformance } from "../creativeDiagnostics";
import { buildCreativeBriefPrompt, fallbackCreativeBriefs, type BriefSource, type CreativeBriefDraft } from "../creativeAgent";
import { buildCreativeVisualPrompt } from "../creativeVisuals";
import { buildBeforeAfterCreativePrompt } from "../beforeAfterCreative";
import { generateImage } from "../_core/imageGeneration";
import { encryptSecret } from "../secretCipher";
import { getManagerJwtSecret } from "../managerAuthSecret";
import { getProfileListingToken, isPendingInstagramSelection, requireAccessibleInstagramProfile } from "../instagramOAuthSelection";
import { getLeadsForClient, getTopPostsForClient } from "./crm";
import { buildClientAdAccountIds } from "../adAccounts";

const MANAGER_JWT_EXPIRY = "30d";

// ─── JWT helpers ──────────────────────────────────────────────────────────────
async function verifyManagerJwt(token: string): Promise<{ managerId: number }> {
  try {
    const result = await jwtVerify(token, getManagerJwtSecret());
    return result.payload as unknown as { managerId: number };
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido ou expirado" });
  }
}

async function verifyManagerOwnsClient(token: string, clientId: number): Promise<void> {
  const payload = await verifyManagerJwt(token);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const assignment = await db.select().from(managerClients)
    .where(and(eq(managerClients.managerId, payload.managerId), eq(managerClients.clientId, clientId)))
    .limit(1);
  if (assignment.length === 0) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado a este cliente" });
}

// ─── Admin-only middleware ────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
  return next({ ctx });
});

export const managersRouter = router({
  // ── Create a new manager (admin only) ──────────────────────────────────────
  create: adminProcedure
    .input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db.query.managers.findFirst({
        where: eq(managers.email, input.email),
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado" });
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      await db.insert(managers).values({
        name: input.name,
        email: input.email,
        passwordHash,
      });
      return { success: true };
    }),

  // ── List all managers (admin only) ─────────────────────────────────────────
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const allManagers = await db.select({
      id: managers.id,
      name: managers.name,
      email: managers.email,
      active: managers.active,
      createdAt: managers.createdAt,
    }).from(managers);

    const allAssignments = await db.select().from(managerClients);
    const allClients = await db.select({ id: clients.id, name: clients.name }).from(clients);

    return allManagers.map((m) => ({
      ...m,
      clientIds: allAssignments.filter((a) => a.managerId === m.id).map((a) => a.clientId),
      clients: allAssignments
        .filter((a) => a.managerId === m.id)
        .map((a) => allClients.find((c) => c.id === a.clientId))
        .filter((c): c is { id: number; name: string } => Boolean(c)),
    }));
  }),

  // ── Delete a manager (admin only) ──────────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ managerId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(managerClients).where(eq(managerClients.managerId, input.managerId));
      await db.delete(managers).where(eq(managers.id, input.managerId));
      return { success: true };
    }),

  // ── Assign clients to a manager (admin only) ───────────────────────────────
  assignClients: adminProcedure
    .input(z.object({
      managerId: z.number(),
      clientIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(managerClients).where(eq(managerClients.managerId, input.managerId));
      if (input.clientIds.length > 0) {
        await db.insert(managerClients).values(
          input.clientIds.map((clientId) => ({ managerId: input.managerId, clientId }))
        );
      }
      return { success: true };
    }),

  // ── Manager login (public) ─────────────────────────────────────────────────
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const manager = await db.query.managers.findFirst({
        where: and(eq(managers.email, input.email), eq(managers.active, 1)),
      });
      if (!manager) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      }
      const valid = await bcrypt.compare(input.password, manager.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
      }
      const token = await new SignJWT({ managerId: manager.id, email: manager.email, name: manager.name })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(MANAGER_JWT_EXPIRY)
        .sign(getManagerJwtSecret());
      return { token, name: manager.name, email: manager.email, managerId: manager.id };
    }),

  // ── Create a client as manager (via JWT token) ─────────────────────────────
  createClientAsManager: publicProcedure
    .input(z.object({ token: z.string(), name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const payload = await verifyManagerJwt(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const crypto = await import("crypto");
      const publicToken = crypto.randomBytes(24).toString("hex");
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") + "-" + Date.now();
      await db.insert(clients).values({ userId: 1, name: input.name, slug, active: 1, publicToken });
      const newClient = await db.select().from(clients).where(eq(clients.publicToken, publicToken)).limit(1);
      if (!newClient[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar cliente" });
      await db.insert(managerClients).values({ managerId: payload.managerId, clientId: newClient[0].id });
      return newClient[0];
    }),

  // ── Delete a client as manager (via JWT token) ─────────────────────────────
  deleteClientAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(beforeAfterCreatives).where(eq(beforeAfterCreatives.clientId, input.clientId));
      await db.delete(beforeAfterPairs).where(eq(beforeAfterPairs.clientId, input.clientId));
      await db.delete(creativeAssets).where(eq(creativeAssets.clientId, input.clientId));
      await db.delete(creativeAnalyses).where(eq(creativeAnalyses.clientId, input.clientId));
      await db.delete(creativeBriefs).where(eq(creativeBriefs.clientId, input.clientId));
      await db.delete(capiEvents).where(eq(capiEvents.clientId, input.clientId));
      await db.delete(leadAdMatches).where(eq(leadAdMatches.clientId, input.clientId));
      await db.delete(reportChatHistory).where(eq(reportChatHistory.clientId, input.clientId));
      await db.delete(reportConfig).where(eq(reportConfig.clientId, input.clientId));
      await db.delete(salesRecords).where(eq(salesRecords.clientId, input.clientId));
      await db.delete(snapshots).where(eq(snapshots.clientId, input.clientId));
      await db.delete(managerClients).where(eq(managerClients.clientId, input.clientId));
      await db.delete(integrations).where(eq(integrations.clientId, input.clientId));
      await db.delete(clients).where(eq(clients.id, input.clientId));
      return { success: true };
    }),

  // ── Get manager's accessible clients (via JWT token) ───────────────────────
  myClients: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const payload = await verifyManagerJwt(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const assignments = await db.select().from(managerClients)
        .where(eq(managerClients.managerId, payload.managerId));
      const clientIds = assignments.map((a) => a.clientId);
      if (clientIds.length === 0) return { manager: null, clients: [] };

      const manager = await db.query.managers.findFirst({
        where: eq(managers.id, payload.managerId),
      });

      const assignedClients = await db.select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        publicToken: clients.publicToken,
        whatsappNumber: clients.whatsappNumber,
        whatsappGroupId: clients.whatsappGroupId,
        campaignTypes: clients.campaignTypes,
        mondayBoardId: clients.mondayBoardId,
        isPrePaid: clients.isPrePaid,
      }).from(clients)
        .where(inArray(clients.id, clientIds));

      return {
        manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : null,
        clients: assignedClients,
      };
    }),

  getLeadsAsManager: publicProcedure
    .input(z.object({
      token: z.string(),
      clientId: z.number(),
      status: z.string().optional(),
      origin: z.string().optional(),
      search: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      dateField: z.enum(["consult", "conversion", "any"]).optional(),
    }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      return getLeadsForClient(input);
    }),

  getTopPostsAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), limit: z.number().min(1).max(30).default(12) }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      return getTopPostsForClient(input);
    }),

  getCreativesAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const metaIntegration = await getIntegration(input.clientId, "meta_token");
      if (!metaIntegration?.accessToken || !metaIntegration.adAccountId) {
        return { creatives: [], error: "meta_not_configured" };
      }
      const extraConfig = metaIntegration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null;
      const primaryAccounts = metaIntegration.adAccountId.includes(",")
        ? metaIntegration.adAccountId.split(",").map((id: string) => id.trim()).filter(Boolean)
        : [metaIntegration.adAccountId];
      const accountIds = [...primaryAccounts, ...(extraConfig?.additionalAccounts ?? []).map(account => account.id)];
      const results = await Promise.all(accountIds.map(accountId =>
        fetchActiveCreatives(metaIntegration.accessToken!, accountId, input.from, input.to)
      ));
      return { creatives: results.flat().sort((a, b) => b.spend - a.spend), error: null };
    }),

  // ── Get Meta token status for a client (manager JWT auth) ──────────────────
  getClientMetaStatus: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration?.accessToken) return { connected: false, adAccountId: null };
      return { connected: true, adAccountId: integration.adAccountId ?? null };
    }),

  setPrePaidAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), isPrePaid: z.boolean() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(clients)
        .set({ isPrePaid: input.isPrePaid ? 1 : 0 })
        .where(eq(clients.id, input.clientId));
      return { success: true, isPrePaid: input.isPrePaid };
    }),

  // ── Get Instagram profile for a client (manager JWT auth) ──────────────────
  getClientInstagramProfile: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const ig = await getIntegration(input.clientId, "instagram_oauth");
      if (!ig?.metaIgUserId) return { connected: false, pending: isPendingInstagramSelection(ig), igUserId: null, username: null, tokenExpired: false, tokenWarning: false, daysSince: 0, updatedAt: null };
      const updatedAt = ig.updatedAt ? new Date(ig.updatedAt).toISOString() : null;
      const daysSince = updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000) : 999;
      const tokenExpired = daysSince > 60;
      const tokenWarning = daysSince > 50 && !tokenExpired;
      return { connected: true, pending: false, igUserId: ig.metaIgUserId, username: ig.metaIgUsername ?? null, tokenExpired, tokenWarning, daysSince, updatedAt };
    }),

  // ── List ad accounts using a token (manager JWT auth) ──────────────────────
  listAdAccountsAsManager: publicProcedure
    .input(z.object({ token: z.string(), accessToken: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerJwt(input.token);
      return listAdAccounts(input.accessToken);
    }),
  // ── Validate a Meta token (manager JWT auth) ────────────────────────────────
  validateMetaTokenAsManager: publicProcedure
    .input(z.object({ token: z.string(), accessToken: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerJwt(input.token);
      return validateMetaToken(input.accessToken);
    }),

  // ── List ad accounts using the saved token for a client (manager JWT) ─────────
  listAdAccountsForClientAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration?.accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Token Meta não configurado para este cliente" });
      return listAdAccounts(integration.accessToken);
    }),
  // ── Verify a manually entered ad account ID (manager JWT auth) ──────────────
  verifyAdAccountAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), adAccountId: z.string(), accessToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      // Use the provided accessToken if available, otherwise fall back to the saved one
      let tokenToUse = input.accessToken?.trim();
      if (!tokenToUse) {
        const integration = await getIntegration(input.clientId, "meta_token");
        tokenToUse = integration?.accessToken ?? undefined;
      }
      if (!tokenToUse) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o token Meta no campo acima antes de verificar a conta." });
      return verifyAdAccountAccess(tokenToUse, input.adAccountId);
    }),

  // ── Save Meta token for a client (manager JWT auth) ────────────────────────
  // ── Token da agência: um só para todos os clientes ────────────────────────
  // Guardar o token por cliente obrigava a colar o mesmo valor em cada um e a
  // repetir tudo a cada renovação. Como a agência usa um único usuário do
  // sistema no Meta, o token é um só — a conta de anúncio é que é por cliente.
  getTokenAgencia: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerJwt(input.token);
      const { getSystemSetting } = await import("../_core/systemRouter");
      const { CHAVE_TOKEN_AGENCIA } = await import("../metaTokenResolver");
      const valor = await getSystemSetting(CHAVE_TOKEN_AGENCIA);
      // O token nunca volta para a tela; só se ele existe e como termina,
      // o bastante para conferir qual está salvo sem expor a credencial.
      return {
        configurado: Boolean(valor),
        final: valor ? valor.slice(-6) : null,
      };
    }),

  salvarTokenAgencia: publicProcedure
    .input(z.object({ token: z.string(), accessToken: z.string().min(20, "Token muito curto") }))
    .mutation(async ({ input }) => {
      await verifyManagerJwt(input.token);
      const validacao = await validateMetaToken(input.accessToken.trim());
      if (!validacao.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validacao.error ?? "Token inválido" });
      }
      const { setSystemSetting } = await import("../_core/systemRouter");
      const { CHAVE_TOKEN_AGENCIA } = await import("../metaTokenResolver");
      await setSystemSetting(CHAVE_TOKEN_AGENCIA, input.accessToken.trim());
      return { success: true, nome: validacao.name ?? null };
    }),

  removerTokenAgencia: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerJwt(input.token);
      const { setSystemSetting } = await import("../_core/systemRouter");
      const { CHAVE_TOKEN_AGENCIA } = await import("../metaTokenResolver");
      await setSystemSetting(CHAVE_TOKEN_AGENCIA, "");
      return { success: true };
    }),

  saveClientMetaToken: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), accessToken: z.string(), adAccountId: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      await upsertIntegration({
        clientId: input.clientId,
        provider: "meta_token",
        accessToken: input.accessToken,
        adAccountId: input.adAccountId,
        boardId: null,
      });
      return { success: true };
    }),

  // ── Save Instagram profile for a client (manager JWT auth) ─────────────────
  saveClientInstagram: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), igUserId: z.string(), igUsername: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
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

  // ── List Instagram profiles via client's Meta token (manager JWT) ───────────
  listClientInstagramProfiles: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const [oauthIntegration, metaIntegration] = await Promise.all([
        getIntegration(input.clientId, "instagram_oauth"),
        getIntegration(input.clientId, "meta_token"),
      ]);
      const accessToken = getProfileListingToken(oauthIntegration?.accessToken, metaIntegration?.accessToken);
      if (!accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma autorização Meta disponível para listar perfis" });
      return listInstagramProfiles(accessToken);
    }),

  // ── Get additional ad accounts for a client (manager JWT) ──────────────────
  getAdditionalAccountsAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration) return { primaryAccount: null, additionalAccounts: [] };
      const extraConfig = integration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null;
      return {
        primaryAccount: integration.adAccountId ? { id: integration.adAccountId, name: "Conta Principal" } : null,
        additionalAccounts: extraConfig?.additionalAccounts ?? [],
      };
    }),

  // ── Add an additional ad account for a client (manager JWT) ────────────────
  addAdditionalAccountAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), accountId: z.string(), accountName: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration?.accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Token Meta não configurado para este cliente" });
      const extraConfig = (integration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null) ?? {};
      const existing = extraConfig.additionalAccounts ?? [];
      if (existing.find((a) => a.id === input.accountId)) throw new TRPCError({ code: "CONFLICT", message: "Conta já adicionada" });
      if (integration.adAccountId === input.accountId) throw new TRPCError({ code: "CONFLICT", message: "Esta é a conta principal" });
      const updated = [...existing, { id: input.accountId, name: input.accountName }];
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(integrations)
        .set({ extraConfig: { ...extraConfig, additionalAccounts: updated } })
        .where(and(eq(integrations.clientId, input.clientId), eq(integrations.provider, "meta_token")));
      return { success: true, additionalAccounts: updated };
    }),

  // ── Remove an additional ad account for a client (manager JWT) ─────────────
  removeAdditionalAccountAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), accountId: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const integration = await getIntegration(input.clientId, "meta_token");
      if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "Integração não encontrada" });
      const extraConfig = (integration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null) ?? {};
      const updated = (extraConfig.additionalAccounts ?? []).filter((a) => a.id !== input.accountId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(integrations)
        .set({ extraConfig: { ...extraConfig, additionalAccounts: updated } })
        .where(and(eq(integrations.clientId, input.clientId), eq(integrations.provider, "meta_token")));
      return { success: true, additionalAccounts: updated };
    }),

  // ── Update client slug (manager JWT auth) ─────────────────────────────────
  updateClientSlugAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/) }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db.select({ id: clients.id }).from(clients)
        .where(eq(clients.slug, input.slug)).limit(1);
      if (existing.length > 0 && existing[0].id !== input.clientId) {
        throw new TRPCError({ code: "CONFLICT", message: "Este slug já está em uso por outro cliente" });
      }
      await db.update(clients).set({ slug: input.slug }).where(eq(clients.id, input.clientId));
      return { slug: input.slug };
    }),

  // ── Rotate public report token (manager JWT auth) ──────────────────────────
  regeneratePublicReportTokenAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const crypto = await import("crypto");
      const publicToken = crypto.randomBytes(32).toString("hex");
      await db.update(clients).set({ publicToken }).where(eq(clients.id, input.clientId));
      return { publicToken };
    }),

  // CAPI config
  getCAPIConfigAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const client = await db.select({ metaPixelId: clients.metaPixelId, metaCAPIToken: clients.metaCAPIToken })
        .from(clients).where(eq(clients.id, input.clientId)).limit(1);
      const c = client[0];
      return {
        metaPixelId: c?.metaPixelId ?? "",
        configured: !!(c?.metaPixelId && c?.metaCAPIToken),
      };
    }),

  saveCAPIConfigAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), metaPixelId: z.string(), metaCAPIToken: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(clients)
        .set({ metaPixelId: input.metaPixelId || null, metaCAPIToken: encryptSecret(input.metaCAPIToken || null) })
        .where(eq(clients.id, input.clientId));
      return { success: true };
    }),

  // ── Register a new manager (public self-signup) ───────────────────────────────────────────────────
  register: publicProcedure
    .input(z.object({
      name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      email: z.string().email("E-mail inválido"),
      password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
      agencyName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db.select({ id: managers.id }).from(managers)
        .where(eq(managers.email, input.email)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const displayName = input.agencyName ? `${input.name} — ${input.agencyName}` : input.name;
      await db.insert(managers).values({ name: displayName, email: input.email, passwordHash, active: 1 });
      const newManager = await db.select().from(managers).where(eq(managers.email, input.email)).limit(1);
      if (!newManager[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar conta" });
      const token = await new SignJWT({ managerId: newManager[0].id, email: newManager[0].email, name: newManager[0].name })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(MANAGER_JWT_EXPIRY)
        .sign(getManagerJwtSecret());
      return { token, name: newManager[0].name, email: newManager[0].email };
    }),
  // -- Report theme per client
  getReportThemeAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const dbConn = db;
      const client = await dbConn.select({ reportTheme: clients.reportTheme }).from(clients).where(eq(clients.id, input.clientId)).limit(1);
      return { reportTheme: client[0]?.reportTheme ?? "dark" };
    }),
  saveReportThemeAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), reportTheme: z.enum(["dark", "light"]) }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const dbConn = db;
      await dbConn.update(clients).set({ reportTheme: input.reportTheme }).where(eq(clients.id, input.clientId));
      return { success: true };
    }),
  // ── Get KPIs for a client (manager JWT auth) ─────────────────────────────────
  getKpisAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const clientData = await getClientById(input.clientId);
      const salesChannelFilter = clientData?.salesChannelFilter ?? null;
      const { fetchClientKpis } = await import("../routers");
      return fetchClientKpis(input.clientId, input.from, input.to, salesChannelFilter);
    }),

  // ── Generate AI Report for a client (manager JWT auth) ─────────────────────────────────────────────────────
  generateReportAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), from: z.string(), to: z.string(), clientName: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const clientData = await getClientById(input.clientId);
      const salesChannelFilter = clientData?.salesChannelFilter ?? null;
      const { fetchClientKpis } = await import("../routers");
      const kpis = await fetchClientKpis(input.clientId, input.from, input.to, salesChannelFilter);
      const roas = kpis.roas;
      const custoPorLead = kpis.custoPorLead;
      const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
      const { invokeLLM } = await import("../_core/llm");
            // Build extra KPI lines only when values are meaningful
      const extraKpis: string[] = [];
      // Dados de vendas/consultas (quando disponíveis)
      if (roas > 0) extraKpis.push(`ROAS: ${roas.toFixed(2)}`);
      if ((kpis.totalConsultas ?? 0) > 0) extraKpis.push(`Total em Consultas: ${fmt(kpis.totalConsultas ?? 0)}`);
      if ((kpis.totalCirurgias ?? 0) > 0) extraKpis.push(`Fechamentos: ${kpis.vendas ?? 0}`);
      if ((kpis.totalCirurgias ?? 0) > 0) extraKpis.push(`Total em Fechamentos: ${fmt(kpis.totalCirurgias ?? 0)}`);
      if ((kpis.totalEmVendas ?? 0) > 0 && (kpis.totalConsultas ?? 0) === 0) extraKpis.push(`Total em Vendas: ${fmt(kpis.totalEmVendas ?? 0)}`);
      if ((kpis.alcance ?? 0) > 0) extraKpis.push(`Visitas ao perfil / Alcance: ${(kpis.alcance ?? 0).toLocaleString("pt-BR")}`);
      if ((kpis.cliquesEstimados ?? 0) > 0) extraKpis.push(`Cliques em formulário: ${(kpis.cliquesEstimados ?? 0).toLocaleString("pt-BR")}`);
      if ((kpis.novosSeguidores ?? 0) > 0) extraKpis.push(`Novos seguidores: ${(kpis.novosSeguidores ?? 0).toLocaleString("pt-BR")}`);
      const igUsername = (clientData as any)?.igUsername ?? null;
      const seguidoresLine = igUsername ? `Seguidores totais (@${igUsername}): (consulte o painel)` : "";
      const extraBlock = extraKpis.length > 0 ? "\n" + extraKpis.join("\n") : "";
      const segBlock = seguidoresLine ? "\n" + seguidoresLine : "";
      const systemPrompt = `Você é Scarlett, gestora de tráfego pago especializada em saúde e estética. Escreva o relatório de performance como se fosse uma mensagem de WhatsApp — próxima, direta, com personalidade. Sem travessões. Sem linguagem corporativa.

ESTRUTURA OBRIGATÓRIA — siga exatamente esta ordem:

1. Primeira linha sempre: "Olá! Tudo bem?"
2. Bloco de métricas (cada uma em linha separada, omita as que forem zero ou R$ 0,00)
3. Análise em 2-3 parágrafos curtos:
   - Parágrafo 1: contextualize os números principais (volume de leads, CPL, alcance, cliques) com uma observação concreta sobre o que eles significam para o negócio do cliente
   - Parágrafo 2: comente sobre tendência das campanhas, otimizações ou o que os dados revelam sobre a estratégia
   - Parágrafo 3 (opcional): fechamento motivador com perspectiva para o próximo período — pode usar uma metáfora leve ou emoji, com moderação
4. Perguntinhas (exatamente as 3 abaixo, sem alterar)

EXEMPLOS DE ANÁLISE NO ESTILO CERTO (use como referência de tom e profundidade, não copie):

Exemplo A (sem vendas):
"Nesse período conseguimos gerar 81 leads com um CPL de R$19,40, mantendo um custo relativamente controlado e um bom alcance das campanhas, com mais de 51 mil pessoas impactadas. Também tivemos mais de 1.100 cliques, mostrando que os anúncios estão despertando interesse e levando pessoas para o contato.
As campanhas mais recentes já começaram a apresentar uma melhora nos custos, com conjuntos trazendo conversas mais baratas e consistentes comparado às campanhas anteriores. Isso mostra que as otimizações e ajustes realizados estão ajudando a direcionar melhor o investimento e melhorar a entrega dos anúncios."

Exemplo B (com vendas):
"Nesse início de mês, as campanhas geraram 28 leads com CPL de R$12,48, mantendo um custo saudável para geração de oportunidades. Já tivemos 2 vendas registradas no período, totalizando R$750,00 em faturamento e ROAS de 2,15. O ticket médio ficou em R$375,00 e a taxa de conversão em 7,14%, mostrando que o funil já começou a gerar resultados mesmo com poucos dias de campanha rodando.
Seguimos acompanhando o desempenho para aumentar o volume de oportunidades e melhorar ainda mais o aproveitamento comercial. Esse é só o comecinho do mês… agora é continuar regando essa estratégia para fazer esse girassol brilhar cada vez mais 🌻✨"

REGRAS:
- Sem "Chegou a hora do relatório", "Que período incrível", "os números vieram redondinhos" ou qualquer frase genérica
- Sem asteriscos, sem markdown, sem títulos em caixa alta
- Métricas do bloco NÃO se repetem na análise em forma de lista — só integradas ao texto quando relevante
- Se não houver dados de vendas/consultas, foque no volume de leads, CPL e alcance
- NUNCA escreva colchetes literais como "[PERGUNTINHAS]", "[análise]", "[parágrafo]" — escreva o conteúdo real
- As 3 perguntas finais devem aparecer exatamente com os emojis: ✨ Perguntinhas: / 1️⃣ ... / 2️⃣ ... / 3️⃣ ...`;
      const userPrompt = `Gere o relatório do cliente "${input.clientName}" no período ${input.from} a ${input.to}.

DADOS (omita linhas com valor zero ou N/A):
Investimento: ${fmt(kpis.investimento)}
Leads: ${kpis.leads}
Custo por lead: ${fmt(custoPorLead)}
${(kpis.consultas ?? 0) > 0 ? `Consultas: ${kpis.consultas}\nCusto por consulta: ${fmt(kpis.investimento / (kpis.consultas ?? 1))}` : ""}${extraBlock}${segBlock}

✨ Perguntinhas:
1️⃣ Como você classifica a qualidade dos leads desse período? 👉 Ótimo | Mediano | Ruim | Péssimo
2️⃣ Como foi o engajamento desses leads?
3️⃣ Teve alguma objeção ou padrão que se repetiu?`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
            const rawContent2 = response.choices[0]?.message?.content;
      const analysis: string = typeof rawContent2 === 'string'
        ? rawContent2
        : Array.isArray(rawContent2)
          ? rawContent2.map((p: any) => p.text ?? '').join('')
          : "Não foi possível gerar a análise.";
      return { analysis };
    }),
  // ── Edit report analysis via AI chat (manager JWT auth) ────────────────────────────────────────────────────
  editReportWithChat: publicProcedure
    .input(z.object({
      token: z.string(),
      currentAnalysis: z.string(),
      instruction: z.string(),
      clientName: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Verify JWT (no need to check client ownership since we're just editing text)
      await verifyManagerJwt(input.token);
      const { invokeLLM } = await import("../_core/llm");
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é a Scarlett, gestora de tráfego pago. Você gerou uma análise de relatório para o cliente "${input.clientName}" e o usuário quer ajustá-la. Quando o usuário pedir para reescrever, ajustar tom, adicionar ou remover elementos, responda APENAS com o novo texto da análise completa, sem explicações adicionais. Mantenha o estilo humanizado e próximo. Não use travessões.`,
          },
          {
            role: "user",
            content: `Análise atual:\n\n${input.currentAnalysis}\n\nInstrução: ${input.instruction}`,
          },
        ],
      });
      const rawContent = response.choices[0]?.message?.content;
      const analysis: string = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((p: any) => p.text ?? '').join('')
          : input.currentAnalysis;
      return { analysis };
    }),

  // ── Get manager profile (via JWT token) ────────────────────────────────────────────────────────────────────

  // ── Get Trends for a client (manager JWT auth) ─────────────────────────────────────────────────────────────
  getTrendsAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const snaps = await getSnapshotsByClientId(input.clientId, 30);
      return snaps.reverse().map((s) => ({
        date: s.snapshotDate,
        investimento: parseFloat(String(s.investimento ?? 0)),
        leads: s.leads ?? 0,
        vendas: s.vendas ?? 0,
        totalEmVendas: parseFloat(String(s.totalEmVendas ?? 0)),
      }));
    }),

  // ── Get Instagram Insights for a client (manager JWT auth) ─────────────────────────────────────────────────
  getInsightsAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), since: z.string(), until: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const ig = await getIntegration(input.clientId, "instagram_oauth");
      if (!ig || !ig.metaIgUserId) {
        return { connected: false, username: null, totalFollowers: 0, totals: null, daily: null };
      }
      const metaTokenInteg = await getIntegration(input.clientId, "meta_token");
      const igToken = ig.accessToken || metaTokenInteg?.accessToken;
      if (!igToken) {
        return { connected: false, username: null, totalFollowers: 0, totals: null, daily: null };
      }
      const axios = (await import("axios")).default;
      const igId = ig.metaIgUserId;
      const username = ig.metaIgUsername ?? (ig as any).username ?? null;
      try {
        const accountRes = await axios.get(`https://graph.facebook.com/v21.0/${igId}`, {
          params: { fields: "followers_count,username", access_token: igToken },
        }).catch(() => null);
        const totalFollowers = accountRes?.data?.followers_count ?? 0;
        const igUsername = accountRes?.data?.username ?? username;
        const metricsRes = await axios.get(`https://graph.facebook.com/v21.0/${igId}/insights`, {
          params: {
            metric: "reach,profile_views,follower_count,accounts_engaged",
            period: "day",
            since: input.since,
            until: input.until,
            access_token: igToken,
          },
        }).catch(() => null);
        if (!metricsRes?.data?.data) {
          return { connected: true, username: igUsername, totalFollowers, totals: null, daily: null };
        }
        const metrics = metricsRes.data.data as Array<{ name: string; values: Array<{ value: number; end_time: string }> }>;
        const sumMetric = (name: string) => metrics.find(m => m.name === name)?.values.reduce((a, v) => a + (v.value || 0), 0) ?? 0;
        const totals = {
          reach: sumMetric("reach"),
          profileViews: sumMetric("profile_views"),
          newFollowers: sumMetric("follower_count"),
          interactions: sumMetric("accounts_engaged"),
        };
        return { connected: true, username: igUsername, totalFollowers, totals, daily: null };
      } catch {
        return { connected: true, username, totalFollowers: 0, totals: null, daily: null };
      }
    }),

  getProfile: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const payload = await verifyManagerJwt(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const manager = await db.select({ id: managers.id, name: managers.name, email: managers.email, createdAt: managers.createdAt })
        .from(managers).where(eq(managers.id, payload.managerId)).limit(1);
      return manager[0] ?? null;
    }),
  // ── Get campaign types for a client (manager JWT auth) ──────────────────────
  getCampaignTypesAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) return { campaignTypes: [] as string[] };
      const { clients: clientsSchema } = await import("../../drizzle/schema");
      const result = await db.select({ campaignTypes: clientsSchema.campaignTypes }).from(clientsSchema).where(eq(clientsSchema.id, input.clientId)).limit(1);
      const raw = result[0]?.campaignTypes;
      try { return { campaignTypes: (raw ? JSON.parse(raw) : []) as string[] }; } catch { return { campaignTypes: [] as string[] }; }
    }),
  // ── Save campaign types for a client (manager JWT auth) ─────────────────────
  saveCampaignTypesAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), campaignTypes: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { clients: clientsSchema } = await import("../../drizzle/schema");
      await db.update(clientsSchema).set({ campaignTypes: JSON.stringify(input.campaignTypes) }).where(eq(clientsSchema.id, input.clientId));
      return { success: true };
    }),

  getIntelligenceMappingsAsManager: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const payload = await verifyManagerJwt(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const assignments = await db.select({ clientId: managerClients.clientId })
        .from(managerClients)
        .where(eq(managerClients.managerId, payload.managerId));
      const clientIds = assignments.map((assignment) => assignment.clientId);
      if (clientIds.length === 0) return { items: [] };

      const assignedClients = await db.select().from(clients).where(inArray(clients.id, clientIds));
      const items = await Promise.all(assignedClients.map(async (client) => {
        const meta = await getIntegration(client.id, "meta_token");
        const instagram = await getIntegration(client.id, "instagram_oauth");
        const salesCountResult = await db.select({ total: sql<number>`COUNT(*)` })
          .from(salesRecords)
          .where(eq(salesRecords.clientId, client.id));
        const salesRecordsCount = Number(salesCountResult[0]?.total ?? 0);
        let campaignTypes: string[] = [];
        try { campaignTypes = client.campaignTypes ? JSON.parse(client.campaignTypes) : []; } catch { campaignTypes = []; }

        const readinessResult = calculateMappingReadiness({
          hasMetaAccount: Boolean(meta?.adAccountId),
          hasMondayBoard: Boolean(client.mondayBoardId),
          campaignTypesCount: campaignTypes.length,
          hasLeadChannel: Boolean(client.leadChannel),
          mappingConfirmed: Boolean(client.mappingConfirmed),
        });
        return {
          clientId: client.id,
          clientName: client.name,
          metaAdAccountId: meta?.adAccountId ?? null,
          mondayBoardId: client.mondayBoardId ?? null,
          instagramUsername: instagram?.metaIgUsername ?? null,
          campaignTypes,
          leadChannel: client.leadChannel ?? null,
          targetCpl: client.targetCpl ?? null,
          targetCostPerConsult: client.targetCostPerConsult ?? null,
          targetRoas: client.targetRoas ?? null,
          mappingNotes: client.mappingNotes ?? null,
          mappingConfirmed: Boolean(client.mappingConfirmed),
          salesRecordsCount,
          ...readinessResult,
        };
      }));

      return { items: items.sort((a, b) => a.readiness - b.readiness || a.clientName.localeCompare(b.clientName)) };
    }),

  saveIntelligenceMappingAsManager: publicProcedure
    .input(z.object({
      token: z.string(),
      clientId: z.number(),
      mondayBoardId: z.string().max(100).nullable(),
      leadChannel: z.enum(["whatsapp", "instagram", "formulario", "misto", "outro"]).nullable(),
      campaignTypes: z.array(z.enum(["lead", "profile_visit", "awareness"])),
      targetCpl: z.number().min(0).nullable(),
      targetCostPerConsult: z.number().min(0).nullable(),
      targetRoas: z.number().min(0).nullable(),
      mappingNotes: z.string().max(3000).nullable(),
      mappingConfirmed: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(clients).set({
        mondayBoardId: input.mondayBoardId?.trim() || null,
        leadChannel: input.leadChannel,
        campaignTypes: JSON.stringify(input.campaignTypes),
        targetCpl: input.targetCpl === null ? null : input.targetCpl.toFixed(2),
        targetCostPerConsult: input.targetCostPerConsult === null ? null : input.targetCostPerConsult.toFixed(2),
        targetRoas: input.targetRoas === null ? null : input.targetRoas.toFixed(2),
        mappingNotes: input.mappingNotes?.trim() || null,
        mappingConfirmed: input.mappingConfirmed ? 1 : 0,
      }).where(eq(clients.id, input.clientId));
      return { success: true };
    }),

  getOpportunityRankingAsManager: publicProcedure
    .input(z.object({ token: z.string(), from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      const payload = await verifyManagerJwt(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const assignments = await db.select({ clientId: managerClients.clientId })
        .from(managerClients)
        .where(eq(managerClients.managerId, payload.managerId));
      const clientIds = assignments.map((assignment) => assignment.clientId);
      if (!clientIds.length) return { items: [] };

      const mappedClients = (await db.select().from(clients).where(inArray(clients.id, clientIds)))
        .filter((client) => Boolean(client.mappingConfirmed));
      const { fetchClientKpis } = await import("../routers");
      const items: Array<Record<string, unknown>> = [];
      const concurrency = 3;

      for (let start = 0; start < mappedClients.length; start += concurrency) {
        const batch = mappedClients.slice(start, start + concurrency);
        const batchItems = await Promise.all(batch.map(async (client) => {
          try {
            const kpis = await fetchClientKpis(client.id, input.from, input.to, client.salesChannelFilter);
            const ranking = calculateOpportunityRanking({
              investimento: kpis.investimento ?? 0,
              leads: kpis.leads ?? 0,
              consultas: kpis.consultas ?? 0,
              totalConsultas: kpis.totalConsultas ?? 0,
              totalCirurgias: kpis.totalCirurgias ?? 0,
              metaApiSuccess: kpis.metaApiSuccess,
              mediaDataAvailable: kpis.mediaDataAvailable,
            }, {
              targetCpl: client.targetCpl ? Number(client.targetCpl) : null,
              targetCostPerConsult: client.targetCostPerConsult ? Number(client.targetCostPerConsult) : null,
              targetRoas: client.targetRoas ? Number(client.targetRoas) : null,
            });
            return {
              clientId: client.id,
              clientName: client.name,
              leadChannel: client.leadChannel,
              from: input.from,
              to: input.to,
              metrics: {
                investimento: kpis.investimento ?? 0,
                leads: kpis.leads ?? 0,
                consultas: kpis.consultas ?? 0,
                fechamentos: kpis.vendas ?? 0,
                receita: kpis.receitaTotal,
              },
              targets: {
                cpl: client.targetCpl ? Number(client.targetCpl) : null,
                costPerConsult: client.targetCostPerConsult ? Number(client.targetCostPerConsult) : null,
                roas: client.targetRoas ? Number(client.targetRoas) : null,
              },
              ...ranking,
            };
          } catch (error) {
            console.error(`[Opportunity Ranking] Failed for client ${client.id}:`, error);
            return {
              clientId: client.id,
              clientName: client.name,
              leadChannel: client.leadChannel,
              from: input.from,
              to: input.to,
              metrics: { investimento: 0, leads: 0, consultas: 0, fechamentos: 0, receita: 0 },
              targets: { cpl: client.targetCpl ? Number(client.targetCpl) : null, costPerConsult: client.targetCostPerConsult ? Number(client.targetCostPerConsult) : null, roas: client.targetRoas ? Number(client.targetRoas) : null },
              category: "dados_incompletos" as const,
              priority: "configurar" as const,
              score: 0,
              cpl: 0,
              costPerConsult: 0,
              roas: 0,
              evidence: ["Não foi possível ler os dados desse cliente agora."],
              recommendation: "Verifique a conexão Meta e tente atualizar novamente.",
            };
          }
        }));
        items.push(...batchItems);
      }

      const categoryOrder = { atencao: 0, oportunidade: 1, dados_incompletos: 2, estabilidade: 3 } as const;
      return { items: items.sort((a, b) => {
        const first = a as { category: keyof typeof categoryOrder; score: number; clientName: string };
        const second = b as { category: keyof typeof categoryOrder; score: number; clientName: string };
        return categoryOrder[first.category] - categoryOrder[second.category] || second.score - first.score || first.clientName.localeCompare(second.clientName);
      }) };
    }),

  getCreativeAnalysesAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const analyses = await db.select().from(creativeAnalyses)
        .where(and(
          eq(creativeAnalyses.clientId, input.clientId),
          eq(creativeAnalyses.periodFrom, input.from),
          eq(creativeAnalyses.periodTo, input.to),
        ))
        .orderBy(desc(creativeAnalyses.updatedAt));
      const client = await db.select({ targetCpl: clients.targetCpl }).from(clients)
        .where(eq(clients.id, input.clientId))
        .limit(1);
      const metrics = analyses.map((analysis) => {
        const raw = analysis.metrics as Record<string, unknown> | null;
        return {
          spend: Number(raw?.spend ?? 0),
          impressions: Number(raw?.impressions ?? 0),
          clicks: Number(raw?.clicks ?? 0),
          leads: Number(raw?.leads ?? 0),
          ctr: Number(raw?.ctr ?? 0),
          cpl: Number(raw?.cpl ?? 0),
        };
      });
      const targetCpl = client[0]?.targetCpl === null || client[0]?.targetCpl === undefined ? null : Number(client[0].targetCpl);
      const diagnostics = diagnoseCreativePerformance(metrics, targetCpl);
      return { analyses: analyses.map((analysis, index) => ({ ...analysis, diagnostic: diagnostics[index] })), targetCpl };
    }),

  analyzeCreativesAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), from: z.string(), to: z.string(), force: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const metaIntegration = await getIntegration(input.clientId, "meta_token");
      if (!metaIntegration?.accessToken || !metaIntegration?.adAccountId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conecte uma conta Meta antes de analisar criativos." });
      }

      const { fetchActiveCreatives } = await import("../metaApi");
      const extraConfig = metaIntegration.extraConfig as { additionalAccounts?: { id: string; name: string }[] } | null;
      const accountIds = buildClientAdAccountIds(
        metaIntegration.adAccountId,
        extraConfig?.additionalAccounts ?? [],
      );
      const creativeResults = await Promise.all(accountIds.map((accountId) => fetchActiveCreatives(metaIntegration.accessToken!, accountId, input.from, input.to)));
      const creatives = creativeResults.flat().sort((a, b) => b.spend - a.spend).slice(0, 15);
      if (!creatives.length) return { analyzed: 0, cached: 0, creatives: [], warning: "Nenhum anúncio ativo foi encontrado no período." };

      let analyzed = 0;
      let cached = 0;
      const results: Array<Record<string, unknown>> = [];
      const concurrency = 3;

      for (let start = 0; start < creatives.length; start += concurrency) {
        const batch = creatives.slice(start, start + concurrency);
        const batchResults = await Promise.all(batch.map(async (creative) => {
          const existing = await db.select().from(creativeAnalyses)
            .where(and(
              eq(creativeAnalyses.clientId, input.clientId),
              eq(creativeAnalyses.adId, creative.adId),
              eq(creativeAnalyses.periodFrom, input.from),
              eq(creativeAnalyses.periodTo, input.to),
            ))
            .limit(1);

          if (existing[0] && !input.force) {
            cached += 1;
            return { ...creative, analysis: existing[0] };
          }

          const fallback = fallbackCreativeClassification({
            body: creative.body,
            title: creative.title,
            callToAction: creative.callToAction,
            performance: { spend: creative.spend, impressions: creative.impressions, clicks: creative.clicks, leads: creative.leads, ctr: creative.ctr, cpl: creative.cpl },
          });
          let classification = fallback;

          try {
            const response = await invokeLLM({
              maxTokens: 1200,
              messages: [
                { role: "system", content: "Você é um analista de criativos Meta Ads. Responda exclusivamente o JSON solicitado. Seja conservador: não invente informação ausente." },
                { role: "user", content: buildCreativeClassificationPrompt({
                  adName: creative.adName,
                  campaignName: creative.campaignName,
                  format: creative.format,
                  title: creative.title,
                  body: creative.body,
                  callToAction: creative.callToAction,
                  performance: { spend: creative.spend, impressions: creative.impressions, clicks: creative.clicks, leads: creative.leads, ctr: creative.ctr, cpl: creative.cpl },
                }) },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "creative_classification",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      hook: { type: "string" },
                      angle: { type: "string" },
                      promise: { type: "string" },
                      proof: { type: "string" },
                      offer: { type: "string" },
                      callToAction: { type: "string" },
                      performanceInsight: { type: "string" },
                      testHypothesis: { type: "string" },
                      confidence: { type: "integer" },
                    },
                    required: ["hook", "angle", "promise", "proof", "offer", "callToAction", "performanceInsight", "testHypothesis", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
            });
            const raw = response.choices?.[0]?.message?.content;
            if (typeof raw === "string") {
              const parsed = JSON.parse(raw) as typeof fallback;
              classification = { ...parsed, confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)) };
            }
          } catch (error) {
            console.warn(`[Creative Analyst] Fallback used for ad ${creative.adId}`, error);
          }

          const values = {
            clientId: input.clientId,
            adId: creative.adId,
            periodFrom: input.from,
            periodTo: input.to,
            adName: creative.adName,
            campaignName: creative.campaignName,
            adsetName: creative.adsetName,
            format: creative.format,
            thumbnailUrl: creative.thumbnailUrl,
            hook: classification.hook,
            angle: classification.angle,
            promise: classification.promise,
            proof: classification.proof,
            offer: classification.offer,
            callToAction: classification.callToAction,
            performanceInsight: classification.performanceInsight,
            testHypothesis: classification.testHypothesis,
            confidence: classification.confidence,
            metrics: { spend: creative.spend, impressions: creative.impressions, reach: creative.reach, clicks: creative.clicks, leads: creative.leads, ctr: creative.ctr, cpl: creative.cpl },
          };

          if (existing[0]) await db.update(creativeAnalyses).set(values).where(eq(creativeAnalyses.id, existing[0].id));
          else await db.insert(creativeAnalyses).values(values);
          analyzed += 1;

          const saved = await db.select().from(creativeAnalyses)
            .where(and(eq(creativeAnalyses.clientId, input.clientId), eq(creativeAnalyses.adId, creative.adId), eq(creativeAnalyses.periodFrom, input.from), eq(creativeAnalyses.periodTo, input.to)))
            .limit(1);
          return { ...creative, analysis: saved[0] };
        }));
        results.push(...batchResults);
      }

      return { analyzed, cached, creatives: results, warning: null };
    }),

  getCreativeBriefsAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const briefs = await db.select().from(creativeBriefs)
        .where(and(
          eq(creativeBriefs.clientId, input.clientId),
          eq(creativeBriefs.periodFrom, input.from),
          eq(creativeBriefs.periodTo, input.to),
        ))
        .orderBy(creativeBriefs.priority, desc(creativeBriefs.updatedAt));
      return { briefs };
    }),

  generateCreativeBriefsAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), from: z.string(), to: z.string() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [client] = await db.select({
        name: clients.name,
        leadChannel: clients.leadChannel,
        campaignTypes: clients.campaignTypes,
        mappingNotes: clients.mappingNotes,
        targetCpl: clients.targetCpl,
      }).from(clients).where(eq(clients.id, input.clientId)).limit(1);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });

      const analyses = await db.select().from(creativeAnalyses)
        .where(and(
          eq(creativeAnalyses.clientId, input.clientId),
          eq(creativeAnalyses.periodFrom, input.from),
          eq(creativeAnalyses.periodTo, input.to),
        ));
      if (!analyses.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Analise os criativos antes de gerar briefs." });

      const metrics = analyses.map((analysis) => {
        const raw = analysis.metrics as Record<string, unknown> | null;
        return { spend: Number(raw?.spend ?? 0), impressions: Number(raw?.impressions ?? 0), clicks: Number(raw?.clicks ?? 0), leads: Number(raw?.leads ?? 0), ctr: Number(raw?.ctr ?? 0), cpl: Number(raw?.cpl ?? 0) };
      });
      const targetCpl = client.targetCpl === null ? null : Number(client.targetCpl);
      const diagnostics = diagnoseCreativePerformance(metrics, targetCpl);
      const allSources: BriefSource[] = analyses.map((analysis, index) => ({
        id: analysis.id,
        adName: analysis.adName,
        format: analysis.format,
        hook: analysis.hook,
        angle: analysis.angle,
        callToAction: analysis.callToAction,
        testHypothesis: analysis.testHypothesis,
        metrics: { ctr: metrics[index].ctr, leads: metrics[index].leads, cpl: metrics[index].cpl },
      }));
      const sourceBriefs = allSources
        .filter((_, index) => diagnostics[index]?.label === "Referência")
        .sort((a, b) => b.metrics.leads - a.metrics.leads || a.metrics.cpl - b.metrics.cpl);
      const sources = (sourceBriefs.length ? sourceBriefs : allSources.sort((a, b) => b.metrics.leads - a.metrics.leads || a.metrics.cpl - b.metrics.cpl)).slice(0, 5);
      const context = { name: client.name, leadChannel: client.leadChannel, campaignTypes: client.campaignTypes, mappingNotes: client.mappingNotes, targetCpl };
      let drafts = fallbackCreativeBriefs(context, sources);

      try {
        const response = await invokeLLM({
          maxTokens: 3000,
          messages: [
            { role: "system", content: "Você é um diretor de criação de performance para Meta Ads. Responda somente o JSON solicitado. Crie briefs executáveis, específicos e responsáveis. Não faça promessas garantidas e não recomende publicação automática." },
            { role: "user", content: buildCreativeBriefPrompt(context, sources) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "creative_briefs",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  briefs: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" }, objective: { type: "string" }, targetAudience: { type: "string" }, hypothesis: { type: "string" }, hook: { type: "string" }, angle: { type: "string" }, coreMessage: { type: "string" }, visualDirection: { type: "string" }, script: { type: "string" }, primaryText: { type: "string" }, headline: { type: "string" }, callToAction: { type: "string" }, format: { type: "string" }, variableToTest: { type: "string" }, successMetric: { type: "string" }, priority: { type: "integer" }, sourceCreativeAnalysisId: { type: "integer" },
                      },
                      required: ["title", "objective", "targetAudience", "hypothesis", "hook", "angle", "coreMessage", "visualDirection", "script", "primaryText", "headline", "callToAction", "format", "variableToTest", "successMetric", "priority", "sourceCreativeAnalysisId"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["briefs"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices?.[0]?.message?.content;
        if (typeof raw === "string") {
          const parsed = JSON.parse(raw) as { briefs?: CreativeBriefDraft[] };
          if (parsed.briefs?.length === 3 && parsed.briefs.every((brief) => brief.title && brief.hook && brief.visualDirection && brief.script)) {
            drafts = parsed.briefs.map((brief, index) => ({
              ...brief,
              priority: Math.max(1, Math.min(3, Number(brief.priority) || index + 1)),
              sourceCreativeAnalysisId: sources.some((source) => source.id === brief.sourceCreativeAnalysisId) ? brief.sourceCreativeAnalysisId : sources[0]?.id ?? null,
            }));
          }
        }
      } catch (error) {
        console.warn("[Creative Agent] Using fallback briefs", error);
      }

      await db.insert(creativeBriefs).values(drafts.map((brief) => ({
        clientId: input.clientId,
        sourceCreativeAnalysisId: brief.sourceCreativeAnalysisId,
        periodFrom: input.from,
        periodTo: input.to,
        title: brief.title,
        objective: brief.objective,
        targetAudience: brief.targetAudience,
        hypothesis: brief.hypothesis,
        hook: brief.hook,
        angle: brief.angle,
        coreMessage: brief.coreMessage,
        visualDirection: brief.visualDirection,
        script: brief.script,
        primaryText: brief.primaryText,
        headline: brief.headline,
        callToAction: brief.callToAction,
        format: brief.format,
        variableToTest: brief.variableToTest,
        successMetric: brief.successMetric,
        priority: brief.priority,
      })));
      const briefs = await db.select().from(creativeBriefs)
        .where(and(eq(creativeBriefs.clientId, input.clientId), eq(creativeBriefs.periodFrom, input.from), eq(creativeBriefs.periodTo, input.to)))
        .orderBy(creativeBriefs.priority, desc(creativeBriefs.updatedAt));
      return { briefs, sourcesUsed: sources.length };
    }),

  updateCreativeBriefStatusAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), briefId: z.number(), status: z.enum(["draft", "approved", "rejected", "tested"]), reviewNotes: z.string().max(5000).nullable().optional() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [brief] = await db.select().from(creativeBriefs).where(and(eq(creativeBriefs.id, input.briefId), eq(creativeBriefs.clientId, input.clientId))).limit(1);
      if (!brief) throw new TRPCError({ code: "NOT_FOUND", message: "Brief não encontrado" });
      await db.update(creativeBriefs).set({ status: input.status, reviewNotes: input.reviewNotes ?? brief.reviewNotes }).where(eq(creativeBriefs.id, input.briefId));
      return { success: true };
    }),

  getCreativeAssetsAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), briefId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const assets = await db.select().from(creativeAssets)
        .where(and(eq(creativeAssets.clientId, input.clientId), eq(creativeAssets.briefId, input.briefId)))
        .orderBy(desc(creativeAssets.updatedAt));
      return { assets };
    }),

  generateCreativeAssetAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), briefId: z.number(), aspectRatio: z.enum(["4:5", "9:16"]).default("4:5") }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [brief] = await db.select().from(creativeBriefs)
        .where(and(eq(creativeBriefs.id, input.briefId), eq(creativeBriefs.clientId, input.clientId)))
        .limit(1);
      if (!brief) throw new TRPCError({ code: "NOT_FOUND", message: "Brief não encontrado" });
      if (brief.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Aprove o brief antes de gerar o visual." });

      const prompt = buildCreativeVisualPrompt({
        title: brief.title,
        hook: brief.hook,
        angle: brief.angle,
        coreMessage: brief.coreMessage,
        visualDirection: brief.visualDirection,
        format: brief.format,
        targetAudience: brief.targetAudience,
      }, input.aspectRatio);
      const generated = await generateImage({ prompt });
      if (!generated.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A imagem não foi gerada. Tente novamente." });
      await db.insert(creativeAssets).values({
        clientId: input.clientId,
        briefId: input.briefId,
        imageUrl: generated.url,
        generationPrompt: prompt,
        aspectRatio: input.aspectRatio,
      });
      const [asset] = await db.select().from(creativeAssets)
        .where(and(eq(creativeAssets.clientId, input.clientId), eq(creativeAssets.briefId, input.briefId)))
        .orderBy(desc(creativeAssets.createdAt))
        .limit(1);
      return { asset };
    }),

  updateCreativeAssetStatusAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), assetId: z.number(), status: z.enum(["generated", "approved", "rejected"]), reviewNotes: z.string().max(5000).nullable().optional() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [asset] = await db.select().from(creativeAssets).where(and(eq(creativeAssets.id, input.assetId), eq(creativeAssets.clientId, input.clientId))).limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Criativo visual não encontrado" });
      await db.update(creativeAssets).set({ status: input.status, reviewNotes: input.reviewNotes ?? asset.reviewNotes }).where(eq(creativeAssets.id, input.assetId));
      return { success: true };
    }),

  getBeforeAfterPairsAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const pairs = await db.select().from(beforeAfterPairs)
        .where(eq(beforeAfterPairs.clientId, input.clientId))
        .orderBy(desc(beforeAfterPairs.createdAt));
      return { pairs };
    }),

  uploadBeforeAfterPairAsManager: publicProcedure
    .input(z.object({
      token: z.string(),
      clientId: z.number(),
      label: z.string().trim().min(2).max(255),
      beforeBase64: z.string().min(50),
      afterBase64: z.string().min(50),
      beforeMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      afterMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      consentConfirmed: z.literal(true),
    }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { storagePut } = await import("../storage");
      const decode = (base64: string) => Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
      const extension = (mime: string) => mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
      const timestamp = Date.now();
      const [beforeStored, afterStored] = await Promise.all([
        storagePut(`before-after/${input.clientId}/${timestamp}-before.${extension(input.beforeMimeType)}`, decode(input.beforeBase64), input.beforeMimeType),
        storagePut(`before-after/${input.clientId}/${timestamp}-after.${extension(input.afterMimeType)}`, decode(input.afterBase64), input.afterMimeType),
      ]);
      await db.insert(beforeAfterPairs).values({
        clientId: input.clientId,
        label: input.label,
        beforeUrl: beforeStored.url,
        afterUrl: afterStored.url,
        consentConfirmed: true,
      });
      const [pair] = await db.select().from(beforeAfterPairs)
        .where(and(eq(beforeAfterPairs.clientId, input.clientId), eq(beforeAfterPairs.beforeUrl, beforeStored.url)))
        .limit(1);
      return { pair };
    }),

  deleteBeforeAfterPairAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), pairId: z.number() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(beforeAfterCreatives).where(and(eq(beforeAfterCreatives.clientId, input.clientId), eq(beforeAfterCreatives.pairId, input.pairId)));
      await db.delete(beforeAfterPairs).where(and(eq(beforeAfterPairs.clientId, input.clientId), eq(beforeAfterPairs.id, input.pairId)));
      return { success: true };
    }),

  getBeforeAfterCreativesAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), pairId: z.number() }))
    .query(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const storedCreatives = await db.select().from(beforeAfterCreatives)
        .where(and(eq(beforeAfterCreatives.clientId, input.clientId), eq(beforeAfterCreatives.pairId, input.pairId)))
        .orderBy(desc(beforeAfterCreatives.updatedAt));
      const creatives = storedCreatives.filter((creative) => creative.generationPrompt.startsWith("[COMPOSICAO_FIEL]") && creative.status !== "rejected");
      return { creatives };
    }),

  saveComposedBeforeAfterCreativeAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), pairId: z.number(), briefId: z.number(), aspectRatio: z.enum(["4:5", "9:16"]), imageBase64: z.string().min(100) }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [pair] = await db.select().from(beforeAfterPairs).where(and(eq(beforeAfterPairs.id, input.pairId), eq(beforeAfterPairs.clientId, input.clientId))).limit(1);
      if (!pair || !pair.consentConfirmed) throw new TRPCError({ code: "BAD_REQUEST", message: "Use um par autorizado de antes e depois." });
      const [brief] = await db.select().from(creativeBriefs).where(and(eq(creativeBriefs.id, input.briefId), eq(creativeBriefs.clientId, input.clientId))).limit(1);
      if (!brief || brief.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Use um brief aprovado para criar o estático." });
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.imageBase64.replace(/^data:image\/png;base64,/, ""), "base64");
      const { url } = await storagePut(`before-after-composed/${input.clientId}/${Date.now()}.png`, buffer, "image/png");
      await db.insert(beforeAfterCreatives).values({
        clientId: input.clientId,
        pairId: input.pairId,
        briefId: input.briefId,
        imageUrl: url,
        generationPrompt: "[COMPOSICAO_FIEL] Estático composto diretamente com as duas fotos originais autorizadas, sem IA generativa.",
        aspectRatio: input.aspectRatio,
      });
      const [creative] = await db.select().from(beforeAfterCreatives)
        .where(and(eq(beforeAfterCreatives.clientId, input.clientId), eq(beforeAfterCreatives.pairId, input.pairId), eq(beforeAfterCreatives.imageUrl, url)))
        .limit(1);
      return { creative };
    }),

  generateBeforeAfterCreativeAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), pairId: z.number(), briefId: z.number(), aspectRatio: z.enum(["4:5", "9:16"]).default("4:5") }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [pair] = await db.select().from(beforeAfterPairs)
        .where(and(eq(beforeAfterPairs.id, input.pairId), eq(beforeAfterPairs.clientId, input.clientId)))
        .limit(1);
      if (!pair) throw new TRPCError({ code: "NOT_FOUND", message: "Par de antes e depois não encontrado" });
      if (!pair.consentConfirmed) throw new TRPCError({ code: "BAD_REQUEST", message: "Confirme a autorização de uso das fotos antes de gerar o criativo." });
      const [brief] = await db.select().from(creativeBriefs)
        .where(and(eq(creativeBriefs.id, input.briefId), eq(creativeBriefs.clientId, input.clientId)))
        .limit(1);
      if (!brief) throw new TRPCError({ code: "NOT_FOUND", message: "Brief não encontrado" });
      if (brief.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Aprove o brief antes de gerar o estático." });

      const prompt = buildBeforeAfterCreativePrompt({
        title: brief.title,
        hook: brief.hook,
        angle: brief.angle,
        coreMessage: brief.coreMessage,
        visualDirection: brief.visualDirection,
        format: brief.format,
      }, input.aspectRatio);
      const generated = await generateImage({ prompt, originalImages: [{ url: pair.beforeUrl }, { url: pair.afterUrl }] });
      if (!generated.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O estático não foi gerado. Tente novamente." });
      await db.insert(beforeAfterCreatives).values({ clientId: input.clientId, pairId: input.pairId, briefId: input.briefId, imageUrl: generated.url, generationPrompt: prompt, aspectRatio: input.aspectRatio });
      const [creative] = await db.select().from(beforeAfterCreatives)
        .where(and(eq(beforeAfterCreatives.clientId, input.clientId), eq(beforeAfterCreatives.pairId, input.pairId)))
        .orderBy(desc(beforeAfterCreatives.createdAt)).limit(1);
      return { creative };
    }),

  updateBeforeAfterCreativeStatusAsManager: publicProcedure
    .input(z.object({ token: z.string(), clientId: z.number(), creativeId: z.number(), status: z.enum(["generated", "approved", "rejected"]), reviewNotes: z.string().max(5000).nullable().optional() }))
    .mutation(async ({ input }) => {
      await verifyManagerOwnsClient(input.token, input.clientId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [creative] = await db.select().from(beforeAfterCreatives).where(and(eq(beforeAfterCreatives.id, input.creativeId), eq(beforeAfterCreatives.clientId, input.clientId))).limit(1);
      if (!creative) throw new TRPCError({ code: "NOT_FOUND", message: "Criativo estático não encontrado" });
      await db.update(beforeAfterCreatives).set({ status: input.status, reviewNotes: input.reviewNotes ?? creative.reviewNotes }).where(eq(beforeAfterCreatives.id, input.creativeId));
      return { success: true };
    }),
});
