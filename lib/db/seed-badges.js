import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, "../../.env");

if (fs.existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in your .env file.");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const defaultBadges = [
  { key: "owner", label: "Owner", color: "#facc15", description: "Pemilik utama Arcadia Studio.", order: 1 },
  { key: "staff", label: "Staff", color: "#60a5fa", description: "Tim staff yang menjaga komunitas.", order: 2 },
  { key: "dev", label: "Dev", color: "#a78bfa", description: "Developer fitur dan sistem server.", order: 3 },
  { key: "website_developer", label: "Website Developer", color: "#34d399", description: "Developer website Arcadia.", order: 4 },
  { key: "admin", label: "Admin", color: "#f87171", description: "Admin komunitas.", order: 5 },
  { key: "builder", label: "Builder", color: "#fb923c", description: "Builder map dan dunia roleplay.", order: 6 },
  { key: "support", label: "Support", color: "#22d3ee", description: "Tim support pemain.", order: 7 },
];

async function seedBadges() {
  try {
    for (const badge of defaultBadges) {
      await pool.query(
        `INSERT INTO badges (key, label, color, description, "order", created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (key) DO UPDATE SET
           label = EXCLUDED.label,
           color = EXCLUDED.color,
           description = EXCLUDED.description,
           "order" = EXCLUDED."order",
           updated_at = NOW()`,
        [badge.key, badge.label, badge.color, badge.description, badge.order],
      );
    }

    console.log(`Seeded ${defaultBadges.length} default badges.`);
  } finally {
    await pool.end();
  }
}

seedBadges().catch((error) => {
  console.error("Failed to seed badges:", error);
  process.exitCode = 1;
});
