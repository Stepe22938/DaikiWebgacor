const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://daiki:phantomichostjaya@185.128.227.237:5433/daikiweb'
});

async function run() {
  try {
    const conv = await pool.query('SELECT * FROM conversations WHERE id = 15');
    console.log('=== Conversation 15 ===');
    console.log(conv.rows);

    const users = await pool.query('SELECT id, clerk_id, username, email FROM users');
    console.log('=== Users ===');
    console.log(users.rows);

    const stickers = await pool.query('SELECT * FROM stickers WHERE conversation_id = 15');
    console.log('=== Stickers for Conversation 15 ===');
    console.log(stickers.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
