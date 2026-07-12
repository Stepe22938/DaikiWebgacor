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

async function check() {
  try {
    // Check users with display name "Arkan Alrizal"
    const r1 = await pool.query(
      "SELECT id, username, display_name, youtube_live_url FROM users WHERE display_name ILIKE '%arkan%' OR username ILIKE '%arkan%'"
    );
    console.log("User 'Arkan Alrizal':", JSON.stringify(r1.rows, null, 2));

    // Check all users with display_name
    const r2 = await pool.query(
      "SELECT id, username, display_name, youtube_live_url FROM users WHERE display_name IS NOT NULL LIMIT 15"
    );
    console.log("Users with display_name:", JSON.stringify(r2.rows, null, 2));

    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

check();
