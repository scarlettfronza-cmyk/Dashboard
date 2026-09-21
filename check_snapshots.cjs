const mysql = require('mysql2/promise');
async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get Tatiana's recent snapshots
  const [rows] = await conn.execute(
    'SELECT s.snapshotDate, s.vendas, s.totalEmVendas FROM snapshots s JOIN clients c ON s.clientId = c.id WHERE c.name LIKE "%TATIANA%" ORDER BY s.snapshotDate DESC LIMIT 10'
  );
  
  console.log('Tatiana snapshots (most recent first):');
  for (const r of rows) {
    console.log('date:', r.snapshotDate, '| vendas:', r.vendas, '| totalEmVendas:', r.totalEmVendas);
  }
  
  // March 2026 aggregate
  const [agg] = await conn.execute(
    'SELECT SUM(s.vendas) as totalVendas, SUM(s.totalEmVendas) as totalEmVendas FROM snapshots s JOIN clients c ON s.clientId = c.id WHERE c.name LIKE "%TATIANA%" AND s.snapshotDate BETWEEN "2026-03-01" AND "2026-03-31"'
  );
  console.log('\nMarch 2026 aggregate:', JSON.stringify(agg[0]));
  
  await conn.end();
}
main().catch(console.error);
