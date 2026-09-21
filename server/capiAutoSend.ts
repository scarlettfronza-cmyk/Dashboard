/**
 * CAPI Auto-Send Helper
 * Sends Schedule and Purchase CAPI events for a client based on Monday CRM status.
 * Called automatically after each Monday sync (mondayCron.ts).
 */
import { getDb, getClientById, getIntegration } from "./db";
import { leadAdMatches, capiEvents } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { normalizePhone, sendCAPIConversionEvent } from "./metaApi";
import { fetchMondayLeads, mapLead } from "./routers/crm";
import { getSystemSetting } from "./_core/systemRouter";

// Status que indicam consulta agendada
const SCHEDULE_STATUSES = ["consulta agendada", "agendado", "agendada", "consulta marcada", "marcado", "marcada"];
// Status que indicam fechamento/venda
const CLOSED_STATUSES = ["fechado", "fechou", "convertido", "cirurgia", "procedimento agendado", "venda"];

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
    console.error("[CAPI Log] Failed to log event:", err);
  }
}

async function sendAndLog(params: {
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

export async function sendCAPIEventsForClient(clientId: number): Promise<{ sent: number; scheduleSent: number }> {
  const db = await getDb();
  if (!db) return { sent: 0, scheduleSent: 0 };

  const clientData = await getClientById(clientId);
  if (!clientData?.metaPixelId || !clientData?.metaCAPIToken || !clientData?.mondayBoardId) {
    return { sent: 0, scheduleSent: 0 };
  }

  // Get Monday token
  const globalToken = await getSystemSetting("monday_api_token");
  const clientInteg = await getIntegration(clientId, "monday");
  const mondayToken = globalToken ?? clientInteg?.accessToken;
  if (!mondayToken) return { sent: 0, scheduleSent: 0 };

  // Fetch leads from Monday
  const { columns, items } = await fetchMondayLeads(clientData.mondayBoardId, mondayToken);
  const mondayLeads = items.map(item => mapLead(item, columns));

  // Get pending lead matches (not yet sent as Purchase)
  const pending = await db.select()
    .from(leadAdMatches)
    .where(and(
      eq(leadAdMatches.clientId, clientId),
      eq(leadAdMatches.capiSent, false)
    ));

  if (!pending.length) return { sent: 0, scheduleSent: 0 };

  let sent = 0;
  let scheduleSent = 0;

  for (const match of pending) {
    const normalizedMatchPhone = match.phone;

    // Find the lead in Monday by phone
    const mondayLead = mondayLeads.find(cl => {
      const clPhone = normalizePhone(cl.phone);
      return clPhone === normalizedMatchPhone ||
        (clPhone.length >= 9 && normalizedMatchPhone.endsWith(clPhone.slice(-9)));
    });

    if (!mondayLead) continue;

    const statusLower = mondayLead.status.toLowerCase();

    // Schedule event
    const isScheduled = SCHEDULE_STATUSES.some(s => statusLower.includes(s));
    if (isScheduled) {
      const ok = await sendAndLog({
        clientId,
        pixelId: clientData.metaPixelId!,
        capiToken: clientData.metaCAPIToken!,
        phone: match.phone,
        eventName: "Schedule",
        sourceType: "monday_auto",
        sourceId: mondayLead.mondayId,
      });
      if (ok) scheduleSent++;
    }

    // Purchase event
    const isClosed = CLOSED_STATUSES.some(s => statusLower.includes(s));
    if (isClosed) {
      const value = mondayLead.closedValue
        ? parseFloat(mondayLead.closedValue)
        : mondayLead.surgeryValue
        ? parseFloat(mondayLead.surgeryValue)
        : mondayLead.value
        ? parseFloat(mondayLead.value)
        : undefined;

      const ok = await sendAndLog({
        clientId,
        pixelId: clientData.metaPixelId!,
        capiToken: clientData.metaCAPIToken!,
        phone: match.phone,
        eventName: "Purchase",
        value,
        sourceType: "monday_auto",
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

  return { sent, scheduleSent };
}
