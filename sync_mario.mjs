import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar o token do Monday
const [tokenRows] = await conn.execute('SELECT value FROM system_settings WHERE `key` = "monday_api_token"');
const token = tokenRows[0]?.value;
if (!token) { console.log('No Monday token'); process.exit(1); }

// Importar e executar o sync
const { syncMondayBoard } = await import('./server/mondaySync.ts');

console.log('Syncing Dr Mario (clientId=1, boardId=7171531533)...');
const result = await syncMondayBoard(1, '7171531533', token, '2026-04-01', '2026-04-30');
console.log('Sync result:', JSON.stringify(result, null, 2));

// Verificar fechamentos no banco
const [fechamentos] = await conn.execute(`
  SELECT id, patientName, conversionDate, closed, surgeryValue, closedValue
  FROM sales_records 
  WHERE clientId = 1 AND closed = 1
  ORDER BY conversionDate DESC
  LIMIT 20
`);
console.log('\n=== FECHAMENTOS DR MARIO ===');
console.log(JSON.stringify(fechamentos, null, 2));

// Contar por mês
const [counts] = await conn.execute(`
  SELECT 
    DATE_FORMAT(conversionDate, '%Y-%m') as mes,
    COUNT(*) as total
  FROM sales_records 
  WHERE clientId = 1 AND closed = 1 AND conversionDate IS NOT NULL
  GROUP BY mes
  ORDER BY mes DESC
`);
console.log('\n=== FECHAMENTOS POR MÊS ===');
console.log(JSON.stringify(counts, null, 2));

await conn.end();
