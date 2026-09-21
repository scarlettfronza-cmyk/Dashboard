import { getDb } from "../server/db";
import { systemSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const tokenRow = await db.select().from(systemSettings).where(eq(systemSettings.key, "monday_api_token")).then(r => r[0]);
  const token = tokenRow?.value;
  if (!token) { console.log("No token"); process.exit(1); }

  // Check Dr Mario board columns
  const query = `query { boards(ids: [7171531533]) { columns { id title type } } }`;
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": token, "API-Version": "2024-01" },
    body: JSON.stringify({ query })
  });
  const data = await res.json() as any;
  console.log("=== DR MARIO BOARD COLUMNS ===");
  console.log(JSON.stringify(data.data?.boards?.[0]?.columns, null, 2));

  // Also get a sample item to see actual data
  const itemQuery = `query { boards(ids: [7171531533]) { items_page(limit: 2) { items { id name column_values { id type text value } } } } }`;
  const itemRes = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": token, "API-Version": "2024-01" },
    body: JSON.stringify({ query: itemQuery })
  });
  const itemData = await itemRes.json() as any;
  console.log("\n=== SAMPLE ITEMS ===");
  console.log(JSON.stringify(itemData.data?.boards?.[0]?.items_page?.items, null, 2));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
