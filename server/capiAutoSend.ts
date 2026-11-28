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

/** Data do Monday ("2026-10-05" ou "05/10/2026") em milissegundos, ou null. */
export function dataMondayMs(raw: string | null | undefined): number | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  const d = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    : br ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
}

/** Eventos só para o que aconteceu há pouco: histórico antigo não ensina nada ao pixel. */
export const JANELA_EVENTOS_DIAS = 30;

export type LeadParaCapi = {
  mondayId: string; phone: string; status: string; consultDate: string; conversionDate: string;
  value: string; surgeryValue: string; closedValue: string; updatedAt?: string;
};

const numero = (v: string | undefined) => {
  const n = parseFloat(String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Decide, para um lead do Monday, quais eventos cabem: Schedule quando o
 * status diz agendado ou há data de consulta; Purchase quando o status diz
 * fechado ou há data de fechamento com valor. Vale para qualquer lead com
 * telefone, venha de formulário ou de WhatsApp — o Meta cruza o telefone
 * com quem clicou e atribui sozinho.
 */
export function eventosDoLead(lead: LeadParaCapi, agora = Date.now()): Array<{ eventName: "Schedule" | "Purchase"; value?: number }> {
  const status = (lead.status ?? "").toLowerCase();
  const limite = agora - JANELA_EVENTOS_DIAS * 86_400_000;
  const recente = (ms: number | null) => ms != null && ms >= limite && ms <= agora + 86_400_000;
  const atualizado = lead.updatedAt ? Date.parse(lead.updatedAt) : NaN;
  const atualizadoRecente = !Number.isNaN(atualizado) && atualizado >= limite;
  const saida: Array<{ eventName: "Schedule" | "Purchase"; value?: number }> = [];

  const consultaMs = dataMondayMs(lead.consultDate);
  const agendou = SCHEDULE_STATUSES.some((s) => status.includes(s)) || consultaMs != null;
  if (agendou && (recente(consultaMs) || (consultaMs == null && atualizadoRecente))) saida.push({ eventName: "Schedule" });

  const fechamentoMs = dataMondayMs(lead.conversionDate);
  const valor = numero(lead.closedValue) ?? numero(lead.surgeryValue) ?? numero(lead.value);
  const fechou = CLOSED_STATUSES.some((s) => status.includes(s)) || (fechamentoMs != null && (numero(lead.closedValue) ?? numero(lead.surgeryValue)) != null);
  if (fechou && (recente(fechamentoMs) || (fechamentoMs == null && atualizadoRecente))) saida.push({ eventName: "Purchase", value: valor });

  return saida;
}

export async function sendCAPIEventsForClient(clientId: number): Promise<{ sent: number; scheduleSent: number; avaliados: number }> {
  const db = await getDb();
  if (!db) return { sent: 0, scheduleSent: 0, avaliados: 0 };

  const clientData = await getClientById(clientId);
  if (!clientData?.metaPixelId || !clientData?.metaCAPIToken || !clientData?.mondayBoardId) {
    return { sent: 0, scheduleSent: 0, avaliados: 0 };
  }

  const globalToken = await getSystemSetting("monday_api_token");
  const clientInteg = await getIntegration(clientId, "monday");
  const mondayToken = globalToken ?? clientInteg?.accessToken;
  if (!mondayToken) return { sent: 0, scheduleSent: 0, avaliados: 0 };

  const { columns, items } = await fetchMondayLeads(clientData.mondayBoardId, mondayToken);
  const leads = items.map((item) => mapLead(item, columns));

  // O que já foi aceito pelo Meta, por item do Monday e evento: nunca repete.
  const enviados = await db.select({ sourceId: capiEvents.sourceId, eventName: capiEvents.eventName })
    .from(capiEvents).where(and(eq(capiEvents.clientId, clientId), eq(capiEvents.success, true)));
  const jaFoi = new Set(enviados.map((e) => `${e.sourceId}:${e.eventName}`));

  // Leads de formulário conhecidos, para marcar o vínculo como enviado.
  const matches = await db.select().from(leadAdMatches).where(eq(leadAdMatches.clientId, clientId));

  let sent = 0, scheduleSent = 0, avaliados = 0;
  for (const lead of leads) {
    const phone = normalizePhone(lead.phone);
    if (phone.length < 10) continue;
    avaliados++;
    for (const ev of eventosDoLead(lead)) {
      if (jaFoi.has(`${lead.mondayId}:${ev.eventName}`)) continue;
      const ok = await sendAndLog({
        clientId, pixelId: clientData.metaPixelId!, capiToken: clientData.metaCAPIToken!,
        phone, eventName: ev.eventName, value: ev.value, sourceType: "monday_auto", sourceId: lead.mondayId,
      });
      if (!ok) continue;
      jaFoi.add(`${lead.mondayId}:${ev.eventName}`);
      if (ev.eventName === "Purchase") {
        sent++;
        const m = matches.find((x) => x.phone === phone || (phone.length >= 9 && x.phone.endsWith(phone.slice(-9))));
        if (m && !m.capiSent) await db.update(leadAdMatches).set({ capiSent: true, capiSentAt: new Date() }).where(eq(leadAdMatches.id, m.id));
      } else {
        scheduleSent++;
      }
    }
  }

  return { sent, scheduleSent, avaliados };
}
