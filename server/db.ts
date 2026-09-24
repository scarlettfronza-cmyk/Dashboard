import { eq, and, gte, lte, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import { InsertUser, users, clients, integrations, snapshots, salesRecords, managerClients, InsertClient, InsertIntegration, InsertSnapshot } from "../drizzle/schema";
import { ENV } from './_core/env';
import { decryptSecret, encryptSecret } from "./secretCipher";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
let _db: DrizzleDb | null = null;

export async function getDb(): Promise<DrizzleDb | null> {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL, { schema, mode: "default" });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function getClientsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).where(and(eq(clients.userId, userId), eq(clients.active, 1)));
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  await db.insert(clients).values({ ...data, slug });
  const result = await db.select().from(clients).where(and(eq(clients.userId, data.userId), eq(clients.slug, slug))).limit(1);
  return result[0];
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0] ? { ...result[0], metaCAPIToken: decryptSecret(result[0].metaCAPIToken) } : null;
}

export async function deleteClient(clientId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Verify ownership
  const client = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.userId, userId))).limit(1);
  if (!client[0]) throw new Error("Cliente não encontrado ou sem permissão");
  // Delete all related data in order
  await db.delete(salesRecords).where(eq(salesRecords.clientId, clientId));
  await db.delete(snapshots).where(eq(snapshots.clientId, clientId));
  await db.delete(managerClients).where(eq(managerClients.clientId, clientId));
  await db.delete(integrations).where(eq(integrations.clientId, clientId));
  await db.delete(clients).where(eq(clients.id, clientId));
  return { success: true };
}

// ─── Integrations ─────────────────────────────────────────────────────────────
export async function getIntegrationsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(integrations).where(eq(integrations.clientId, clientId));
  return rows.map((row) => ({ ...row, accessToken: decryptSecret(row.accessToken) }));
}

export async function getIntegration(clientId: number, provider: "meta_ads" | "monday" | "google_sheets" | "sales_sheet" | "followers_sheet" | "instagram_oauth" | "meta_token") {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(integrations).where(and(eq(integrations.clientId, clientId), eq(integrations.provider, provider))).limit(1);
  return result[0] ? { ...result[0], accessToken: decryptSecret(result[0].accessToken) } : null;
}

export async function upsertIntegration(data: InsertIntegration) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getIntegration(data.clientId, data.provider);
  if (existing) {
    await db.update(integrations).set({
      accessToken: encryptSecret(data.accessToken),
      adAccountId: data.adAccountId,
      boardId: data.boardId,
      extraConfig: data.extraConfig,
      metaUserId: data.metaUserId,
      metaIgUserId: data.metaIgUserId,
      metaIgUsername: data.metaIgUsername,
    }).where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({ ...data, accessToken: encryptSecret(data.accessToken) });
  }
}

// ─── Snapshots ────────────────────────────────────────────────────────────────
export async function upsertSnapshot(data: InsertSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(snapshots).where(and(eq(snapshots.clientId, data.clientId), eq(snapshots.snapshotDate, data.snapshotDate))).limit(1);
  if (existing.length > 0) {
    await db.update(snapshots).set({
      investimento: data.investimento,
      leads: data.leads,
      vendas: data.vendas,
      totalEmVendas: data.totalEmVendas,
      novosSeguidores: data.novosSeguidores,
      rawMetaData: data.rawMetaData,
      rawMondayData: data.rawMondayData,
      s3Key: data.s3Key,
    }).where(eq(snapshots.id, existing[0].id));
  } else {
    await db.insert(snapshots).values(data);
  }
}

export async function getSnapshotsByClientId(clientId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(snapshots).where(eq(snapshots.clientId, clientId)).orderBy(desc(snapshots.snapshotDate)).limit(limit);
}

export async function getSnapshotsInRange(clientId: number, from: string, to: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(snapshots).where(
    and(eq(snapshots.clientId, clientId), gte(snapshots.snapshotDate, from), lte(snapshots.snapshotDate, to))
  ).orderBy(desc(snapshots.snapshotDate));
}

// ─── Sales Records (base comercial sincronizada do Monday.com) ───────────────────────────────────────────────────
const MONTH_NAMES_PT: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, agosto: 7, set: 8, out: 9, nov: 10, dez: 11,
  janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

export function groupNameToPeriodDate(groupName: string | null | undefined): Date | null {
  if (!groupName) return null;
  const monthYearInParens = groupName.match(/(\w+)\/(\d{4})/i);
  if (monthYearInParens) {
    const month = MONTH_NAMES_PT[monthYearInParens[1].toLowerCase()];
    const year = parseInt(monthYearInParens[2], 10);
    if (month !== undefined && !isNaN(year)) return new Date(Date.UTC(year, month, 15));
  }
  const monthYearInText = groupName.match(/(?:m[eê]s\s+)?(\w+)\s+(\d{4})/i);
  if (monthYearInText) {
    const month = MONTH_NAMES_PT[monthYearInText[1].toLowerCase()];
    const year = parseInt(monthYearInText[2], 10);
    if (month !== undefined && !isNaN(year)) return new Date(Date.UTC(year, month, 15));
  }
  return null;
}

