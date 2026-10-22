const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Project'");
  console.log('Columns in Project table:', res.rows.map(r => r.column_name));
  
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const jobsRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'IndexingJob'");
  console.log('Columns in IndexingJob table:', jobsRes.rows.map(r => r.column_name));

  const wikiPages = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'WikiPage'");
  console.log('Columns in WikiPage table:', wikiPages.rows.map(r => r.column_name));

  await client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
