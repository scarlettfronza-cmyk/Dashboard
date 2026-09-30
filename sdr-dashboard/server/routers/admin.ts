/**
 * admin.ts — painel da gestora.
 *
 * Fluxo que este router sustenta:
 *   1. A gestora cria o login da SDR (ou a SDR cria a conta dela) e ela entra numa tela vazia.
 *   2. A gestora abre o painel, vê a nova SDR na lista.
 *   3. Busca o board da clínica pelo nome (não pelo ID).
 *   4. Atribui o board à SDR. Na próxima carga, o cliente aparece na sidebar dela.
 *
 * Toda procedure aqui é `adminProcedure`: a checagem de papel acontece no
 * servidor, não em condicional de interface.
 */
import { nanoid } from "nanoid";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { users, sdrs, clients, aiReports } from "../../drizzle/schema";
import { adminProcedure, router } from "../_core/trpc";
import { listAllBoards, invalidateCatalog, invalidateCache } from "../monday";
import { sincronizarCliente } from "../sync";
import { hashPassword, normalizeEmail, passwordProblem } from "../password";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

/** Ignora acentos e caixa na busca — "estefani" acha "Dra Estéfani". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const adminRouter = router({
  /**
   * Pessoas cadastradas + quantos clientes cada uma tem. Perfis de SDR são
   * criados sob demanda, então quem nunca abriu o dashboard aparece sem perfil.
   */
  people: adminProcedure.query(async () => {
    const db = await requireDb();

    const allUsers = await db.select().from(users);
    const allSdrs = await db.select().from(sdrs);
    const allClients = await db.select().from(clients);

    const sdrByUser = new Map(allSdrs.map(s => [s.userId, s]));
    const clientCount = new Map<number, number>();
    for (const c of allClients) {
      if (!c.isActive) continue;
      clientCount.set(c.sdrId, (clientCount.get(c.sdrId) ?? 0) + 1);
    }

    return allUsers
      .map(u => {
        const sdr = sdrByUser.get(u.id) ?? null;
        return {
          userId: u.id,
          sdrId: sdr?.id ?? null,
          name: u.name ?? "(sem nome)",
          email: u.email,
          role: u.role,
          loginMethod: u.loginMethod,
          hasPassword: Boolean(u.passwordHash),
          createdAt: u.createdAt,
          lastSignedIn: u.lastSignedIn,
          clientCount: sdr ? (clientCount.get(sdr.id) ?? 0) : 0,
        };
      })
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }),

  /** Cria o perfil de SDR de alguém que ainda não abriu o dashboard. */
  ensureSdrProfile: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      const existing = await db.select().from(sdrs).where(eq(sdrs.userId, user.id)).limit(1);
      if (existing.length) return existing[0];

      await db.insert(sdrs).values({
        userId: user.id,
        name: user.name ?? "SDR",
        email: user.email ?? `${user.openId}@sdr.local`,
        boardIds: "[]",
      });
      const [created] = await db.select().from(sdrs).where(eq(sdrs.userId, user.id)).limit(1);
      return created;
    }),

  /**
   * A gestora cria o login da SDR (nome, e-mail e senha inicial) e já deixa o
   * perfil pronto para receber clientes. A SDR pode trocar a senha depois.
   */
  createSdrAccount: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(2, "Informe o nome.").max(120),
        email: z.string().trim().email("E-mail inválido."),
        password: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const email = normalizeEmail(input.email);
      const problem = passwordProblem(input.password);
      if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing.length) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com esse e-mail." });

      const openId = `local:${nanoid(24)}`;
      await db.insert(users).values({
        openId,
        name: input.name,
        email,
        passwordHash: await hashPassword(input.password),
        loginMethod: "password",
        role: "user",
      });
      const [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar a conta." });

      await db.insert(sdrs).values({ userId: user.id, name: input.name, email, boardIds: "[]" });
      return { userId: user.id, name: user.name, email };
    }),

  /**
   * Define uma senha nova para qualquer conta: SDR que esqueceu a senha ou
   * conta antiga do Manus, que não tinha senha própria.
   */
  setPassword: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), password: z.string() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const problem = passwordProblem(input.password);
      if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      if (!user.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta conta não tem e-mail. Use /recuperar para definir e-mail e senha." });
      }

      await db
        .update(users)
        .set({ passwordHash: await hashPassword(input.password), loginMethod: "password" })
        .where(eq(users.id, user.id));
      return { ok: true };
    }),

  setRole: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      if (input.userId === ctx.user.id && input.role === "user") {
        // Sem esta trava dá para se rebaixar sozinha e ficar sem nenhum admin.
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode remover o próprio acesso de administradora." });
      }
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { ok: true };
    }),

  /**
   * Busca no catálogo de boards da conta do Monday, já marcando quais estão
   * atribuídos e para quem.
   */
  searchBoards: adminProcedure
    .input(z.object({ q: z.string().max(120).optional(), force: z.boolean().optional() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [catalog, assigned] = await Promise.all([
        listAllBoards({ force: input.force }),
        db.select().from(clients),
      ]);

      const allSdrs = await db.select().from(sdrs);
      const sdrName = new Map(allSdrs.map(s => [s.id, s.name]));

      // Um cliente pode ter vários boards em "id1,id2".
      const owner = new Map<string, { clientId: number; clientName: string; sdrName: string }>();
      for (const c of assigned) {
        if (!c.isActive) continue;
        for (const id of c.boardId.split(",").map(s => s.trim())) {
          owner.set(id, { clientId: c.id, clientName: c.name, sdrName: sdrName.get(c.sdrId) ?? "?" });
        }
      }

      const needle = fold(input.q ?? "");
      const results = catalog
        .filter(b => !needle || fold(b.name).includes(needle) || fold(b.workspace ?? "").includes(needle) || b.id.includes(needle))
        .map(b => ({ ...b, assignedTo: owner.get(b.id) ?? null }));

      return { total: catalog.length, results: results.slice(0, 200) };
    }),

  /**
   * Vincula um ou mais boards a uma SDR como um cliente. Aceita vários boards
   * porque o mesmo médico costuma ter um board de agendamentos e outro de
   * atendimento diário.
   */
  assignClient: adminProcedure
    .input(
      z.object({
        sdrId: z.number().int().positive(),
        name: z.string().trim().min(1).max(200),
        boardIds: z.array(z.string().regex(/^\d+$/)).min(1).max(6),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [sdr] = await db.select().from(sdrs).where(eq(sdrs.id, input.sdrId)).limit(1);
      if (!sdr) throw new TRPCError({ code: "NOT_FOUND", message: "SDR não encontrada." });

      // Um board só pode pertencer a um cliente, senão os números aparecem
      // duplicados em dois dashboards.
      const all = await db.select().from(clients);
      for (const c of all) {
        if (!c.isActive) continue;
        const overlap = c.boardId.split(",").map(s => s.trim()).filter(id => input.boardIds.includes(id));
        if (overlap.length) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `O board ${overlap[0]} já está vinculado ao cliente "${c.name}".`,
          });
        }
      }

      const token = nanoid(32);
      await db.insert(clients).values({
        sdrId: sdr.id,
        name: input.name,
        boardId: input.boardIds.join(","),
        clientToken: token,
        isActive: true,
      });

      const [created] = await db.select().from(clients).where(eq(clients.clientToken, token)).limit(1);

      // Primeira carga em segundo plano: sem isto, o cliente novo apareceria na
      // barra lateral da SDR com zero leads até a próxima rodada agendada.
      if (created) void sincronizarCliente(created);

      return created;
    }),

  /** Move um cliente de uma SDR para outra, mantendo relatórios e link do portal. */
  reassignClient: adminProcedure
    .input(z.object({ clientId: z.number().int().positive(), sdrId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const [sdr] = await db.select().from(sdrs).where(eq(sdrs.id, input.sdrId)).limit(1);
      if (!sdr) throw new TRPCError({ code: "NOT_FOUND", message: "SDR não encontrada." });

      await db.update(clients).set({ sdrId: sdr.id }).where(eq(clients.id, input.clientId));
      // Os relatórios acompanham o cliente para não sumirem do portal.
      await db.update(aiReports).set({ sdrId: sdr.id }).where(eq(aiReports.clientId, input.clientId));
      return { ok: true };
    }),

  /**
   * Desativa em vez de apagar: o portal do cliente para de responder, mas os
   * relatórios já enviados continuam no histórico.
   */
  deactivateClient: adminProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const [client] = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });

      await db.update(clients).set({ isActive: false }).where(eq(clients.id, client.id));
      for (const id of client.boardId.split(",")) invalidateCache(id.trim());
      return { ok: true };
    }),

  renameClient: adminProcedure
    .input(z.object({ clientId: z.number().int().positive(), name: z.string().trim().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(clients).set({ name: input.name }).where(eq(clients.id, input.clientId));
      return { ok: true };
    }),

  /** Todos os clientes com a SDR responsável — a visão geral da gestora. */
  allClients: adminProcedure.query(async () => {
    const db = await requireDb();
    const rows = await db.select().from(clients);
    const allSdrs = await db.select().from(sdrs);
    const sdrById = new Map(allSdrs.map(s => [s.id, s]));

    const active = rows.filter(c => c.isActive);
    const reportCounts = new Map<number, number>();
    if (active.length) {
      const reports = await db
        .select({ clientId: aiReports.clientId, status: aiReports.status })
        .from(aiReports)
        .where(inArray(aiReports.clientId, active.map(c => c.id)));
      for (const r of reports) {
        if (r.status !== "published") continue;
        reportCounts.set(r.clientId, (reportCounts.get(r.clientId) ?? 0) + 1);
      }
    }

    return active
      .map(c => ({
        id: c.id,
        name: c.name,
        boardIds: c.boardId.split(",").map(s => s.trim()),
        sdrId: c.sdrId,
        sdrName: sdrById.get(c.sdrId)?.name ?? "—",
        clientToken: c.clientToken,
        publishedReports: reportCounts.get(c.id) ?? 0,
      }))
      .sort((a, b) => a.sdrName.localeCompare(b.sdrName, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  }),

  refreshBoardCatalog: adminProcedure.mutation(async () => {
    invalidateCatalog();
    const boards = await listAllBoards({ force: true });
    return { total: boards.length };
  }),
});
