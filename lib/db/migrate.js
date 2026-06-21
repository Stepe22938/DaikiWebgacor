import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from workspace root
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in your .env file!");
}

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });

async function run() {
  console.log("Running direct PostgreSQL migration for conversations.invite_code...");
  try {
    // 1. Add column if it doesn't exist
    await pool.query(`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS invite_code VARCHAR(50);
    `);
    console.log("Column invite_code added or already exists.");

    // 2. Add unique constraint if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations 
        ADD CONSTRAINT conversations_invite_code_unique UNIQUE (invite_code);
      `);
      console.log("Unique constraint conversations_invite_code_unique added.");
    } catch (err) {
      if (err.message && err.message.includes("already exists")) {
        console.log("Unique constraint already exists.");
      } else {
        throw err;
      }
    }
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

run();
