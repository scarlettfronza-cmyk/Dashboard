/**
 * Lead Tracking Router
 * Sincroniza leads do Meta Lead Ads com Monday.com pelo telefone
 * e envia conversões para a Meta Conversions API (CAPI)
 *
 * Eventos suportados:
 *   Lead             — lead novo entra no CRM (sincronização Lead Ads)
 *   Schedule         — status muda para "Consulta Agendada"
 *   Purchase         — lead fechado (convertido/cirurgia)
 *   InitiateCheckout — venda registrada no Sales (início da negociação)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getIntegration, getClientById } from "../db";
import { leadAdMatches, clients, capiEvents } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { fetchMetaLeadAdLeads, normalizePhone, sendCAPIConversionEvent } from "../metaApi";
import { fetchMondayLeads, mapLead } from "./crm";
import { encryptSecret } from "../secretCipher";

// ─── Helper: log CAPI event to DB ─────────────────────────────────────────────
async function logCapiEvent(params: {
  clientId: number;
  phone: string;
  eventName: string;
  eventTime: number;
  value?: number;
  sourceType: string;
  sourceId?: string;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(capiEvents).values({
      clientId: params.clientId,
      phone: params.phone,
      eventName: params.eventName,
      eventTime: params.eventTime,
      value: params.value ? String(params.value) : null,
      currency: "BRL",
      sourceType: params.sourceType,
      sourceId: params.sourceId ?? null,
      success: params.success,
      errorMessage: params.errorMessage ?? null,
    });
  } catch (err) {
    // Não deixa falha de log quebrar o fluxo principal
    console.error("[CAPI Log] Failed to log event:", err);
  }
}

// ─── Helper: send CAPI event + log ────────────────────────────────────────────
async function sendAndLogCapiEvent(params: {
  clientId: number;
  pixelId: string;
  capiToken: string;
  phone: string;
  eventName: string;
  value?: number;
  sourceType: string;
  sourceId?: string;
}): Promise<boolean> {
  const eventTime = Math.floor(Date.now() / 1000);
  let success = false;
  let errorMessage: string | undefined;

  try {
    success = await sendCAPIConversionEvent({
      pixelId: params.pixelId,
      capiToken: params.capiToken,
      phone: params.phone,
      eventName: params.eventName,
      eventTime,
      value: params.value,
    });
  } catch (err: any) {
    errorMessage = err?.message ?? String(err);
    success = false;
  }

  await logCapiEvent({
    clientId: params.clientId,
    phone: params.phone,
    eventName: params.eventName,
    eventTime,
    value: params.value,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    success,
    errorMessage,
  });

  return success;
}

export const leadTrackingRouter = router({
  // Sincroniza leads do Meta Lead Ads com o banco de dados
  // Retorna quantos leads novos foram encontrados e cruzados
  syncLeadAds: protectedProcedure
    .input(z.object({ clientId: z.number(), daysBack: z.number().min(1).max(365).default(90) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const clientData = await getClientById(input.clientId);
      if (!clientData) throw new Error("Cliente não encontrado");

      // Busca token e adAccountId do Meta
      const metaInteg = await getIntegration(input.clientId, "meta_token");
      const metaAdsInteg = await getIntegration(input.clientId, "meta_ads");
      const token = metaInteg?.accessToken ?? metaAdsInteg?.accessToken;
      const adAccountId = metaInteg?.adAccountId ?? metaAdsInteg?.adAccountId;

      if (!token || !adAccountId) {
        return { success: false, error: "meta_not_configured", synced: 0, matched: 0 };
      }

      // Busca leads do Meta Lead Ads
      console.log(`[LeadTracking] Fetching Meta Lead Ads for client ${input.clientId}, account ${adAccountId}`);
      const metaLeads = await fetchMetaLeadAdLeads(token, adAccountId, input.daysBack);
      console.log(`[LeadTracking] Found ${metaLeads.length} leads on Meta`);

      if (!metaLeads.length) {
        return { success: true, synced: 0, matched: 0, total: 0 };
      }

      // Salva/atualiza no banco (upsert por metaLeadId)
      let synced = 0;
      let capiLeadSent = 0;
      for (const lead of metaLeads) {
        try {
          const existing = await db.select({ id: leadAdMatches.id })
            .from(leadAdMatches)
            .where(eq(leadAdMatches.metaLeadId, lead.leadId))
            .limit(1);

          if (!existing.length) {
            await db.insert(leadAdMatches).values({
              clientId: input.clientId,
              phone: lead.phone,
              adId: lead.adId,
              adName: lead.adName,
              adSetName: lead.adSetName,
              campaignId: lead.campaignId,
              campaignName: lead.campaignName,
              formId: lead.formId,
              metaLeadId: lead.leadId,
              createdTimeOnMeta: lead.createdTime ? new Date(lead.createdTime) : null,
              capiSent: false,
            });
            synced++;

            // Dispara evento Lead para CAPI se configurado
            if (clientData.metaPixelId && clientData.metaCAPIToken && lead.phone) {
              const ok = await sendAndLogCapiEvent({
                clientId: input.clientId,
                pixelId: clientData.metaPixelId,
                capiToken: clientData.metaCAPIToken,
                phone: lead.phone,
                eventName: "Lead",
                sourceType: "meta_lead_ads",
                sourceId: lead.leadId,
              });
              if (ok) capiLeadSent++;
            }
          }
        } catch (err) {
          // Ignora duplicatas (unique constraint)
        }
      }

      console.log(`[LeadTracking] Synced ${synced} new leads, sent ${capiLeadSent} Lead events for client ${input.clientId}`);
      return { success: true, synced, capiLeadSent, total: metaLeads.length };
    }),

  // Busca o match de campanha para um telefone específico
  getMatchByPhone: protectedProcedure
    .input(z.object({ clientId: z.number(), phone: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const normalized = normalizePhone(input.phone);
      if (!normalized) return null;

      // Tenta match exato primeiro, depois por sufixo (últimos 9 dígitos)
      const exact = await db.select()
        .from(leadAdMatches)
        .where(and(
          eq(leadAdMatches.clientId, input.clientId),
          eq(leadAdMatches.phone, normalized)
        ))
        .limit(1);

      if (exact.length) return exact[0];

      // Fallback: match por últimos 9 dígitos (diferença de DDI)
      const suffix = normalized.slice(-9);
      const all = await db.select()
        .from(leadAdMatches)
        .where(eq(leadAdMatches.clientId, input.clientId));

      const fuzzy = all.find(m => m.phone.endsWith(suffix));
      return fuzzy ?? null;
    }),

  // Retorna todos os matches de campanha para um cliente (para exibir no CRM)
  getMatchMap: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {};
      const matches = await db.select()
        .from(leadAdMatches)
        .where(eq(leadAdMatches.clientId, input.clientId));

      // Retorna mapa: phone -> { adName, campaignName, adSetName }
      const map: Record<string, { adName: string; campaignName: string; adSetName: string; adId: string; campaignId: string }> = {};
      for (const m of matches) {
        if (m.phone) {
          map[m.phone] = {
            adName: m.adName ?? "",
            campaignName: m.campaignName ?? "",
            adSetName: m.adSetName ?? "",
            adId: m.adId ?? "",
            campaignId: m.campaignId ?? "",
          };
          // Também indexa por sufixo de 9 dígitos para match fuzzy
          const suffix = m.phone.slice(-9);
          if (!map[suffix]) {
            map[suffix] = map[m.phone];
          }
        }
      }
      return map;
    }),

  // Envia eventos de conversão para a CAPI baseado no status do Monday
  // Dispara: Schedule (consulta agendada) e Purchase (fechado)
  sendCAPIForClosedLeads: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const clientData = await getClientById(input.clientId);
      if (!clientData?.metaPixelId || !clientData?.metaCAPIToken) {
        return { success: false, error: "capi_not_configured", sent: 0 };
      }

      // Busca matches que ainda não foram enviados para CAPI (Purchase)
      const pending = await db.select()
        .from(leadAdMatches)
        .where(and(
          eq(leadAdMatches.clientId, input.clientId),
          eq(leadAdMatches.capiSent, false)
        ));

      if (!pending.length) return { success: true, sent: 0 };

      // Busca leads do Monday para verificar status
      const { systemSettings } = await import("../../drizzle/schema");
      const { eq: eqLocal } = await import("drizzle-orm");
      const globalToken = await db.select().from(systemSettings)
        .where(eqLocal(systemSettings.key, "monday_api_token"))
        .then(r => r[0]?.value ?? null);
      const clientInteg = await getIntegration(input.clientId, "monday");
      const mondayToken = globalToken ?? clientInteg?.accessToken;
      if (!mondayToken || !clientData.mondayBoardId) {
        return { success: false, error: "monday_not_configured", sent: 0 };
      }

      const { columns, items } = await fetchMondayLeads(clientData.mondayBoardId, mondayToken);
      const mondayLeads = items.map(item => mapLead(item, columns));

      // Status que indicam consulta agendada
      const scheduleStatuses = ["consulta agendada", "agendado", "agendada", "consulta marcada", "marcado", "marcada"];
      // Status que indicam fechamento
      const closedStatuses = ["fechado", "fechou", "convertido", "cirurgia", "procedimento agendado", "venda"];

      let sent = 0;
      let scheduleSent = 0;

      for (const match of pending) {
        const normalizedMatchPhone = match.phone;

        // Encontra o lead no Monday pelo telefone
        const mondayLead = mondayLeads.find(cl => {
          const clPhone = normalizePhone(cl.phone);
          return clPhone === normalizedMatchPhone ||
            (clPhone.length >= 9 && normalizedMatchPhone.endsWith(clPhone.slice(-9)));
        });

        if (!mondayLead) continue;

        const statusLower = mondayLead.status.toLowerCase();

        // Verifica se está com consulta agendada — dispara Schedule
        const isScheduled = scheduleStatuses.some(s => statusLower.includes(s));
        if (isScheduled) {
          const ok = await sendAndLogCapiEvent({
            clientId: input.clientId,
            pixelId: clientData.metaPixelId!,
            capiToken: clientData.metaCAPIToken!,
            phone: match.phone,
            eventName: "Schedule",
            sourceType: "monday_crm",
            sourceId: mondayLead.mondayId,
          });
          if (ok) scheduleSent++;
        }

        // Verifica se está fechado — dispara Purchase
        const isClosed = closedStatuses.some(s => statusLower.includes(s));
        if (isClosed) {
          const value = mondayLead.closedValue
            ? parseFloat(mondayLead.closedValue)
            : mondayLead.surgeryValue
            ? parseFloat(mondayLead.surgeryValue)
            : mondayLead.value
            ? parseFloat(mondayLead.value)
            : undefined;

          const ok = await sendAndLogCapiEvent({
            clientId: input.clientId,
            pixelId: clientData.metaPixelId!,
            capiToken: clientData.metaCAPIToken!,
            phone: match.phone,
            eventName: "Purchase",
            value,
            sourceType: "monday_crm",
            sourceId: mondayLead.mondayId,
          });

          if (ok) {
            await db.update(leadAdMatches)
              .set({ capiSent: true, capiSentAt: new Date() })
              .where(eq(leadAdMatches.id, match.id));
            sent++;
          }
        }
      }

      console.log(`[LeadTracking CAPI] Sent ${sent} Purchase + ${scheduleSent} Schedule events for client ${input.clientId}`);
      return { success: true, sent, scheduleSent };
    }),

  // Salva configuração de Pixel ID e Token CAPI para um cliente
  saveCAPIConfig: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      pixelId: z.string(),
      capiToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(clients)
        .set({ metaPixelId: input.pixelId, metaCAPIToken: encryptSecret(input.capiToken) })
        .where(eq(clients.id, input.clientId));
      return { success: true };
    }),

  // Retorna configuração de CAPI do cliente
  getCAPIConfig: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const clientData = await getClientById(input.clientId);
      return {
        metaPixelId: clientData?.metaPixelId ?? "",
        metaCAPIToken: clientData?.metaCAPIToken ? "***configurado***" : "",
        configured: !!(clientData?.metaPixelId && clientData?.metaCAPIToken),
      };
    }),

  // Retorna histórico de eventos CAPI enviados para um cliente
  getCAPIHistory: protectedProcedure
    .input(z.object({ clientId: z.number(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [] };
      const { desc } = await import("drizzle-orm");
      const events = await db.select()
        .from(capiEvents)
        .where(eq(capiEvents.clientId, input.clientId))
        .orderBy(desc(capiEvents.createdAt))
        .limit(input.limit);
      return { events };
    }),
});
