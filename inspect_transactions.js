const pg = require("pg");
require("dotenv").config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const txs = await pool.query("SELECT * FROM wallet_transactions ORDER BY id DESC LIMIT 20");
    console.log("LAST 20 TRANSACTIONS:", JSON.stringify(txs.rows, null, 2));

    const userCosmetics = await pool.query("SELECT * FROM user_cosmetics LIMIT 50");
    console.log("USER COSMETICS COUNT:", userCosmetics.rows.length);

    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

check();
