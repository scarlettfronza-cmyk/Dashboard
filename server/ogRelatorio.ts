/**
 * Prévia do link do relatório no WhatsApp (e em qualquer app que mostre
 * cartão de link): título, descrição e imagem via meta tags Open Graph.
 *
 * A página é uma SPA: o robô do WhatsApp lê só o HTML que o servidor
 * devolve, sem rodar JavaScript. Por isso o servidor injeta as tags no
 * index.html antes de responder em /r/:token. A imagem é um cartão fixo
 * da agência (client/public/og-relatorio.png); o nome da clínica e o
 * período vão no título e na descrição.
 */
import type { Express, Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { clients } from "../drizzle/schema";
import { isValidPublicReportToken } from "./publicReportSecurity";
import { formatarPeriodo } from "@shared/whatsappRelatorio";

export const ASSINATURA_OG = "Digital Escarlate · Scarlett Fronza";

export type DadosOg = { title: string; description: string; image: string; url: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Título e descrição do cartão. Sem cliente (link inválido), cartão genérico. */
export function textosOg(clienteNome: string | null, de?: string | null, ate?: string | null): { title: string; description: string } {
  const periodo = de && ate ? `Período de ${formatarPeriodo(de, ate)} · ` : "";
  if (!clienteNome) return { title: "Relatório de performance", description: `${periodo}${ASSINATURA_OG}` };
  return { title: `Relatório de performance · ${clienteNome.trim()}`, description: `${periodo}Tráfego, perfil e resultados comerciais · ${ASSINATURA_OG}` };
}

/** Troca o <title> e insere as meta tags antes de </head>. Puro, para teste. */
export function injetarOg(html: string, d: DadosOg): string {
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(d.title)}" />`,
    `<meta property="og:description" content="${esc(d.description)}" />`,
    `<meta property="og:image" content="${esc(d.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:url" content="${esc(d.url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="description" content="${esc(d.description)}" />`,
  ].join("\n    ");
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(d.title)}</title>`)
    .replace("</head>", `    ${tags}\n  </head>`);
}

/**
 * Registra GET /r/:token antes dos arquivos estáticos. Em desenvolvimento
 * deixa o Vite servir (next()); em produção lê o index.html do build.
 */
export function registerOgRoute(app: Express, distPath: string) {
  app.get("/r/:token", async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "development" || !req.accepts("html")) return next();
    const indexPath = path.resolve(distPath, "index.html");
    let html: string;
    try { html = await fs.promises.readFile(indexPath, "utf8"); } catch { return next(); }

    const token = String(req.params.token ?? "");
    let nome: string | null = null;
    try {
      const db = isValidPublicReportToken(token) ? await getDb() : null;
      if (db) {
        const [c] = await db.select({ name: clients.name }).from(clients)
          .where(and(eq(clients.publicToken, token), eq(clients.active, 1))).limit(1);
        nome = c?.name ?? null;
      }
    } catch (e) {
      console.error("[OG] Falha ao buscar cliente:", e instanceof Error ? e.message : e);
    }

    const origem = `${req.protocol}://${req.get("host")}`;
    const de = typeof req.query.de === "string" ? req.query.de : null;
    const ate = typeof req.query.ate === "string" ? req.query.ate : null;
    const { title, description } = textosOg(nome, de, ate);
    res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "no-store" })
      .end(injetarOg(html, { title, description, image: `${origem}/og-relatorio.png`, url: `${origem}${req.originalUrl}` }));
  });
}
