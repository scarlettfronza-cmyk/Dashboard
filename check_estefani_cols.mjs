import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT `value` FROM system_settings WHERE `key` = "monday_api_token"');
const token = rows[0]?.value;
await conn.end();

if (!token) { console.log('No token'); process.exit(1); }

const query = `{
  boards(ids: [18406699335]) {
    columns {
      id
      title
      type
    }
  }
}`;

const resp = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': token },
  body: JSON.stringify({ query })
});
const data = await resp.json();
const cols = data.data?.boards?.[0]?.columns || [];
console.log('All columns:');
cols.forEach(c => {
  console.log(`  id: ${c.id} | title: ${JSON.stringify(c.title)} | type: ${c.type}`);
});
