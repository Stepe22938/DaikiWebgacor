import pg from 'pg';
import path from 'path';
import fs from 'fs';

const rootEnvPath = './.env';
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
  const res = await pool.query('SELECT id, clerk_id, username, display_name, role, mc_username FROM users;');
  console.log(JSON.stringify(res.rows, null, 2));
} catch (err) {
  console.error("Query failed:", err);
} finally {
  await pool.end();
}
