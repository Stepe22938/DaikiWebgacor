import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  console.log("Migrating to Token Royal Spin-Based System...");
  try {
    // 1. Drop old tables if they exist
    await pool.query(`DROP TABLE IF EXISTS user_token_progress CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS token_royal_prizes CASCADE;`);
    console.log("✓ Cleaned up old tables");

    // 2. Create token_royal_slots (5 reward slots per event)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_royal_slots (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 5),
        reward_name VARCHAR(255) NOT NULL,
        reward_description TEXT,
        reward_image_url TEXT,
        is_grand_prize BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE(event_id, slot_number)
      );
    `);
    console.log("✓ token_royal_slots table created");

    // 3. Create user_token_royal_progress (track which slots user completed)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_token_royal_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        completed_slots INTEGER[] DEFAULT ARRAY[]::INTEGER[],
        shark_discount_count INTEGER NOT NULL DEFAULT 0,
        total_spins INTEGER NOT NULL DEFAULT 0,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, event_id)
      );
    `);
    console.log("✓ user_token_royal_progress table created");

    // 4. Create token_royal_spin_results (log setiap spin result)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_royal_spin_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        result_type VARCHAR(20) NOT NULL,
        slot_number INTEGER,
        is_shark BOOLEAN NOT NULL DEFAULT FALSE,
        reward_name VARCHAR(255),
        diamonds_spent INTEGER NOT NULL,
        discount_applied INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ token_royal_spin_results table created");

    console.log("\n✅ Token Royal v2 (Spin-Based) migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
