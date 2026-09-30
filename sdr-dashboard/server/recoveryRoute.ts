/**
 * Redefinição de senha de emergência (/recuperar).
 *
 * As contas que entravam pelo login do Manus não têm senha própria: fora da
 * plataforma, a gestora não teria como entrar. Esta rota define uma senha
 * para qualquer conta existente, mantendo o mesmo cadastro (e portanto os
 * clientes e relatórios vinculados a ele).
 *
 * Só existe enquanto RECOVERY_TOKEN estiver no ambiente, e deve ser removida
 * depois do uso. É uma senha separada da importação: uma não abre a outra.
 * Depois de recuperar o acesso da gestora, as senhas das SDRs são trocadas
 * pelo painel dela, sem precisar desta rota.
 */
import type { Express, Request, Response } from "express";
import express from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { hashPassword, normalizeEmail, passwordProblem } from "./password";
import { autorizar, operacaoHabilitada } from "./restoreGuards";

function negar(res: Response, motivo: string, detalhe: string) {
  return res.status(motivo === "desativado" ? 404 : 401).json({ erro: detalhe });
}

export function registerRecoveryRoute(app: Express) {
  app.get("/api/recuperar/status", (_req: Request, res: Response) => {
    res.json({ habilitada: operacaoHabilitada(process.env, "RECOVERY_TOKEN") });
  });

  /** Lista as contas, para quem recupera não precisar adivinhar o cadastro. */
  app.post("/api/recuperar/contas", express.json(), async (req: Request, res: Response) => {
    const permissao = autorizar(process.env, req.body?.senha, "RECOVERY_TOKEN");
    if (!permissao.ok) return negar(res, permissao.motivo, permissao.detalhe);
    const db = await getDb();
    if (!db) return res.status(500).json({ erro: "O banco não está ligado a este serviço." });

    const lista = await db
      .select({ id: users.id, nome: users.name, email: users.email, papel: users.role, passwordHash: users.passwordHash })
      .from(users);
    res.json({
      contas: lista.map(({ passwordHash, ...c }) => ({ ...c, temSenha: Boolean(passwordHash) })),
    });
  });

  app.post("/api/recuperar/senha", express.json(), async (req: Request, res: Response) => {
    const permissao = autorizar(process.env, req.body?.senha, "RECOVERY_TOKEN");
    if (!permissao.ok) return negar(res, permissao.motivo, permissao.detalhe);

    const id = Number(req.body?.id);
    const novaSenha = typeof req.body?.novaSenha === "string" ? req.body.novaSenha : "";
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: "Escolha a conta." });
    const problema = passwordProblem(novaSenha);
    if (problema) return res.status(400).json({ erro: problema });

    const db = await getDb();
    if (!db) return res.status(500).json({ erro: "O banco não está ligado a este serviço." });

    const [conta] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!conta) return res.status(404).json({ erro: "Conta não encontrada." });

    // Contas do Manus podem não ter e-mail, e sem e-mail não há como entrar.
    const emailFinal = conta.email ?? email;
    if (!emailFinal || !emailFinal.includes("@")) {
      return res.status(400).json({ erro: "Esta conta não tem e-mail. Informe o e-mail que será usado para entrar." });
    }
    if (!conta.email) {
      const [outra] = await db.select({ id: users.id }).from(users).where(eq(users.email, emailFinal)).limit(1);
      if (outra) return res.status(409).json({ erro: "Esse e-mail já pertence a outra conta." });
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(novaSenha), email: emailFinal, loginMethod: "password" })
      .where(eq(users.id, conta.id));

    console.log(`[Recuperação] Senha redefinida para a conta ${conta.id}.`);
    res.json({ ok: true, nome: conta.name, email: emailFinal });
  });
}
