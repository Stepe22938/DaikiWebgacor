const pg = require('pg');
require('dotenv').config();

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
  try {
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in DB:", tablesRes.rows.map(r => r.table_name));

    const devsRes = await pool.query('SELECT * FROM developments');
    console.log("Developments count:", devsRes.rows.length);
    console.log("Developments:", devsRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
