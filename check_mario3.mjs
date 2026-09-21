import mysql from 'mysql2/promise';
import axios from 'axios';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tokenRows] = await conn.execute('SELECT value FROM system_settings WHERE `key` = "monday_api_token"');
const token = tokenRows[0]?.value;
await conn.end();

let cursor = null;
let allItems = [];

do {
  let query, variables;
  if (!cursor) {
    query = `query { boards(ids: [7171531533]) { items_page(limit: 200) { cursor items { id name column_values(ids: ["date_mm2yvzgx"]) { id text } } } } }`;
    variables = {};
  } else {
    query = `query($cursor: String!) { next_items_page(limit: 200, cursor: $cursor) { cursor items { id name column_values(ids: ["date_mm2yvzgx"]) { id text } } } }`;
    variables = { cursor };
  }
  
  const resp = await axios.post('https://api.monday.com/v2', { query, variables }, {
    headers: { Authorization: token, 'Content-Type': 'application/json' }
  });
  
  let page;
  if (!cursor) {
    page = resp.data?.data?.boards?.[0]?.items_page;
  } else {
    page = resp.data?.data?.next_items_page;
  }
  
  allItems = allItems.concat(page?.items ?? []);
  cursor = page?.cursor ?? null;
} while (cursor);

const comFechamento = allItems.filter(i => {
  const col = i.column_values.find(c => c.id === 'date_mm2yvzgx');
  return col?.text && col.text.trim() !== '';
});

console.log(`Total itens: ${allItems.length}`);
console.log(`Com "Datac de fechamneto" preenchida: ${comFechamento.length}`);
comFechamento.forEach(i => {
  const col = i.column_values.find(c => c.id === 'date_mm2yvzgx');
  console.log(`  ${i.name} | ${col?.text}`);
});
