import mysql from 'mysql2/promise';
import axios from 'axios';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tokenRows] = await conn.execute('SELECT value FROM system_settings WHERE `key` = "monday_api_token"');
const token = tokenRows[0]?.value;
await conn.end();

const query = `
  query {
    boards(ids: [7171531533]) {
      items_page(limit: 10) {
        cursor
        items {
          id
          name
        }
      }
    }
  }
`;

const resp = await axios.post('https://api.monday.com/v2', { query }, {
  headers: { Authorization: token, 'Content-Type': 'application/json' }
});

console.log(JSON.stringify(resp.data, null, 2));
