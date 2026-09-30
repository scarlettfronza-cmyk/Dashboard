/**
 * Prévia do link do portal no WhatsApp: título, descrição e imagem via meta
 * tags Open Graph.
 *
 * O portal é uma SPA e o robô do WhatsApp lê só o HTML devolvido pelo
 * servidor, sem rodar JavaScript. Por isso o servidor injeta as tags no
 * index.html antes de responder em /portal/:token. Nada além do nome da
 * clínica sai aqui: nenhum número, paciente ou identificador interno.
 */
import type { Express, NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { clients } from "../drizzle/schema";

export type DadosOg = { title: string; description: string; image: string; url: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function textosOg(clienteNome: string | null): { title: string; description: string } {
  if (!clienteNome) return { title: "Relatório comercial", description: "Agendamentos, comparecimentos e vendas do período." };
  return {
    title: `Relatório comercial · ${clienteNome.trim()}`,
    description: "Agendamentos, comparecimentos e vendas do período.",
  };
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

/** Registra GET /portal/:token antes dos arquivos estáticos (só em produção). */
export function registerOgRoute(app: Express, distPath: string) {
  app.get("/portal/:token", async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "development" || !req.accepts("html")) return next();
    let html: string;
    try {
      html = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf8");
    } catch {
      return next();
    }

    const token = String(req.params.token ?? "");
    let nome: string | null = null;
    try {
      const db = token.length >= 16 && token.length <= 64 ? await getDb() : null;
      if (db) {
        const [c] = await db
          .select({ name: clients.name, isActive: clients.isActive })
          .from(clients)
          .where(eq(clients.clientToken, token))
          .limit(1);
        nome = c?.isActive ? c.name : null;
      }
    } catch (e) {
      console.error("[OG] Falha ao buscar cliente:", e instanceof Error ? e.message : e);
    }

    const origem = `${req.protocol}://${req.get("host")}`;
    res
      .status(200)
      .set({ "Content-Type": "text/html", "Cache-Control": "no-store" })
      .end(injetarOg(html, { ...textosOg(nome), image: `${origem}/og-relatorio.png`, url: `${origem}${req.originalUrl}` }));
  });
}
