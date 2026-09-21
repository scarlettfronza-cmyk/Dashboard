import { createConnection } from 'mysql2/promise';

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute(`
    SELECT c.name, i.adAccountId, i.accessToken
    FROM clients c
    JOIN integrations i ON i.clientId = c.id AND i.provider = 'meta_token'
    WHERE c.name LIKE '%MATHEUS%'
  `);
  await conn.end();

  const { name, adAccountId, accessToken } = rows[0];
  console.log(`\nCliente: ${name}`);
  console.log(`Conta: ${adAccountId}\n`);

  // Buscar todos os campos relevantes de billing
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "balance,amount_spent,spend_cap,currency,account_status,funding_source_details",
  });

  const resp = await fetch(`${GRAPH_API_BASE}/${adAccountId}?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  const data = await resp.json();
  console.log("Resposta completa da API Meta:");
  console.log(JSON.stringify(data, null, 2));

  if (data.balance !== undefined) {
    console.log(`\n--- Interpretação ---`);
    console.log(`balance (raw): ${data.balance} → R$ ${(parseFloat(data.balance) / 100).toFixed(2)}`);
    console.log(`amount_spent (raw): ${data.amount_spent} → R$ ${(parseFloat(data.amount_spent || 0) / 100).toFixed(2)}`);
    console.log(`spend_cap (raw): ${data.spend_cap} → R$ ${(parseFloat(data.spend_cap || 0) / 100).toFixed(2)}`);
  }
}

main().catch(console.error);
