import { Express } from "express";
import { getDb, getClientById } from "./db";
import { salesRecords, managerClients, capiEvents } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { normalizePhone, sendCAPIConversionEvent } from "./metaApi";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import { jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parse "Última atualização" field like "Luana Priscila Apr 2, 2026 2:27 PM"
function parseLastUpdated(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let cleaned = raw;
  for (const m of months) {
    const idx = raw.indexOf(m);
    if (idx !== -1) {
      cleaned = raw.slice(idx);
      break;
    }
  }
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

// Parse date from Excel serial number, Date object, or string
function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === "string") {
    const s = val.trim();
    // Skip date ranges like "2026-04-02 to 2026-05-01"
    if (s.includes(" to ") || s.includes(" a ")) return null;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Parse currency value like "R$14.900,00", "14900", 14900
function parseCurrency(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const s = val.trim();
    if (s === "" || s === "-") return null;
    // Remove currency symbol, spaces, and handle Brazilian number format
    const cleaned = s.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Find a column value in a row by any of the given column name variants.
 * Comparison is case-insensitive and trims whitespace.
 */
function getCol(row: Record<string, unknown>, ...names: string[]): unknown {
  const keys = Object.keys(row);
  for (const name of names) {
    const nameLower = name.trim().toLowerCase();
    const found = keys.find(k => k.trim().toLowerCase() === nameLower);
    if (found !== undefined) return row[found];
  }
  return null;
}

/**
 * Detect if a row is a summary/total row (should be skipped).
 * Monday.com adds a total row at the end with no Name but with aggregated values.
 */
function isSummaryRow(row: Record<string, unknown>): boolean {
  const name = String(getCol(row, "Name") ?? "").trim();
  if (!name) return true;
  // Date range in name column
  if (name.includes(" to ") || name.includes(" a ")) return true;
  return false;
}

/**
 * Detect if a boolean-like field means "yes/true".
 * Handles: "Sim", "sim", "Yes", "yes", "true", "1", true, 1
 */
function isTruthy(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  const s = String(val).trim().toLowerCase();
  return s === "sim" || s === "yes" || s === "true" || s === "1";
}

// ─── Route ────────────────────────────────────────────────────────────────────

export function registerSalesUploadRoute(app: Express) {
  /**
   * POST /api/upload-sales/:clientId
   * Body: { fileBase64: string, fileName?: string }
   * Auth: admin session cookie OR manager JWT Bearer token
   *
   * Parses Monday.com XLSX exports with any column name variation.
   * Supports two formats:
   *   Format A (Dra. Tatiana): "Valor da Consulta", "Valor da cirurgia", "Fechou"
   *   Format B (Dra. Heloisa): "Valor consulta", "Valor do procedimento", "Total de Vendas", "Compareceu", "Fechou"
   *
   * Replaces all existing sales records for the client.
   */
  app.post("/api/upload-sales/:clientId", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "clientId inválido" });
      }

      // ── Auth ──────────────────────────────────────────────────────────────
      const authHeader = req.headers.authorization;
      const rawCookies = parseCookieHeader(req.headers.cookie || "");
      const sessionCookie = rawCookies[COOKIE_NAME];
      let authorized = false;

      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.slice(7);
          const jwtSec = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");
          const result = await jwtVerify(token, jwtSec);
          const payload = result.payload as { managerId: number };
          const dbConn = await getDb();
          if (dbConn) {
            const access = await dbConn.select().from(managerClients)
              .where(and(eq(managerClients.managerId, payload.managerId), eq(managerClients.clientId, clientId)))
              .limit(1);
            authorized = access.length > 0;
          }
        } catch {
          // invalid token — fall through
        }
      }

      if (!authorized && sessionCookie) {
        authorized = true;
      }

      if (!authorized) {
        return res.status(403).json({ error: "Sem permissão" });
      }

      // ── Parse XLSX ────────────────────────────────────────────────────────
      const { fileBase64, fileName } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ error: "Arquivo não enviado" });
      }

      const buffer = Buffer.from(fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Read as raw 2D array to find the real header row
      // Monday.com exports have 1-3 title rows before column headers
      // Use raw:true to preserve numeric values as numbers (not strings)
      // This prevents parseCurrency from misinterpreting "4032.44" as 403244
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        raw: true,
      }) as unknown[][];

      // Find the row where first cell is exactly "Name"
      let headerRowIdx = -1;
      for (let i = 0; i < rawRows.length; i++) {
        const firstCell = String(rawRows[i][0] ?? "").trim();
        if (firstCell === "Name") {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        return res.status(400).json({
          error: "Formato não reconhecido. Exporte o board do Monday.com como XLSX (a coluna 'Name' não foi encontrada).",
        });
      }

      // Build data rows as key-value objects using the header row
      const headers = rawRows[headerRowIdx] as string[];
      const dataRows: Record<string, unknown>[] = rawRows
        .slice(headerRowIdx + 1)
        .map(row => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            if (h) obj[String(h).trim()] = (row as unknown[])[i];
          });
          return obj;
        });

      // ── Detect format ─────────────────────────────────────────────────────
      // Format C (Majestic): has "Valor fechado" column (no Valor Consulta/Procedimento)
      const hasFormatC = headers.some(h => {
        const hl = String(h ?? "").trim().toLowerCase();
        return hl === "valor fechado";
      });

      // Format B has "Valor do procedimento" or "Total de Vendas" columns
      const hasFormatB = !hasFormatC && headers.some(h => {
        const hl = String(h ?? "").trim().toLowerCase();
        return hl === "valor do procedimento" || hl === "total de vendas" || hl === "compareceu";
      });

      const detectedFormat = hasFormatC ? "C (Majestic/valor fechado)" : hasFormatB ? "B (Heloisa/procedimento)" : "A (Tatiana/cirurgia)";
      console.log(`[Sales Upload] Detected format: ${detectedFormat} for client ${clientId}`);

      // ── Map columns to records ────────────────────────────────────────────
      const batch = randomUUID();
      const records: typeof salesRecords.$inferInsert[] = [];

      for (const row of dataRows) {
        // Skip empty or summary rows
        if (isSummaryRow(row)) continue;

        const name = String(getCol(row, "Name") ?? "").trim();
        if (!name) continue;

        // Date: same in both formats
        const consultDateRaw = getCol(row,
          "Data da consulta", "Data da Consulta", "Data Consulta", "Data");
        const consultDate = parseDate(consultDateRaw);

        // Conversion date: when the lead converted (may differ from consult date)
        const conversionDateRaw = getCol(row,
          "Data Conversão", "Data de Conversão", "Data conversao", "Data de conversao",
          "Conversão", "Conversao", "Data Conversão");
        const conversionDate = parseDate(conversionDateRaw);

        // Acquisition channel
        const acquisitionChannelRaw = getCol(row,
          "Canal de Aquisição", "Canal de Aquisicao", "Canal Aquisição", "Canal Aquisicao", "Canal");
        const acquisitionChannel = acquisitionChannelRaw ? String(acquisitionChannelRaw).trim() : undefined;

        let consultValue: number | null = null;
        let surgeryValue: number | null = null;
        let closed = false;

        if (hasFormatC) {
          // ── Format C (Majestic / Transplante Capilar) ─────────────────────
          // No "Valor Consulta" — only "Valor fechado" for closed deals
          consultValue = null;

          // "Valor fechado" → surgeryValue (the closed deal value)
          const valorFechadoRaw = getCol(row, "Valor fechado", "Valor Fechado");
          surgeryValue = parseCurrency(valorFechadoRaw);

          // Closed: Valor fechado > 0 OR Status do Lead = "Negócio Fechado"
          const statusRawC = String(getCol(row, "Status do Lead", "Status do lead", "Status") ?? "").toLowerCase().trim();
          const fechouByValueC = surgeryValue !== null && surgeryValue > 0;
          const fechouByStatusC = statusRawC === "negócio fechado" || statusRawC === "negocio fechado";
          closed = fechouByValueC || fechouByStatusC;

          // If closed by status but no value, mark as closed with 0 value
          if (fechouByStatusC && surgeryValue === null) surgeryValue = 0;

        } else if (hasFormatB) {
          // ── Format B (Dra. Heloisa Barbieri) ──────────────────────────────
          // "Valor consulta" → consultValue
          const consultValueRaw = getCol(row,
            "Valor consulta", "Valor da consulta", "Valor Consulta");
          consultValue = parseCurrency(consultValueRaw);

          // "Valor do procedimento" / "Valor Cirurgia" → surgeryValue
          const procedimentoRaw = getCol(row,
            "Valor do procedimento", "Valor Procedimento", "Valor do Procedimento",
            "Valor Cirurgia", "Valor da Cirurgia", "Valor da cirurgia", "Valor cirurgia");
          surgeryValue = parseCurrency(procedimentoRaw);

          // If both are null, try "Total de Vendas" as fallback for total
          // (split evenly or assign to surgeryValue as total)
          if (consultValue === null && surgeryValue === null) {
            const totalVendasRaw = getCol(row, "Total de Vendas", "Total Vendas");
            const totalVendas = parseCurrency(totalVendasRaw);
            if (totalVendas !== null && totalVendas > 0) {
              surgeryValue = totalVendas;
            }
          }

          // "Fechou" = "Sim" means closed deal
          // Also: if Valor Procedimento has a value > 0, count as closed even without Fechou=Sim
          // (some clients fill the value without marking Fechou, e.g. Dra. Nathalia)
          const fechouRaw = String(getCol(row, "Fechou") ?? "").trim().toLowerCase();
          const fechouExplicit = fechouRaw === "sim" || fechouRaw === "yes" || fechouRaw === "true";
          const fechouByValue = surgeryValue !== null && surgeryValue > 0;
          closed = fechouExplicit || fechouByValue;

          // "Compareceu" = "Sim" means patient attended (useful for consultas count)
          // We store this in the closed field only if fechou is also sim
          // (compareceu alone doesn't mean a sale was made)

        } else {
          // ── Format A (Dra. Tatiana / default) ─────────────────────────────
          // "Valor da Consulta" / "Valor Consulta" → consultValue
          const consultValueRaw = getCol(row,
            "Valor da Consulta", "Valor da consulta", "Valor Consulta", "Valor consulta");
          consultValue = parseCurrency(consultValueRaw);

          // "Valor da cirurgia" / "Valor Cirurgia" → surgeryValue
          const surgeryValueRaw = getCol(row,
            "Valor da cirurgia", "Valor da Cirurgia", "Valor Cirurgia", "Valor cirurgia");
          surgeryValue = parseCurrency(surgeryValueRaw);

          // "Fechou" = "Sim" OR "Status do lead" = "Negócio fechado"
          // OR: Valor da cirurgia > 0 (some clients fill value without marking Fechou)
          const fechouRaw = String(getCol(row, "Fechou") ?? "").toLowerCase().trim();
          const statusRaw = String(getCol(row, "Status do lead", "Status") ?? "").toLowerCase().trim();
          const fechouExplicitA = fechouRaw === "sim" || fechouRaw === "yes" || fechouRaw === "true" ||
            statusRaw === "negócio fechado" || statusRaw === "negocio fechado";
          const fechouByValueA = surgeryValue !== null && surgeryValue > 0;
          closed = fechouExplicitA || fechouByValueA;
        }

        // Last updated (same in both formats)
        const lastUpdatedRaw = String(
          getCol(row, "Última atualização", "Ultima atualizacao", "Última Atualização", "Last updated") ?? ""
        ) || null;
        const lastUpdated = parseLastUpdated(lastUpdatedRaw);

        records.push({
          clientId,
          patientName: name,
          consultDate: consultDate ?? undefined,
          conversionDate: conversionDate ?? undefined,
          acquisitionChannel: acquisitionChannel || undefined,
          consultValue: consultValue !== null ? consultValue.toString() : undefined,
          surgeryValue: surgeryValue !== null ? surgeryValue.toString() : undefined,
          closed,
          lastUpdated: lastUpdated ?? undefined,
          uploadBatch: batch,
        });
      }

      if (records.length === 0) {
        return res.status(400).json({
          error: "Nenhum registro de paciente encontrado. Verifique se o arquivo é um export do Monday.com.",
        });
      }

      // ── Save to DB ────────────────────────────────────────────────────────
      const dbConn2 = await getDb();
      if (!dbConn2) return res.status(500).json({ error: "DB unavailable" });

      // Replace all existing records for this client
      await dbConn2.delete(salesRecords).where(eq(salesRecords.clientId, clientId));
      await dbConn2.insert(salesRecords).values(records);

      // ── Dispara eventos CAPI InitiateCheckout para registros com telefone ──
      // Faz isso em background sem bloquear a resposta
      const clientData = await getClientById(clientId);
      if (clientData?.metaPixelId && clientData?.metaCAPIToken) {
        const eventTime = Math.floor(Date.now() / 1000);
        let capiSent = 0;
        for (const rec of records) {
          // Só envia se tiver telefone (via patientName não temos phone direto)
          // O evento InitiateCheckout representa o início da negociação/consulta
          if (!rec.patientName) continue;
          // Usa o nome do paciente como identificador — sem telefone disponível no upload
          // Registra o evento para auditoria mesmo sem phone hash
          try {
            const value = rec.closedValue
              ? parseFloat(rec.closedValue)
              : rec.surgeryValue
              ? parseFloat(rec.surgeryValue)
              : rec.consultValue
              ? parseFloat(rec.consultValue)
              : 0;
            await dbConn2.insert(capiEvents).values({
              clientId,
              phone: "unknown", // sem telefone no upload de planilha
              eventName: "InitiateCheckout",
              eventTime,
              value: value > 0 ? String(value) : null,
              currency: "BRL",
              sourceType: "sales_upload",
              sourceId: rec.uploadBatch,
              success: false, // marcado como não enviado (sem phone para hash)
              errorMessage: "Telefone não disponível no upload de planilha",
            });
          } catch (_) {}
        }
        console.log(`[Sales Upload CAPI] Registered ${records.length} InitiateCheckout events (no phone) for client ${clientId}`);
      }

      const closedCount = records.filter(r => r.closed).length;
      const totalConsultas = records.reduce((s, r) => s + (r.consultValue ? parseFloat(r.consultValue) : 0), 0);
      const totalCirurgias = records.reduce((s, r) => s + (r.surgeryValue ? parseFloat(r.surgeryValue) : 0), 0);

      console.log(`[Sales Upload] Imported ${records.length} records for client ${clientId} (batch ${batch})`);
      console.log(`[Sales Upload] Format: ${hasFormatB ? "B" : "A"} | Closed: ${closedCount} | Total Consultas: ${totalConsultas} | Total Cirurgias/Procedimentos: ${totalCirurgias}`);

      res.json({
        success: true,
        imported: records.length,
        closed: closedCount,
        totalConsultas,
        totalCirurgias,
        format: hasFormatC ? "C" : hasFormatB ? "B" : "A",
        batch,
        fileName: fileName ?? "planilha.xlsx",
      });
    } catch (err) {
      console.error("[Sales Upload] Error:", err);
      res.status(500).json({ error: "Erro ao processar planilha: " + (err as Error).message });
    }
  });
}
