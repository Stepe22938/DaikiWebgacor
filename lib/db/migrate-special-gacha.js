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
  console.log("Creating special_gacha tables...");
  try {
    // 1. Create special_gacha_events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS special_gacha_events (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        video_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        cost_per_token INTEGER,
        starting_bid INTEGER,
        min_bid_increment INTEGER,
        ends_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ special_gacha_events table created");

    // 2. Create token_royal_prizes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_royal_prizes (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        token_position INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        image_url TEXT
      );
    `);
    console.log("✓ token_royal_prizes table created");

    // 3. Create user_token_progress table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_token_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        tokens_collected INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP,
        UNIQUE(user_id, event_id)
      );
    `);
    console.log("✓ user_token_progress table created");

    // 4. Create bidding_entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bidding_entries (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        placed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ bidding_entries table created");

    // 5. Create title_numbers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS title_numbers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES special_gacha_events(id) ON DELETE CASCADE,
        title_no VARCHAR(10) NOT NULL UNIQUE,
        awarded_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ title_numbers table created");

    console.log("\n✅ All special_gacha tables created successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
