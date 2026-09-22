/**
 * Download do PDF do relatório pela gestora: GET /api/relatorio/pdf.
 * Exige o JWT de gestora e o vínculo com o cliente, como o resto do painel.
 */
import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { clients } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyManagerOwnsClient } from "./managerAuth";
import { gerarPdfRelatorio, pdfDisponivel } from "./relatorioPdf";
import { nomeArquivoPdf } from "@shared/whatsappRelatorio";

/** Endereço interno da própria aplicação, para o Chromium do servidor. */
export function urlInterna(): string {
  return `http://127.0.0.1:${process.env.PORT || "3000"}`;
}

export function registerRelatorioPdfRoute(app: Express) {
  app.get("/api/relatorio/pdf", async (req: Request, res: Response) => {
    const clientId = Number(req.query.clientId);
    const from = String(req.query.from ?? ""); const to = String(req.query.to ?? "");
    const managerToken = String(req.query.managerToken ?? "");
    if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !managerToken) {
      return res.status(400).json({ erro: "Parâmetros inválidos." });
    }
    try {
      await verifyManagerOwnsClient(managerToken, clientId);
      if (!pdfDisponivel()) return res.status(503).json({ erro: "Geração de PDF indisponível neste servidor." });
      const db = await getDb();
      if (!db) return res.status(500).json({ erro: "Banco indisponível." });
      const [c] = await db.select({ name: clients.name, publicToken: clients.publicToken }).from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!c?.publicToken) return res.status(404).json({ erro: "Cliente sem link público." });
      const pdf = await gerarPdfRelatorio(`${urlInterna()}/r/${encodeURIComponent(c.publicToken)}?de=${from}&ate=${to}`);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivoPdf(c.name, from, to)}"`);
      res.send(pdf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = /inválido|expirado/i.test(msg) ? 401 : /negado/i.test(msg) ? 403 : 500;
      res.status(status).json({ erro: msg });
    }
  });
}
