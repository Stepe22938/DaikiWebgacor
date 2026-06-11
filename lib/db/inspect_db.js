import pg from "pg";
import path from "path";
import fs from "fs";

// Load from root .env using process.loadEnvFile if available, else standard load
const rootEnvPath = path.resolve(import.meta.dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(rootEnvPath);
  } else {
    // Basic fallback parsing
    const content = fs.readFileSync(rootEnvPath, "utf8");
    content.split("\n").forEach(line => {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        if (key && !key.startsWith("#")) {
          process.env[key] = val;
        }
      }
    });
  }
}

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
