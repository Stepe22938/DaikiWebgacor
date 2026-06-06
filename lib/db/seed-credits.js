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

const defaultCredits = [
  {
    name: "Arcadia Studio",
    role: "Founder",
    description: "Tim utama yang membangun arah server, komunitas, dan pengalaman roleplay Arcadia.",
    borderType: "frame1",
    order: 1,
  },
  {
    name: "Development Team",
    role: "Developer",
    description: "Mengurus website, sistem database, fitur member area, dan integrasi server.",
    borderType: "frame2",
    order: 2,
  },
  {
    name: "Moderator Team",
    role: "Moderator",
    description: "Menjaga komunitas tetap nyaman, membantu ticket, dan mengatur aktivitas roleplay.",
    borderType: "frame3",
    order: 3,
  },
];

async function seedCredits() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM credits");
    if ((rows[0]?.count ?? 0) > 0) {
      console.log("Credits table already has data. Skipping seed.");
      return;
    }

    for (const credit of defaultCredits) {
      await pool.query(
        `INSERT INTO credits (name, role, description, border_type, "order", created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [credit.name, credit.role, credit.description, credit.borderType, credit.order],
      );
    }

    console.log(`Inserted ${defaultCredits.length} default credits.`);
  } finally {
    await pool.end();
  }
}

seedCredits().catch((error) => {
  console.error("Failed to seed credits:", error);
  process.exitCode = 1;
});
