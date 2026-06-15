const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://daiki:phantomichostjaya@185.128.227.237:5433/daikiweb'
});

async function run() {
  try {
    const members = await pool.query('SELECT * FROM conversation_members WHERE conversation_id = 9');
    console.log('Conversation Members (convId=9):', members.rows);
    
    const memberRoles = await pool.query('SELECT * FROM member_roles');
    console.log('All Member Roles in DB:', memberRoles.rows);

    const roles = await pool.query('SELECT * FROM roles WHERE conversation_id = 9');
    console.log('Roles for Conversation 9:', roles.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
