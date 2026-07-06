import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const now = new Date();
    // Update Steve Steve (id 3) and Dai (id 11)
    await pool.query("UPDATE users SET last_seen_at = $1 WHERE id IN (3, 11)", [now]);
    console.log("Successfully updated Steve Steve (id 3) and Dai (id 11) to be ONLINE (last_seen_at = now).");
  } catch (err) {
    console.error("Error mocking online status:", err);
  } finally {
    await pool.end();
  }
}

run();
