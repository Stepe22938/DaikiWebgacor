import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  // Simple env parser
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
    // 1. Get all users
    const usersRes = await pool.query("SELECT id, username, display_name, last_seen_at, hide_online_status FROM users");
    console.log("--- ALL USERS IN DB ---");
    console.table(usersRes.rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      lastSeenAt: r.last_seen_at,
      hideOnlineStatus: r.hide_online_status,
      isOnline: r.last_seen_at ? (Date.now() - new Date(r.last_seen_at).getTime() <= 45000) : false
    })));

    // 2. Get follows table
    const followsRes = await pool.query("SELECT follower_id, following_id FROM follows");
    console.log("\n--- ALL FOLLOWS IN DB ---");
    console.table(followsRes.rows);

  } catch (err) {
    console.error("ERROR running check:", err.stack);
  } finally {
    await pool.end();
  }
}

run();
