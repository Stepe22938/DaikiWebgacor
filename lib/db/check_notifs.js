const pg = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../../.env");
if (!fs.existsSync(envPath)) {
  console.error("Error: .env not found at " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
if (!dbUrlMatch) {
  console.error("Error: DATABASE_URL not found in .env");
  process.exit(1);
}

const connectionString = dbUrlMatch[1];
const pool = new pg.Pool({ connectionString });

pool.query("SELECT * FROM notifications ORDER BY id DESC LIMIT 10", (err, res) => {
  if (err) {
    console.error("DB Query Error:", err);
  } else {
    console.log("Recent notifications:");
    console.log(JSON.stringify(res.rows, null, 2));
  }
  pool.end();
});
