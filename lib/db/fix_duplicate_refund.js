import pg from "pg";
import path from "path";
import fs from "fs";

// Load .env from root
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

async function main() {
  try {
    // Check current setting
    const { rows } = await pool.query("SELECT key, value FROM system_settings WHERE key = 'gacha_settings'");
    if (rows.length === 0) {
      console.log("No gacha_settings row in DB. Default code setting (duplicateRefund=5) will apply.");
    } else {
      const current = rows[0].value;
      console.log("Current gacha_settings:", JSON.stringify(current, null, 2));

      const patched = { ...current, duplicateRefund: 5 };
      await pool.query(
        "UPDATE system_settings SET value = $1::jsonb WHERE key = 'gacha_settings'",
        [JSON.stringify(patched)]
      );
      console.log("SUCCESS: duplicateRefund updated to 5 in database!");
      console.log("New gacha_settings:", JSON.stringify(patched, null, 2));
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
