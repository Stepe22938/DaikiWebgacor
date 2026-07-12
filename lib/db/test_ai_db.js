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
  const res = await pool.query(
    "SELECT id, sender_id, content, created_at FROM messages WHERE conversation_id = 26 ORDER BY id DESC LIMIT 5;"
  );
  console.log("LATEST MESSAGES IN CONV 26:", res.rows);
} catch (err) {
  console.error("DIAGNOSTIC ERROR DETAILS:", err);
} finally {
  await pool.end();
}
