import pg from "pg";
import path from "node:path";
import fs from "node:fs";

const rootEnvPath = path.resolve(import.meta.dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const cosmetics = await pool.query("SELECT * FROM cosmetics");
    console.log("COSMETICS IN DB:", cosmetics.rows.length);
    console.log(cosmetics.rows.map(c => `${c.name} (${c.rarity})`));

    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

check();
