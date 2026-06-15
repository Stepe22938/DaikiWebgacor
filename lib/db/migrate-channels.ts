import pg from "pg";
import path from "path";
import fs from "fs";

const { Pool } = pg;

// Load .env from workspace root
const rootEnvPath = path.resolve(import.meta.dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set!");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log("Starting backward compatibility migration...\n");

  // Get all groups that don't have any channels
  const groups = await pool.query(`
    SELECT c.id, c.name 
    FROM conversations c 
    WHERE c.type = 'group' 
    AND NOT EXISTS (
      SELECT 1 FROM channels ch WHERE ch.conversation_id = c.id
    )
  `);

  console.log(`Found ${groups.rows.length} groups without channels.`);

  for (const group of groups.rows) {
    await pool.query(`
      INSERT INTO channels (conversation_id, name, type, position, created_at)
      VALUES ($1, 'general', 'text', 0, NOW())
    `, [group.id]);
    console.log(`  Created #general for group "${group.name}" (id: ${group.id})`);

    // Assign existing messages to the new #general channel
    const channel = await pool.query(`
      SELECT id FROM channels WHERE conversation_id = $1 AND name = 'general'
    `, [group.id]);
    
    if (channel.rows.length > 0) {
      const result = await pool.query(`
        UPDATE messages 
        SET channel_id = $1 
        WHERE conversation_id = $2 AND channel_id IS NULL
      `, [channel.rows[0].id, group.id]);
      console.log(`  Assigned ${result.rowCount} existing messages to #general`);
    }
  }

  console.log("\nMigration complete!");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  pool.end();
  process.exit(1);
});
