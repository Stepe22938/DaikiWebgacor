import pg from "pg";
import path from "path";
import fs from "fs";

const rootEnvPath = "../../.env";
if (fs.existsSync(rootEnvPath)) {
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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    console.log("Database URL:", process.env.DATABASE_URL);
    
    const conversations = await pool.query("SELECT id, name, type, owner_id FROM conversations");
    console.log("Conversations:", JSON.stringify(conversations.rows, null, 2));

    const categories = await pool.query("SELECT id, name, conversation_id FROM channel_categories");
    console.log("Categories:", JSON.stringify(categories.rows, null, 2));

    const channels = await pool.query("SELECT id, name, type, conversation_id, category_id FROM channels");
    console.log("Channels:", JSON.stringify(channels.rows, null, 2));

    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

check();
