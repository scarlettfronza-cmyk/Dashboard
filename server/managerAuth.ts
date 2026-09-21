import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { jwtVerify } from "jose";
import { managerClients } from "../drizzle/schema";
import { getDb } from "./db";
import { getManagerJwtSecret } from "./managerAuthSecret";

export async function verifyManagerJwt(token: string): Promise<{ managerId: number }> {
  try {
    const result = await jwtVerify(token, getManagerJwtSecret());
    const managerId = result.payload.managerId;
    if (typeof managerId !== "number") throw new Error("managerId ausente");
    return { managerId };
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Token de gestor inválido ou expirado" });
  }
}

export async function verifyManagerOwnsClient(token: string, clientId: number): Promise<{ managerId: number }> {
  const { managerId } = await verifyManagerJwt(token);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

  const assignment = await db.select({ id: managerClients.id }).from(managerClients)
    .where(and(eq(managerClients.managerId, managerId), eq(managerClients.clientId, clientId)))
    .limit(1);
  if (!assignment[0]) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado a este cliente" });
  }
  return { managerId };
}
