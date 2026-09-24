/**
 * Budget Alert Cron Job
 * Runs every 2 hours to check prepaid Meta Ads account balances.
 * Sends Telegram alerts when balance is below threshold.
 * Includes anti-spam: does not re-alert the same client within 4 hours.
 */
import cron from "node-cron";
import axios from "axios";
import { getDb } from "./db";
import { fetchAdAccountBudget } from "./metaApi";
import { ENV } from "./_core/env";
import { getSystemSetting } from "./_core/systemRouter";
import { resolverToken, CHAVE_TOKEN_AGENCIA } from "./metaTokenResolver";

export const VARIAVEIS_TELEGRAM = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] as const;

/** Quais variáveis do Telegram faltam no ambiente. Vazio = configurado. */
export function telegramFaltando(): string[] {
  const f: string[] = [];
  if (!ENV.telegramBotToken) f.push("TELEGRAM_BOT_TOKEN");
  if (!ENV.telegramChatId) f.push("TELEGRAM_CHAT_ID");
  return f;
}

// In-memory cooldown tracker: clientId -> timestamp of last alert sent
const alertCooldowns = new Map<number, number>();
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const LOW_BALANCE_THRESHOLD = 200; // R$200 default threshold
const CRITICAL_BALANCE_THRESHOLD = 50; // R$50 critical threshold

/**
 * Send a Telegram message to the configured chat.
 * Devolve o erro em texto para a tela de teste mostrar o motivo real
 * (token errado, chat id errado, bot nunca iniciado...).
 */
export async function sendTelegram(text: string): Promise<{ ok: boolean; erro?: string }> {
  const faltando = telegramFaltando();
  if (faltando.length) {
    console.warn("[Telegram] Bot token or chat ID not configured — skipping");
    return { ok: false, erro: `Telegram não configurado (faltam: ${faltando.join(", ")})` };
  }
  try {
    await axios.post(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
      chat_id: ENV.telegramChatId,
      text,
      parse_mode: "Markdown",
    }, { timeout: 15000 });
    return { ok: true };
  } catch (err: any) {
    const desc = err?.response?.data?.description;
    const msg = desc ? String(desc) : err instanceof Error ? err.message : String(err);
    console.error("[Telegram] Failed to send message:", msg);
    return { ok: false, erro: msg };
  }
}

export async function runBudgetCheck(threshold = LOW_BALANCE_THRESHOLD): Promise<{
  checked: number;
  alerts: number;
  skipped: number;
  results: Array<{ name: string; balance: number | null; status: string }>;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[Budget Check] DB unavailable, skipping");
    return { checked: 0, alerts: 0, skipped: 0, results: [] };
  }

  const { clients: clientsSchema } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const { getIntegration } = await import("./db");

  const prePaidClients = await db
    .select()
    .from(clientsSchema)
    .where(eq(clientsSchema.isPrePaid, 1));

  console.log(`[Budget Check] Checking ${prePaidClients.length} prepaid clients (threshold: R$${threshold})`);

  const lowBalanceAlerts: Array<{ name: string; balance: number; currency: string; isCritical: boolean }> = [];
  const results: Array<{ name: string; balance: number | null; status: string }> = [];
  let skipped = 0;

  const now = Date.now();
  // O token é o da agência quando existir; a conta continua por cliente.
  const tokenAgencia = await getSystemSetting(CHAVE_TOKEN_AGENCIA);

  for (const client of prePaidClients) {
    const integration = await getIntegration(client.id, "meta_token");
    const { token, adAccountId } = resolverToken(tokenAgencia, integration);
    if (!token || !adAccountId) {
      results.push({ name: client.name, balance: null, status: !adAccountId ? "sem conta de anúncio" : "sem token Meta" });
      continue;
    }

    // Só a conta principal: a de saldo é a que paga por PIX/boleto.
    const contaPrincipal = adAccountId.split(",")[0].trim();
    const budget = await fetchAdAccountBudget(token, contaPrincipal);
    if (!budget) {
      results.push({ name: client.name, balance: null, status: "erro ao buscar saldo" });
      continue;
    }

    results.push({ name: client.name, balance: budget.balance, status: "ok" });

    if (budget.balance <= threshold) {
      // Check cooldown: skip if we already alerted this client recently
      const lastAlert = alertCooldowns.get(client.id);
      if (lastAlert && now - lastAlert < COOLDOWN_MS) {
        skipped++;
        console.log(`[Budget Check] Skipping ${client.name} (cooldown: ${Math.round((COOLDOWN_MS - (now - lastAlert)) / 60000)} min remaining)`);
        continue;
      }
      lowBalanceAlerts.push({
        name: client.name,
        balance: budget.balance,
        currency: budget.currency,
        isCritical: budget.balance <= CRITICAL_BALANCE_THRESHOLD,
      });
      alertCooldowns.set(client.id, now);
    }
  }

  // Send Telegram alert if any accounts are low
  if (lowBalanceAlerts.length > 0) {
    const criticalOnes = lowBalanceAlerts.filter(a => a.isCritical);
    const lowOnes = lowBalanceAlerts.filter(a => !a.isCritical);

    let text = "";

    if (criticalOnes.length > 0) {
      const lines = criticalOnes
        .map(a => `🔴 *${a.name.trim()}*\nSaldo crítico: R$ ${a.balance.toFixed(2)}`)
        .join("\n\n");
      text += `🚨 *SALDO CRÍTICO — Campanhas podem pausar!*\n\n${lines}\n\n`;
    }

    if (lowOnes.length > 0) {
      const lines = lowOnes
        .map(a => `⚠️ *${a.name.trim()}*\nSaldo restante: R$ ${a.balance.toFixed(2)}`)
        .join("\n\n");
      if (text) {
        text += `---\n\n⚠️ *Saldo Baixo*\n\n${lines}\n\n`;
      } else {
        text = `🚨 *Alerta de Saldo Baixo*\n\n${lines}\n\n`;
      }
    }

    text += `_Recarregue antes que as campanhas pausem!_`;

    const { ok: sent } = await sendTelegram(text);
    if (sent) {
      console.log(`[Budget Check] Sent Telegram alert for ${lowBalanceAlerts.length} client(s) (${criticalOnes.length} critical, ${lowOnes.length} low)`);
    }
  } else {
    console.log(`[Budget Check] All prepaid accounts OK or in cooldown (no alerts sent)`);
  }

  return {
    checked: prePaidClients.length,
    alerts: lowBalanceAlerts.length,
    skipped,
    results,
  };
}

export function startBudgetCron(): void {
  // Run every 2 hours (at :00 of even hours: 00:00, 02:00, 04:00, ...)
  cron.schedule("0 0 */2 * * *", async () => {
    console.log("[Budget Check] Cron triggered at", new Date().toISOString());
    await runBudgetCheck(LOW_BALANCE_THRESHOLD).catch(err => {
      console.error("[Budget Check] Unhandled error:", err);
    });
  });
  console.log("[Budget Check] Cron job scheduled — runs every 2 hours");
}
