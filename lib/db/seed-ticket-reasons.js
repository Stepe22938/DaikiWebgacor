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

const defaultReasons = [
  { label: "Nickname Minecraft", description: "Bantuan atau perubahan nickname Minecraft.", order: 1 },
  { label: "Instagram", description: "Masalah atau request terkait akun Instagram.", order: 2 },
  { label: "YouTube", description: "Masalah atau request terkait channel/link YouTube.", order: 3 },
  { label: "Google", description: "Masalah login atau akun Google.", order: 4 },
  { label: "Ditembak ga sengaja", description: "Laporan insiden tertembak tidak sengaja.", order: 5 },
  { label: "OOC ga sengaja", description: "Laporan kejadian OOC tidak sengaja.", order: 6 },
  { label: "Lainnya", description: "Alasan lain, tulis detail di deskripsi.", order: 7 },
];

async function seedTicketReasons() {
  try {
    for (const reason of defaultReasons) {
      await pool.query(
        `INSERT INTO ticket_reasons (label, description, is_active, "order", created_at, updated_at)
         VALUES ($1, $2, true, $3, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [reason.label, reason.description, reason.order],
      );
    }

    console.log(`Seeded ${defaultReasons.length} default ticket reasons.`);
  } finally {
    await pool.end();
  }
}

seedTicketReasons().catch((error) => {
  console.error("Failed to seed ticket reasons:", error);
  process.exitCode = 1;
});
