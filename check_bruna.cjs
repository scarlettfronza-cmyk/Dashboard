const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Buscar cliente Bruna
  const [clients] = await conn.execute("SELECT id, name FROM clients WHERE name LIKE '%Bruna%' OR name LIKE '%Iori%'");
  console.log('Clientes:', JSON.stringify(clients, null, 2));
  
  if (clients.length > 0) {
    const clientId = clients[0].id;
    // Buscar integração Meta
    const [integrations] = await conn.execute(
      "SELECT id, type, adAccountId, extraConfig, createdAt FROM integrations WHERE clientId = ? AND type = 'meta_token'",
      [clientId]
    );
    console.log('\nIntegração Meta:', JSON.stringify(integrations, null, 2));
    
    // Verificar se há dados de anúncio
    const [ads] = await conn.execute(
      "SELECT COUNT(*) as total, MIN(date) as minDate, MAX(date) as maxDate FROM adMetrics WHERE clientId = ?",
      [clientId]
    );
    console.log('\nDados de anúncio:', JSON.stringify(ads, null, 2));
  }
  
  await conn.end();
}
main().catch(console.error);
