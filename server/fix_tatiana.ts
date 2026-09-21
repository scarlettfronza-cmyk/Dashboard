import { getDb } from "./db";
import { salesRecords, clients } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("no db"); process.exit(1); }

  const tatianaClients = await db.select().from(clients).where(eq(clients.name, "DRA TATIANA"));
  console.log("Tatiana:", JSON.stringify(tatianaClients.map(c => ({ id: c.id, name: c.name }))));

  if (tatianaClients.length === 0) { console.log("Not found"); return; }

  const clientId = tatianaClients[0].id;
  const records = await db.select().from(salesRecords).where(eq(salesRecords.clientId, clientId));
  console.log("Total records:", records.length);

  if (records.length > 0) {
    console.log("Sample records:", JSON.stringify(records.slice(0, 5).map(r => ({
      name: r.patientName,
      consultValue: r.consultValue,
      surgeryValue: r.surgeryValue,
      closed: r.closed,
      uploadedAt: r.uploadedAt,
    }))));

    // Delete all old records
    await db.delete(salesRecords).where(eq(salesRecords.clientId, clientId));
    console.log("Deleted all records for DRA TATIANA");
  }
}

main().catch(console.error);
