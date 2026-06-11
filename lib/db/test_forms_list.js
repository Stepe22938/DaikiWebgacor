import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('../../.env');
const env = fs.readFileSync(envPath, 'utf8');
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const connectionString = match ? match[1] : null;

if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function run() {
  try {
    const formsRes = await pool.query("SELECT * FROM forms WHERE status = 'open' ORDER BY created_at DESC");
    console.log("OPEN FORMS:");
    console.log(JSON.stringify(formsRes.rows, null, 2));

    const fieldsRes = await pool.query("SELECT * FROM form_fields ORDER BY \"order\" ASC");
    console.log("ALL FORM FIELDS:");
    console.log(JSON.stringify(fieldsRes.rows, null, 2));

    await pool.end();
  } catch (err) {
    console.error(err);
    await pool.end();
  }
}

run();
