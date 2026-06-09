const pg = require("pg");
require("dotenv").config(); // Load environment variables

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM system_settings WHERE key = 'homepage_settings'");
    console.log("DB RESULT:", JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

check();
