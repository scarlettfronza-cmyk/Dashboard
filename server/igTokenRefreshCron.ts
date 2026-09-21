/**
 * Instagram Token Auto-Refresh Cron Job
 * Runs daily to refresh instagram_oauth tokens that are 45+ days old.
 * Instagram long-lived tokens expire after 60 days but can be refreshed
 * at any time by calling the token refresh endpoint.
 * Tokens that are already expired (>60 days) cannot be refreshed automatically
 * and require the user to reconnect via OAuth.
 */
import cron from "node-cron";
import axios from "axios";
import { getDb } from "./db";
import { integrations } from "../drizzle/schema";
import { eq, and, lt, gt, sql } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "./secretCipher";

const META_APP_ID = process.env.META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;

/**
 * Attempt to refresh a long-lived Instagram/Facebook token.
 * Only works for tokens that are still valid (not expired).
 * Returns the new token string, or null if refresh failed.
 */
async function refreshLongLivedToken(token: string): Promise<string | null> {
  try {
    const res = await axios.get("https://graph.facebook.com/v21.0/oauth/access_token", {
      params: {
        grant_type: "fb_exchange_token",
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: token,
      },
      timeout: 15000,
    });
    return res.data.access_token ?? null;
  } catch (e: any) {
    const msg = e.response?.data?.error?.message ?? e.message;
    console.warn(`[IG Token Refresh] Failed to refresh token: ${msg}`);
    return null;
  }
}

export async function runIgTokenRefresh(): Promise<{ refreshed: number; expired: number; skipped: number }> {
  const db = await getDb();
  if (!db) return { refreshed: 0, expired: 0, skipped: 0 };

  // Find all instagram_oauth integrations
  const allIgIntegrations = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "instagram_oauth"));

  let refreshed = 0;
  let expired = 0;
  let skipped = 0;

  for (const integ of allIgIntegrations) {
    const accessToken = decryptSecret(integ.accessToken);
    if (!accessToken || !integ.updatedAt) {
      skipped++;
      continue;
    }

    const daysSince = Math.floor((Date.now() - new Date(integ.updatedAt).getTime()) / 86400000);

    if (daysSince > 60) {
      // Already expired — cannot refresh, needs OAuth reconnect
      console.log(`[IG Token Refresh] Client ${integ.clientId}: token expired (${daysSince} days old), needs OAuth reconnect`);
      expired++;
      continue;
    }

    if (daysSince < 45) {
      // Token is fresh enough, skip
      skipped++;
      continue;
    }

    // Token is 45-60 days old — refresh it
    console.log(`[IG Token Refresh] Client ${integ.clientId}: refreshing token (${daysSince} days old)...`);
    const newToken = await refreshLongLivedToken(accessToken);

    if (newToken) {
      await db
        .update(integrations)
        .set({ accessToken: encryptSecret(newToken), updatedAt: new Date() })
        .where(
          and(
            eq(integrations.clientId, integ.clientId),
            eq(integrations.provider, "instagram_oauth")
          )
        );
      console.log(`[IG Token Refresh] Client ${integ.clientId}: token refreshed successfully`);
      refreshed++;
    } else {
      console.warn(`[IG Token Refresh] Client ${integ.clientId}: refresh failed, token still ${daysSince} days old`);
      skipped++;
    }
  }

  console.log(`[IG Token Refresh] Done — refreshed: ${refreshed}, expired: ${expired}, skipped: ${skipped}`);
  return { refreshed, expired, skipped };
}

export function startIgTokenRefreshCron(): void {
  // Run daily at 03:00 AM
  cron.schedule("0 0 3 * * *", async () => {
    console.log("[IG Token Refresh] Daily cron triggered at", new Date().toISOString());
    await runIgTokenRefresh().catch(err => {
      console.error("[IG Token Refresh] Unhandled error:", err);
    });
  });
  console.log("[IG Token Refresh] Cron job scheduled — runs daily at 03:00 AM");
}
