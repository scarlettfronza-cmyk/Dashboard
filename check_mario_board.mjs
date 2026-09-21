import mysql from 'mysql2/promise';
import axios from 'axios';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT value FROM system_settings WHERE `key` = "monday_api_token"');
const token = rows[0]?.value;
await conn.end();

if (!token) { console.log('No token'); process.exit(1); }

const query = `
  query {
    boards(ids: [7171531533]) {
      columns {
        id
        title
        type
      }
    }
  }
`;

const resp = await axios.post('https://api.monday.com/v2', { query }, {
  headers: { Authorization: token, 'Content-Type': 'application/json' }
});

const cols = resp.data?.data?.boards?.[0]?.columns ?? [];
console.log('=== COLUNAS DO BOARD DR MARIO ===');
cols.forEach(c => console.log(`${c.id} | ${c.type} | ${c.title}`));
