const pg = require("pg");
require("dotenv").config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query("SELECT * FROM statuses");
    console.log("ALL STATUSES IN DB:", res.rows);
    
    const now = new Date();
    console.log("NODE NOW:", now);
    
    const dbTime = await pool.query("SELECT NOW() as db_now");
    console.log("DB NOW:", dbTime.rows[0].db_now);

    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

run();
