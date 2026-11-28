/**
 * Rastreio de leads de formulário (Meta Lead Ads) e envio de conversões
 * (CAPI), na versão que a gestora usa pelo painel.
 *
 * O router antigo (leadTracking.ts) só aceitava o login de administrador e
 * o token por cliente; aqui o token vem do resolvedor da agência, e as
 * funções servem tanto ao painel quanto ao cron.
 */
import { getDb, getClientById, getIntegration } from "./db";
import { leadAdMatches, capiEvents } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { fetchMetaLeadAdLeads, sendCAPIConversionEvent } from "./metaApi";
import { getSystemSetting } from "./_core/systemRouter";
import { resolverToken, CHAVE_TOKEN_AGENCIA } from "./metaTokenResolver";

export type ResultadoSyncLeadAds =
  | { ok: false; motivo: "sem_meta" | "sem_banco" | "sem_cliente" }
  | { ok: true; encontrados: number; novos: number; eventosLead: number };

/** Busca os leads de formulário no Meta e guarda o anúncio de origem de cada um. */
export async function sincronizarLeadAds(clientId: number, diasAtras = 90): Promise<ResultadoSyncLeadAds> {
  const db = await getDb();
  if (!db) return { ok: false, motivo: "sem_banco" };
  const cliente = await getClientById(clientId);
  if (!cliente) return { ok: false, motivo: "sem_cliente" };

  const [tokenAgencia, integ] = await Promise.all([getSystemSetting(CHAVE_TOKEN_AGENCIA), getIntegration(clientId, "meta_token")]);
  const { token, adAccountId } = resolverToken(tokenAgencia, integ);
  if (!token || !adAccountId) return { ok: false, motivo: "sem_meta" };

  // Só a conta principal: formulários de lead ficam nela.
  const conta = adAccountId.split(",")[0].trim();
  const leads = await fetchMetaLeadAdLeads(token, conta, diasAtras);

  let novos = 0, eventosLead = 0;
  for (const lead of leads) {
    const existe = await db.select({ id: leadAdMatches.id }).from(leadAdMatches).where(eq(leadAdMatches.metaLeadId, lead.leadId)).limit(1);
    if (existe.length) continue;
    try {
      await db.insert(leadAdMatches).values({
        clientId, phone: lead.phone, adId: lead.adId, adName: lead.adName, adSetName: lead.adSetName,
        campaignId: lead.campaignId, campaignName: lead.campaignName, formId: lead.formId, metaLeadId: lead.leadId,
        createdTimeOnMeta: lead.createdTime ? new Date(lead.createdTime) : null, capiSent: false,
      });
      novos++;
    } catch { continue; /* corrida com outra sincronização: já existe */ }

    if (cliente.metaPixelId && cliente.metaCAPIToken && lead.phone) {
      const eventTime = Math.floor(Date.now() / 1000);
      let success = false, errorMessage: string | null = null;
      try {
        success = await sendCAPIConversionEvent({ pixelId: cliente.metaPixelId, capiToken: cliente.metaCAPIToken, phone: lead.phone, eventName: "Lead", eventTime });
      } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); }
      await db.insert(capiEvents).values({
        clientId, phone: lead.phone, eventName: "Lead", eventTime, value: null, currency: "BRL",
        sourceType: "meta_lead_ads", sourceId: lead.leadId, success, errorMessage,
      }).catch(() => undefined);
      if (success) eventosLead++;
    }
  }
  return { ok: true, encontrados: leads.length, novos, eventosLead };
}

export type OrigemLead = { adName: string; campaignName: string; adSetName: string };

/** Telefone (e sufixo de 9 dígitos) → anúncio de origem, para a tabela do CRM. */
export async function mapaDeOrigem(clientId: number): Promise<Record<string, OrigemLead>> {
  const db = await getDb();
  if (!db) return {};
  const linhas = await db.select().from(leadAdMatches).where(eq(leadAdMatches.clientId, clientId));
  const mapa: Record<string, OrigemLead> = {};
  for (const m of linhas) {
    if (!m.phone) continue;
    const o = { adName: m.adName ?? "", campaignName: m.campaignName ?? "", adSetName: m.adSetName ?? "" };
    mapa[m.phone] = o;
    const sufixo = m.phone.slice(-9);
    if (!mapa[sufixo]) mapa[sufixo] = o;
  }
  return mapa;
}

/** Últimos eventos enviados ao Meta, com telefone mascarado. */
export async function historicoCapi(clientId: number, limite = 50) {
  const db = await getDb();
  if (!db) return [];
  const linhas = await db.select().from(capiEvents).where(eq(capiEvents.clientId, clientId)).orderBy(desc(capiEvents.createdAt)).limit(limite);
  return linhas.map((e) => ({
    id: e.id, evento: e.eventName, telefone: mascararTelefone(e.phone), valor: e.value ? Number(e.value) : null,
    origem: e.sourceType, ok: Boolean(e.success), erro: e.errorMessage ?? null, quando: e.createdAt,
  }));
}

export function mascararTelefone(t: string | null | undefined): string {
  const d = (t ?? "").replace(/\D/g, "");
  if (d.length < 6) return "—";
  return `${d.slice(0, 4)}•••${d.slice(-4)}`;
}
