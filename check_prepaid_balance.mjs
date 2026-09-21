import { createConnection } from 'mysql2/promise';

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

async function fetchBalance(accessToken, adAccountId) {
  const normalizedId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "balance,amount_spent,spend_cap,currency,account_status,funding_source_details",
  });
  try {
    const resp = await fetch(`${GRAPH_API_BASE}/${normalizedId}?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json();
    if (data.error) return { error: data.error.message };

    // Para contas pré-pagas com "Available funds", o saldo real está em funding_source_details
    let balance = parseFloat(data.balance ?? "0") / 100;
    if (data.funding_source_details?.display_string) {
      const match = data.funding_source_details.display_string.match(/[\d,]+\.?\d*/g);
      if (match && match.length > 0) {
        const parsed = parseFloat(match[match.length - 1].replace(",", ""));
        if (!isNaN(parsed) && parsed > 0) balance = parsed;
      }
    }

    return {
      balance,
      amountSpent: parseFloat(data.amount_spent ?? "0") / 100,
      spendCap: parseFloat(data.spend_cap ?? "0") / 100,
      currency: data.currency ?? "BRL",
      fundingSource: data.funding_source_details?.display_string ?? null,
    };
  } catch (err) {
    return { error: String(err) };
  }
}

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute(`
    SELECT c.id, c.name, i.accessToken, i.adAccountId 
    FROM clients c
    LEFT JOIN integrations i ON i.clientId = c.id AND i.provider = 'meta_token'
    WHERE c.isPrePaid = 1
  `);
  await conn.end();

  console.log(`\nClientes pré-pagos: ${rows.length}\n`);
  console.log("=".repeat(60));

  for (const row of rows) {
    if (!row.accessToken || !row.adAccountId) {
      console.log(`\n[SEM TOKEN] ${row.name}`);
      continue;
    }
    const budget = await fetchBalance(row.accessToken, row.adAccountId);
    if (budget.error) {
      console.log(`\n[ERRO] ${row.name}: ${budget.error}`);
    } else {
      const status = budget.balance <= 100 ? "🚨 ALERTA" : budget.balance <= 300 ? "⚠️  ATENÇÃO" : "✅ OK";
      console.log(`\n[${status}] ${row.name}`);
      console.log(`  Saldo disponível: ${budget.currency} ${budget.balance.toFixed(2)}`);
      console.log(`  Gasto total: ${budget.currency} ${budget.amountSpent.toFixed(2)}`);
      if (budget.fundingSource) console.log(`  Fonte: ${budget.fundingSource}`);
    }
  }
  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
