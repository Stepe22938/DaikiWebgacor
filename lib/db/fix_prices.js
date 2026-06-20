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
        if (key && !key.startsWith("#")) {
          process.env[key] = val;
        }
      }
    });
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  try {
    // 1. Read current settings
    const res = await pool.query("SELECT value FROM system_settings WHERE key = 'homepage_settings'");
    if (res.rows.length === 0) {
      console.error("No homepage_settings found!");
      await pool.end();
      return;
    }

    const current = res.rows[0].value;
    console.log("Current premiumPrice:", current.premiumPrice);
    console.log("Current premiumPlusPrice:", current.premiumPlusPrice);

    // 2. Merge with fixed prices
    const updated = {
      ...current,
      premiumPrice: 25000,
      premiumPlusPrice: 50000,
    };

    // 3. Write back
    const updateRes = await pool.query(
      "UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = 'homepage_settings' RETURNING *",
      [JSON.stringify(updated)]
    );

    console.log("\n✅ Updated successfully!");
    console.log("New premiumPrice:", updateRes.rows[0].value.premiumPrice);
    console.log("New premiumPlusPrice:", updateRes.rows[0].value.premiumPlusPrice);
    await pool.end();
  } catch (err) {
    console.error("ERROR:", err);
    await pool.end();
  }
}

fix();
