import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb } from "../db";
import { decryptSecret, encryptSecret } from "../secretCipher";

// ─── System Settings helpers ──────────────────────────────────────────────────
async function getSystemSettingInternal(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const { systemSettings } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db.select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return decryptSecret(rows[0]?.value ?? null);
}

async function setSystemSettingInternal(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { systemSettings } = await import("../../drizzle/schema");
  const protectedValue = key.includes("token") || key.includes("secret") || key.includes("key")
    ? encryptSecret(value)
    : value;
  await db.insert(systemSettings).values({ key, value: protectedValue })
    .onDuplicateKeyUpdate({ set: { value: protectedValue } });
}

// Export helper for use in other modules (e.g. mondaySync)
export { getSystemSettingInternal as getSystemSetting };

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Get Monday.com global API token status
  getMondayToken: adminProcedure
    .query(async () => {
      const token = await getSystemSettingInternal("monday_api_token");
      return {
        hasToken: !!token,
        maskedToken: token ? "••••••••••••••••••••" + token.slice(-6) : null,
      };
    }),

  // Save Monday.com global API token
  setMondayToken: adminProcedure
    .input(z.object({ token: z.string().min(10, "Token inválido") }))
    .mutation(async ({ input }) => {
      await setSystemSettingInternal("monday_api_token", input.token.trim());
      return { success: true };
    }),

  // Get Monday auto-sync last run timestamp
  getMondayAutoSyncStatus: publicProcedure
    .query(async () => {
      const lastSync = await getSystemSettingInternal("monday_last_auto_sync");
      return {
        lastSync: lastSync ? new Date(lastSync).getTime() : null,
      };
    }),

  // Remove Monday.com global API token
  removeMondayToken: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) return { success: false };
      const { systemSettings } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(systemSettings).where(eq(systemSettings.key, "monday_api_token"));
      return { success: true };
    }),
});
