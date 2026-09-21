/**
 * Scheduled task endpoints — protected by session cookie (user role).
 * The scheduled task agent sends requests here to trigger budget checks.
 */
import type { Express, Request, Response } from "express";
import { runBudgetCheck } from "./budgetCron";

export function registerScheduledRoutes(app: Express) {
  /**
   * POST /api/scheduled/sync-monday
   * Triggers the Monday.com auto-sync for all clients (or a specific clientId).
   * Accepts: { clientId?: number }
   */
  app.post("/api/scheduled/sync-monday", async (req: Request, res: Response) => {
    try {
      const { runMondayAutoSync } = await import("./mondayCron");
      const result = await runMondayAutoSync();
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[sync-monday] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/scheduled/check-budget
   * Verifies the balance of all prepaid clients and sends Telegram alerts
   * for any account with balance <= threshold (default R$200).
   * Accepts: { threshold?: number }
   */
  app.post("/api/scheduled/check-budget", async (req: Request, res: Response) => {
    try {
      const threshold = typeof req.body?.threshold === "number" ? req.body.threshold : 200;
      const result = await runBudgetCheck(threshold);
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[check-budget] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });
}
