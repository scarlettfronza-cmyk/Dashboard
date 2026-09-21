import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT `value` FROM system_settings WHERE `key` = "monday_api_token"');
const token = rows[0]?.value;
await conn.end();

if (!token) { console.log('No token'); process.exit(1); }

// Verificar colunas do board
const query = `query { boards(ids: [18406678106]) { columns { id title type } } }`;
const resp = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': token },
  body: JSON.stringify({ query })
});
const data = await resp.json();
const cols = data.data?.boards?.[0]?.columns || [];
console.log('Colunas do board Dra Tatiana:');
cols.forEach(c => console.log(`  ${c.id}: "${c.title}" (${c.type})`));

// Buscar itens fechados
const query2 = `
  query {
    boards(ids: [18406678106]) {
      items_page(limit: 50, query_params: {rules: [{column_id: "color_mm0gc5pp", compare_value: ["1"]}]}) {
        items {
          id
          name
          updated_at
          column_values(ids: ["date_mm1hc7mc", "date_mm2rr72d", "date4"]) {
            id
            text
            value
          }
        }
      }
    }
  }
`;
const resp2 = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': token },
  body: JSON.stringify({ query: query2 })
});
const data2 = await resp2.json();
const items = data2.data?.boards?.[0]?.items_page?.items || [];
console.log('\nItens fechados:', items.length);
items.forEach(item => {
  console.log(`\n  ${item.name} (updated: ${item.updated_at})`);
  item.column_values.forEach(cv => console.log(`    ${cv.id}: "${cv.text}" (value: ${cv.value})`));
});
