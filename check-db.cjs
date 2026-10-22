const { Client } = require('pg');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  }
}

const client = new Client({ connectionString: dbUrl });
client.connect().then(async () => {
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Project'");
  console.log('Columns in Project table:', res.rows.map(r => r.column_name));
  
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const jobsRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'IndexingJob'");
  console.log('Columns in IndexingJob table:', jobsRes.rows.map(r => r.column_name));

  await client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
