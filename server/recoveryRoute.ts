/**
 * Redefinição da senha de um gestor.
 *
 * O acesso administrativo do sistema dependia do login da plataforma Manus,
 * que deixou de existir. Sem ele não havia caminho para recuperar a senha de
 * um gestor, e uma conta nova não serve: as atribuições de clientes apontam
 * para o cadastro antigo, então a conta nova nasceria sem clínica alguma.
 *
 * Vale o mesmo cuidado da importação: desligada por padrão, só existe
 * enquanto RECOVERY_TOKEN estiver no ambiente, e deve ser removida depois.
 * A porta é separada da importação de propósito — uma senha não abre a outra.
 */
import type { Express, Request, Response } from "express";
import express from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { managers } from "../drizzle/schema";
import { autorizar, novaSenhaValida, operacaoHabilitada } from "./restoreGuards";

/** Mesmo custo usado no cadastro, para não enfraquecer o hash na recuperação. */
const CUSTO_BCRYPT = 12;

export function registerRecoveryRoute(app: Express) {
  app.get("/api/recuperar/status", (_req: Request, res: Response) => {
    res.json({ habilitada: operacaoHabilitada(process.env, "RECOVERY_TOKEN") });
  });

  /** Lista os gestores, para quem recupera não precisar adivinhar o e-mail. */
  app.post("/api/recuperar/gestores", express.json(), async (req: Request, res: Response) => {
    const permissao = autorizar(process.env, req.body?.senha, "RECOVERY_TOKEN");
    if (!permissao.ok) {
      return res.status(permissao.motivo === "desativado" ? 404 : 401).json({ erro: permissao.detalhe });
    }
    const db = await getDb();
    if (!db) return res.status(500).json({ erro: "O banco não está ligado a este serviço." });

    const lista = await db.select({
      id: managers.id, nome: managers.name, email: managers.email, ativo: managers.active,
    }).from(managers);
    res.json({ gestores: lista });
  });

  app.post("/api/recuperar/senha", express.json(), async (req: Request, res: Response) => {
    const permissao = autorizar(process.env, req.body?.senha, "RECOVERY_TOKEN");
    if (!permissao.ok) {
      return res.status(permissao.motivo === "desativado" ? 404 : 401).json({ erro: permissao.detalhe });
    }

    const nova = novaSenhaValida(req.body?.novaSenha);
    if (!nova.ok) return res.status(400).json({ erro: nova.detalhe });

    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!email) return res.status(400).json({ erro: "Informe o e-mail do gestor." });

    const db = await getDb();
    if (!db) return res.status(500).json({ erro: "O banco não está ligado a este serviço." });

    const achados = await db.select().from(managers).where(eq(managers.email, email)).limit(1);
    if (!achados[0]) {
      return res.status(404).json({ erro: `Nenhum gestor cadastrado com o e-mail ${email}.` });
    }

    const passwordHash = await bcrypt.hash(req.body.novaSenha as string, CUSTO_BCRYPT);
    await db.update(managers)
      .set({ passwordHash, active: 1 })
      .where(eq(managers.id, achados[0].id));

    console.log(`[Recuperação] Senha redefinida para o gestor ${achados[0].id}.`);
    res.json({ ok: true, nome: achados[0].name, email: achados[0].email });
  });
}
