const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://daiki:phantomichostjaya@185.128.227.237:5433/daikiweb'
});

async function run() {
  console.log("Adding last_read_at column to conversation_members...");
  try {
    await pool.query(`
      ALTER TABLE conversation_members 
      ADD COLUMN IF NOT EXISTS last_read_at timestamp NOT NULL DEFAULT now();
    `);
    console.log("Success!");
  } catch (err) {
    console.error("Failed to add column:", err);
  } finally {
    pool.end();
  }
}

run();
