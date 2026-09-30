import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import type { User } from "../../drizzle/schema";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { LOCAL_SESSION_COOKIE, readSessionToken } from "../password";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. Sessão local (cadastro com e-mail e senha). Tem precedência porque é o
  //    caminho normal de login das SDRs.
  try {
    const cookieHeader = opts.req.headers.cookie ?? "";
    const token = cookieHeader
      .split(";")
      .map(c => c.trim())
      .find(c => c.startsWith(`${LOCAL_SESSION_COOKIE}=`))
      ?.slice(LOCAL_SESSION_COOKIE.length + 1);

    const userId = await readSessionToken(token ? decodeURIComponent(token) : undefined);
    if (userId !== null) {
      const db = await getDb();
      if (db) {
        const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        user = rows[0] ?? null;
      }
    }
  } catch {
    user = null;
  }

  // 2. Manus OAuth, mantido para as contas que já existiam.
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      // Autenticação é opcional para as procedures públicas.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
