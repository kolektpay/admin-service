const { Client } = require('pg');

const connectionString = "postgresql://admin:NewStrongPassword123!@72.62.132.213:5434/kolekt_db?schema=public";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query('DELETE FROM _prisma_migrations WHERE migration_name = $1', ['20260625220716_init']);
  console.log('Deleted init from _prisma_migrations');
  await client.end();
}

main().catch(console.error);
