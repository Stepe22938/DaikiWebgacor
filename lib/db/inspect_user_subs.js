const pg = require('pg');
const fs = require("fs");
const path = require("path");

// Manually parse .env from the root directory
const envPath = path.join(__dirname, "../../.env");
if (!fs.existsSync(envPath)) {
  console.error(`Error: .env file not found at ${envPath}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
if (!dbUrlMatch) {
  console.error("Error: DATABASE_URL not found in .env file");
  process.exit(1);
}

const connectionString = dbUrlMatch[1];
const pool = new pg.Pool({ connectionString });

async function run() {
  try {
    // Find the user Arkan Alrizal
    const userRes = await pool.query("SELECT id, clerk_id, username, display_name, role, diamonds FROM users WHERE display_name ILIKE '%Arkan%' OR username ILIKE '%Arkan%'");
    console.log('=== User Info ===');
    console.log(userRes.rows);

    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].id;
      // Get subscriptions
      const subsRes = await pool.query("SELECT * FROM user_tier_subscriptions WHERE user_id = $1 ORDER BY starts_at DESC", [userId]);
      console.log('=== Subscriptions ===');
      console.log(subsRes.rows);

      // Get transactions
      const txRes = await pool.query("SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5", [userId]);
      console.log('=== Recent Transactions ===');
      console.log(txRes.rows);
    }

    // Get all shop items of type premium / premium_plus
    const shopRes = await pool.query("SELECT id, name, type, value, price, is_shop FROM cosmetics WHERE type IN ('premium', 'premium_plus')");
    console.log('=== Premium Shop Items ===');
    console.log(shopRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
