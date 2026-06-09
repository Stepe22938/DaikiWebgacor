import pg from "pg";
import path from "path";
import fs from "fs";

const rootEnvPath = path.resolve(import.meta.dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(rootEnvPath);
  } else {
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

const newSettings = {
  realmName: "Daiki Web Gacor",
  realmLogoUrl: "",
  heroTitle: "Arcadia Studio",
  heroSubtitle: "Studio Made A Minecraft Roleplay",
  serverIP: "None",
  mcVersion: "none",
  specsCpu: "none",
  specsMemory: "none",
  specsStorage: "none",
  specsLocation: "none"
};

async function update() {
  try {
    const res = await pool.query(
      "UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = 'homepage_settings' RETURNING *",
      [JSON.stringify(newSettings)]
    );
    console.log("UPDATE SUCCESS:", JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    await pool.end();
  }
}

update();
