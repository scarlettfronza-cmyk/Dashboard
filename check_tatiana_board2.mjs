import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT `value` FROM system_settings WHERE `key` = "monday_api_token"');
const token = rows[0]?.value;
await conn.end();

// Buscar todos os itens com status fechado (tentar diferentes valores)
const query = `
  query {
    boards(ids: [18406678106]) {
      items_page(limit: 100) {
        items {
          id
          name
          updated_at
          column_values(ids: ["color_mm0gc5pp", "date_mm1hc7mc", "date_mm2rr72d", "date_mm0gbha1"]) {
            id
            text
            value
          }
        }
      }
    }
  }
`;
const resp = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': token },
  body: JSON.stringify({ query })
});
const data = await resp.json();
const items = data.data?.boards?.[0]?.items_page?.items || [];
console.log('Total itens:', items.length);

// Mostrar todos os valores de status
const statusValues = new Set();
items.forEach(item => {
  const status = item.column_values.find(cv => cv.id === 'color_mm0gc5pp');
  if (status) statusValues.add(status.text + ' | value: ' + status.value);
});
console.log('\nValores de status únicos:');
statusValues.forEach(v => console.log(' ', v));

// Mostrar itens com "fechado" no status
console.log('\nItens com status contendo "fechado":');
items.filter(item => {
  const status = item.column_values.find(cv => cv.id === 'color_mm0gc5pp');
  return status?.text?.toLowerCase().includes('fechado');
}).forEach(item => {
  const status = item.column_values.find(cv => cv.id === 'color_mm0gc5pp');
  const dataProcFechado = item.column_values.find(cv => cv.id === 'date_mm1hc7mc');
  const dataConv = item.column_values.find(cv => cv.id === 'date_mm2rr72d');
  const dataConsulta = item.column_values.find(cv => cv.id === 'date_mm0gbha1');
  console.log(`\n  ${item.name}`);
  console.log(`    Status: "${status?.text}" (value: ${status?.value})`);
  console.log(`    Data Procedimento Fechado: "${dataProcFechado?.text}"`);
  console.log(`    Data de conversao: "${dataConv?.text}"`);
  console.log(`    Data da consulta: "${dataConsulta?.text}"`);
  console.log(`    Updated: ${item.updated_at}`);
});
