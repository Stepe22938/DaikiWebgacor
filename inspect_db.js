const pg = require("pg");
require("dotenv").config(); // Load environment variables

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const forms = await pool.query("SELECT * FROM forms");
    console.log("FORMS:", JSON.stringify(forms.rows, null, 2));

    const fields = await pool.query("SELECT * FROM form_fields");
    console.log("FIELDS:", JSON.stringify(fields.rows, null, 2));
    
    await pool.end();
  } catch (err) {
    console.error("DB ERROR:", err);
    await pool.end();
  }
}

check();
