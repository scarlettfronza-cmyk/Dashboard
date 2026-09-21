import mysql from 'mysql2/promise';
import axios from 'axios';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tokenRows] = await conn.execute('SELECT value FROM system_settings WHERE `key` = "monday_api_token"');
const token = tokenRows[0]?.value;
await conn.end();

if (!token) { console.log('No token'); process.exit(1); }

// Buscar itens do board com a coluna date_mm2yvzgx preenchida
const query = `
  query {
    boards(ids: [7171531533]) {
      items_page(limit: 200) {
        items {
          name
          column_values(ids: ["date_mm2yvzgx", "data"]) {
            id
            title
            text
          }
        }
      }
    }
  }
`;

const resp = await axios.post('https://api.monday.com/v2', { query }, {
  headers: { Authorization: token, 'Content-Type': 'application/json' }
});

const items = resp.data?.data?.boards?.[0]?.items_page?.items ?? [];
const comFechamento = items.filter(i => {
  const col = i.column_values.find(c => c.id === 'date_mm2yvzgx');
  return col?.text && col.text.trim() !== '';
});

console.log(`Total itens: ${items.length}`);
console.log(`Com "Datac de fechamneto" preenchida: ${comFechamento.length}`);
console.log('\n=== ITENS COM FECHAMENTO ===');
comFechamento.forEach(i => {
  const fechCol = i.column_values.find(c => c.id === 'date_mm2yvzgx');
  const consultCol = i.column_values.find(c => c.id === 'data');
  console.log(`${i.name} | fechamento: ${fechCol?.text} | consulta: ${consultCol?.text}`);
});
