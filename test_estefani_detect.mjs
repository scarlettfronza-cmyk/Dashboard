import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT `value` FROM system_settings WHERE `key` = "monday_api_token"');
const token = rows[0]?.value;
await conn.end();

// Get board schema
const query = `{
  boards(ids: [18406699335]) {
    columns { id title type }
  }
}`;

const resp = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': token },
  body: JSON.stringify({ query })
});
const data = await resp.json();
const columns = data.data?.boards?.[0]?.columns || [];

console.log('Board columns:');
columns.forEach(c => console.log(`  ${c.id} | "${c.title}" | ${c.type}`));

// Simulate detectColumnMap
const map = { format: 'A' };
for (const col of columns) {
  const title = col.title.toLowerCase().trim();
  console.log(`\nProcessing: "${col.title}" (title="${title}", type=${col.type})`);
  
  // consultDate detection
  let consultPriority = 0;
  if (title === "data de conversao" || title === "data de conversão" || title === "data conversao" || title === "data conversão") {
    consultPriority = 3;
  } else if (title === "data da consulta" || title === "data consulta" || title === "data de consulta" || title === "data da avaliação" || title === "data da avaliacao" || title === "data avaliação" || title === "data avaliacao") {
    consultPriority = 2;
  } else if (title === "data") {
    consultPriority = 1;
  }
  
  if (consultPriority > 0) {
    console.log(`  → consultPriority=${consultPriority}, current=${map.consultDatePriority ?? 0}`);
    if (consultPriority >= (map.consultDatePriority ?? 0)) {
      map.consultDateId = col.id;
      map.consultDatePriority = consultPriority;
      console.log(`  → SET consultDateId = ${col.id}`);
    } else {
      console.log(`  → SKIPPED (lower priority)`);
    }
  }
}

console.log('\n=== RESULT ===');
console.log('consultDateId:', map.consultDateId);
console.log('consultDatePriority:', map.consultDatePriority);
