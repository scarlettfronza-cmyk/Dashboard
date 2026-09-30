/**
 * account.ts — cadastro e login com e-mail e senha.
 *
 * Cadastro é aberto: qualquer pessoa com o endereço do site cria uma conta.
 * A proteção dos dados não está na porta de entrada, e sim no fato de que
 * **conta nova nasce sem nenhum cliente vinculado**. Quem entra sem convite vê
 * uma tela vazia até que a gestora atribua clientes pelo painel. Nenhum dado de
 * paciente, board ou relatório é acessível antes disso.
 */
import { nanoid } from "nanoid";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME } from "@shared/const";
import {
  LOCAL_SESSION_COOKIE,
  SESSION_TTL_DAYS,
  createSessionToken,
  hashPassword,
  verifyPassword,
  passwordProblem,
  normalizeEmail,
  tooManyAttempts,
  registerFailure,
  clearFailures,
} from "../password";

const credentials = z.object({
  email: z.string().email("Informe um e-mail válido.").max(320),
  password: z.string().min(1, "Informe a senha."),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

/** Sessão de 30 dias. A SDR não precisa relogar toda semana. */
function setSessionCookie(ctx: { req: any; res: any }, token: string) {
  ctx.res.cookie(LOCAL_SESSION_COOKIE, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Limpa as duas sessões possíveis: a local e a do Manus OAuth. */
export const logoutProcedure = publicProcedure.mutation(({ ctx }) => {
  const options = getSessionCookieOptions(ctx.req);
  ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...options, maxAge: -1 });
  ctx.res.clearCookie(COOKIE_NAME, { ...options, maxAge: -1 });
  return { success: true } as const;
});

export const accountRouter = router({
  signup: publicProcedure
    .input(
      credentials.extend({
        name: z.string().trim().min(2, "Informe seu nome.").max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const email = normalizeEmail(input.email);

      const problem = passwordProblem(input.password);
      if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe uma conta com esse e-mail. Tente entrar.",
        });
      }

      const passwordHash = await hashPassword(input.password);
      // Contas locais recebem um openId próprio para conviver com as do OAuth,
      // que usam o identificador do Manus.
      const openId = `local:${nanoid(24)}`;

      // A primeira conta criada vira admin — senão ninguém consegue atribuir
      // clientes a ninguém e o sistema nasce travado.
      const anyUser = await db.select({ id: users.id }).from(users).limit(1);
      const role = anyUser.length === 0 ? ("admin" as const) : ("user" as const);

      await db.insert(users).values({
        openId,
        name: input.name,
        email,
        passwordHash,
        loginMethod: "password",
        role,
      });

      const [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar a conta." });

      setSessionCookie(ctx, await createSessionToken(user.id));
      return { id: user.id, name: user.name, email: user.email, role: user.role };
    }),

  login: publicProcedure.input(credentials).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const email = normalizeEmail(input.email);
    const ip = (ctx.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || ctx.req.ip || "?";
    const key = `${email}|${ip}`;

    if (tooManyAttempts(key)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Muitas tentativas. Espere 15 minutos e tente de novo.",
      });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Mesma mensagem para e-mail inexistente e senha errada: dizer qual dos dois
    // falhou entrega para um curioso quais e-mails têm conta no sistema.
    const ok = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !ok) {
      registerFailure(key);
      throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
    }

    clearFailures(key);
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
    setSessionCookie(ctx, await createSessionToken(user.id));
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user?.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta conta não usa senha." });
      }
      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
      }
      const problem = passwordProblem(input.newPassword);
      if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

      await db
        .update(users)
        .set({ passwordHash: await hashPassword(input.newPassword) })
        .where(eq(users.id, user.id));
      return { ok: true };
    }),

  logout: logoutProcedure,
});
