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
  console.log("Migrating to Custom Rewards System...");
  try {
    // 1. Drop old token royal specific tables
    await pool.query(`DROP TABLE IF EXISTS token_royal_spin_results CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS user_token_royal_progress CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS token_royal_slots CASCADE;`);
    console.log("✓ Dropped old token royal tables");

    // 2. Create event_rewards table (custom rewards for any event)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_rewards (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        reward_type VARCHAR(50) NOT NULL,
        reward_tier INTEGER NOT NULL,
        reward_name VARCHAR(255) NOT NULL,
        reward_description TEXT,
        reward_image_url TEXT,
        reward_quantity INTEGER NOT NULL DEFAULT 1,
        is_grand_prize BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(event_id, reward_tier, reward_type)
      );
    `);
    console.log("✓ event_rewards table created");

    // 3. Create user_event_reward_progress (track which rewards user collected)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_event_reward_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        collected_reward_ids INTEGER[] DEFAULT ARRAY[]::integer[],
        total_spins INTEGER NOT NULL DEFAULT 0,
        shark_count INTEGER NOT NULL DEFAULT 0,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, event_id)
      );
    `);
    console.log("✓ user_event_reward_progress table created");

    // 4. Create event_spin_results (audit log for all spins)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_spin_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        result_type VARCHAR(20) NOT NULL,
        reward_id INTEGER REFERENCES event_rewards(id) ON DELETE SET NULL,
        is_shark BOOLEAN NOT NULL DEFAULT FALSE,
        diamonds_spent INTEGER NOT NULL,
        discount_applied INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ event_spin_results table created");

    // 5. Add new columns to special_gacha_events for flexibility
    await pool.query(`
      ALTER TABLE special_gacha_events
      ADD COLUMN IF NOT EXISTS spin_cost INTEGER DEFAULT 50,
      ADD COLUMN IF NOT EXISTS shark_rate DECIMAL(5,2) DEFAULT 0.30,
      ADD COLUMN IF NOT EXISTS display_mode VARCHAR(50) DEFAULT 'tiles';
    `);
    console.log("✓ Added new columns to special_gacha_events");

    console.log("\n✅ Custom Rewards System migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
