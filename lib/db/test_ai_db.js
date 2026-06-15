import pg from 'pg';
import fs from 'fs';

const rootEnvPath = '../../.env';
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const conv = await pool.query("SELECT * FROM conversations WHERE id = 6;");
  console.log("Conversation 6:", JSON.stringify(conv.rows, null, 2));

  const members = await pool.query(
    "SELECT cm.*, u.username, u.display_name, u.role FROM conversation_members cm JOIN users u ON cm.user_id = u.id WHERE cm.conversation_id = 6;"
  );
  console.log("Members of Conv 6:", JSON.stringify(members.rows, null, 2));

  const metaAiUser = await pool.query("SELECT * FROM users WHERE username = 'metaai';");
  console.log("Meta AI User info:", JSON.stringify(metaAiUser.rows, null, 2));

  const messages = await pool.query("SELECT * FROM messages WHERE conversation_id = 6;");
  console.log("Messages in Conv 6:", JSON.stringify(messages.rows, null, 2));
} catch (err) {
  console.error("Query failed:", err);
} finally {
  await pool.end();
}
