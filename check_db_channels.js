const pg = require("pg");
require("dotenv").config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const conversations = await pool.query("SELECT * FROM conversations");
    console.log("CONVERSATIONS:", JSON.stringify(conversations.rows, null, 2));

    const categories = await pool.query("SELECT * FROM channel_categories");
    console.log("CATEGORIES:", JSON.stringify(categories.rows, null, 2));

    const channels = await pool.query("SELECT * FROM channels");
    console.log("CHANNELS:", JSON.stringify(channels.rows, null, 2));

    const members = await pool.query("SELECT * FROM conversation_members");
    console.log("MEMBERS:", JSON.stringify(members.rows, null, 2));

    const users = await pool.query("SELECT * FROM users");
    console.log("USERS:", JSON.stringify(users.rows.map(u => ({ id: u.id, username: u.username, clerkId: u.clerkId })), null, 2));
    
    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

check();
