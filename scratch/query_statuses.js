const pg = require("pg");
require("dotenv").config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM statuses");
    console.log("STATUSES:", JSON.stringify(res.rows, null, 2));

    const users = await pool.query("SELECT id, username FROM users LIMIT 10");
    console.log("USERS:", JSON.stringify(users.rows, null, 2));

    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

check();