/**
 * Escolhe a melhor data disponível para situar um fechamento no período.
 * A data explícita do fechamento tem prioridade. Quando o Monday não traz
 * essa data, a data da consulta é a melhor referência comercial disponível
 * para não excluir procedimentos válidos de um período parcial. Sem nenhuma
 * data individual, o grupo mensal pode declarar o mês. A última atualização
 * do registro nunca é data comercial: ela muda a cada sincronização e levaria
 * fechamentos antigos para o mês atual.
 */
export function getClosingReferenceDate(record: {
  conversionDate?: Date | null;
  consultDate?: Date | null;
  groupName?: string | null;
  lastUpdated?: Date | null;
}): Date | null {
  if (record.conversionDate) return new Date(record.conversionDate);
  if (record.consultDate) return new Date(record.consultDate);
  const groupDate = groupNameToPeriodDate(record.groupName);
  if (groupDate) return groupDate;
  return null;
}

export async function getSalesForPeriod(clientId: number, _from?: string, _to?: string, salesChannelFilter?: string | null) {
  const db = await getDb();
  if (!db) return { consultas: 0, fechamentos: 0, totalEmVendas: 0, totalCirurgias: 0, totalConsultas: 0, hasData: false };

  // Fetch ALL records for this client
  const allRows = await db.select().from(salesRecords)
    .where(eq(salesRecords.clientId, clientId));

  if (allRows.length === 0) {
    return { consultas: 0, fechamentos: 0, totalEmVendas: 0, totalCirurgias: 0, totalConsultas: 0, hasData: false };
  }

  // Filtros separados para consultas e fechamentos:
  // - Consultas: filtrar por consultDate quando disponível.
  //   Se consultDate for nulo, usar groupName (ex: "Avaliação (ABRIL/2026)") para inferir o mês.
  //   Avaliação = Consulta (Neo Hair e similares).
  // - Fechamentos: registros com closed=true e conversionDate no período.
  //   Se conversionDate for nulo, usar groupName como fallback.
  let consultaRows = allRows;
  let fechamentoRows = allRows.filter(r => r.closed);

  if (_from || _to) {
    const fromDate = _from ? new Date(_from + "T00:00:00Z") : null;
    const toDate = _to ? new Date(_to + "T23:59:59Z") : null;

    const inRange = (d: Date | null | undefined) => {
      if (!d) return false;
      const dt = new Date(d);
      if (fromDate && dt < fromDate) return false;
      if (toDate && dt > toDate) return false;
      return true;
    };

    // Consultas: consultDate > groupName (como data do meio do mês) > sem data (excluir)
    consultaRows = allRows.filter((r) => {
      if (r.consultDate) return inRange(r.consultDate);
      const gd = groupNameToPeriodDate((r as any).groupName);
      if (gd) return inRange(gd);
      return false; // sem data nem grupo: excluir
    });

    // Fechamentos: prioriza a data explícita de fechamento. Sem ela, usa a data da
    // consulta e só então o mês do grupo. Isso evita excluir procedimentos válidos
    // em períodos parciais quando o Monday não informa a data de conversão.
    fechamentoRows = allRows.filter((r) => {
      if (!r.closed) return false;
      return inRange(getClosingReferenceDate(r));
    });
  }

  // Filter by acquisition channel if configured for this client
  if (salesChannelFilter) {
    const channelLower = salesChannelFilter.toLowerCase().trim();
    const byChannel = (r: typeof allRows[0]) => (r.acquisitionChannel ?? "").toLowerCase().trim() === channelLower;
    consultaRows = consultaRows.filter(byChannel);
    fechamentoRows = fechamentoRows.filter(byChannel);
  }

  // Total em consultas = soma do Valor da Consulta de todos os agendamentos do período
  const totalEmVendas = consultaRows.reduce((sum, r) => {
    const v = parseFloat(String((r as any).consultValue ?? "0"));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  // Total cirurgias = soma dos fechamentos filtrados por conversionDate
  // Usa closedValue quando disponível (ex: Majestic), fallback surgeryValue
  const totalCirurgias = fechamentoRows.reduce((sum, r) => {
    const cv = (r as any).closedValue != null ? parseFloat(String((r as any).closedValue)) : null;
    const sv = parseFloat(String(r.surgeryValue ?? "0"));
    const v = (cv !== null && !isNaN(cv) && cv > 0) ? cv : sv;
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const totalConsultas = totalEmVendas;

  return {
    consultas: consultaRows.length,
    fechamentos: fechamentoRows.length,
    totalEmVendas,
    totalCirurgias,
    totalConsultas,
    hasData: consultaRows.length > 0 || fechamentoRows.length > 0
  };
}

export async function getSalesUploadInfo(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const allRows = await db.select().from(salesRecords)
    .where(eq(salesRecords.clientId, clientId));
  if (allRows.length === 0) return null;
  const latest = allRows.reduce((a, b) => a.uploadedAt > b.uploadedAt ? a : b);
  return { totalRecords: allRows.length, uploadedAt: latest.uploadedAt };
}
