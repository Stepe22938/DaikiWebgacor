import pg from "pg";
import path from "path";
import fs from "fs";

const rootEnvPath = path.resolve(import.meta.dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(rootEnvPath);
  } else {
    const content = fs.readFileSync(rootEnvPath, "utf8");
    content.split("\n").forEach(line => {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        if (key && !key.startsWith("#")) process.env[key] = val;
      }
    });
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_GACHA_SETTINGS = {
  spinCost1: 9,
  spinCost10: 79,
  spinCost25: 195,
  spinCost50: 390,
  duplicateRefund: 5,
  rateS: 1.5,
  rateA: 8.0,
  rateB: 25.0,
  rateC: 60.0,
};

async function main() {
  try {
    // 1. Reset all diamonds to 0
    const result = await pool.query("UPDATE users SET diamonds = 0");
    console.log(`✅ Reset diamonds to 0 for ${result.rowCount} users.`);

    // 2. Save gacha settings to DB (upsert)
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('gacha_settings', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(DEFAULT_GACHA_SETTINGS)]
    );
    console.log("✅ Gacha settings saved to database:", JSON.stringify(DEFAULT_GACHA_SETTINGS, null, 2));

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
