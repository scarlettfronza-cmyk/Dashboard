/**
 * Monday.com Auto-Sync Cron Job
 * Runs every hour to sync all clients with a mondayBoardId configured.
 * Saves the last sync timestamp to system_settings for display in the dashboard.
 * After each sync, automatically sends CAPI events (Schedule + Purchase) for
 * clients that have Pixel ID and CAPI Token configured.
 */
import cron from "node-cron";
import { getDb } from "./db";
import { syncMondayBoard } from "./mondaySync";
import { getSystemSetting } from "./_core/systemRouter";

// Export the setSystemSetting helper (re-implemented here to avoid circular imports)
async function setSystemSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { systemSettings } = await import("../drizzle/schema");
  await db.insert(systemSettings).values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

export async function runMondayAutoSync(): Promise<{ synced: number; errors: number; skipped: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Monday AutoSync] DB unavailable, skipping");
    return { synced: 0, errors: 0, skipped: 0 };
  }

  const { clients: clientsTable } = await import("../drizzle/schema");
  const { isNotNull } = await import("drizzle-orm");

  // Get all clients with a boardId
  const clientsWithBoard = await db
    .select({ id: clientsTable.id, name: clientsTable.name, mondayBoardId: clientsTable.mondayBoardId })
    .from(clientsTable)
    .where(isNotNull(clientsTable.mondayBoardId));

  // Check if there's a global token
  const globalToken = await getSystemSetting("monday_api_token");

  let synced = 0;
  let errors = 0;
  let skipped = 0;

  console.log(`[Monday AutoSync] Starting auto-sync for ${clientsWithBoard.length} clients`);

  for (const client of clientsWithBoard) {
    if (!client.mondayBoardId) {
      skipped++;
      continue;
    }
    if (!globalToken) {
      // No global token — skip silently
      skipped++;
      continue;
    }
    try {
      // Timeout of 5 minutes per client to avoid blocking the whole queue
      const result = await Promise.race([
        syncMondayBoard(client.id, client.mondayBoardId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("sync timeout after 5 min")), 5 * 60 * 1000)
        ),
      ]);
      if (result.imported >= 0) {
        synced++;
        console.log(`[Monday AutoSync] ✓ ${client.name}: ${result.imported} records`);
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Monday AutoSync] ✗ ${client.name}: ${msg}`);
    }
  }

  // Save last sync timestamp
  await setSystemSetting("monday_last_auto_sync", new Date().toISOString());

  console.log(`[Monday AutoSync] Done — synced: ${synced}, errors: ${errors}, skipped: ${skipped}`);

  // ── Auto-send CAPI events for clients with Pixel + Token configured ──────────
  try {
    const { clients: allClients } = await import("../drizzle/schema");
    const { isNotNull: isNotNullCapi, and: andCapi } = await import("drizzle-orm");
    const capiClients = await db
      .select({ id: allClients.id, name: allClients.name })
      .from(allClients)
      .where(andCapi(
        isNotNullCapi(allClients.metaPixelId),
        isNotNullCapi(allClients.metaCAPIToken),
        isNotNullCapi(allClients.mondayBoardId),
      ));

    if (capiClients.length > 0) {
      console.log(`[CAPI AutoSend] Sending CAPI events for ${capiClients.length} clients`);
      const { sendCAPIEventsForClient } = await import("./capiAutoSend");
      for (const c of capiClients) {
        try {
          const result = await sendCAPIEventsForClient(c.id);
          console.log(`[CAPI AutoSend] ✓ ${c.name}: Schedule=${result.scheduleSent}, Purchase=${result.sent}`);
        } catch (err) {
          console.error(`[CAPI AutoSend] ✗ ${c.name}:`, err instanceof Error ? err.message : err);
        }
      }
    }
  } catch (err) {
    console.error("[CAPI AutoSend] Error during auto-send:", err instanceof Error ? err.message : err);
  }

  return { synced, errors, skipped };
}

export function startMondayCron(): void {
  // Run every hour at minute 0 (e.g. 09:00, 10:00, 11:00...)
  cron.schedule("0 * * * *", async () => {
    console.log("[Monday AutoSync] Cron triggered at", new Date().toISOString());
    await runMondayAutoSync().catch(err => {
      console.error("[Monday AutoSync] Unhandled error:", err);
    });
  });
  console.log("[Monday AutoSync] Cron job scheduled — runs every hour at :00");
}
