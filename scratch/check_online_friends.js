const pg = require("pg");
const path = require("path");
const fs = require("fs");

const rootEnvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(rootEnvPath)) {
  require("dotenv").config({ path: rootEnvPath });
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
