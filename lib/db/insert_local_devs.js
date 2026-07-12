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

const developments = [
  {
    title: "Setup Lobby & Spawn Area",
    description: "Membangun area spawn utama dan lobby server dengan tema kerajaan abad pertengahan yang megah.",
    category: "Server",
    status: "completed",
    progress: 100,
    iconName: "Home",
    order: 1
  },
  {
    title: "Custom Roleplay Jobs System",
    description: "Mengintegrasikan sistem pekerjaan custom (Petani, Penambang, Polisi, Dokter) dengan sistem gaji dinamis dan kenaikan pangkat.",
    category: "Plugin",
    status: "in_progress",
    progress: 75,
    iconName: "Briefcase",
    order: 2
  },
  {
    title: "Website Portal & Member Area",
    description: "Membangun website resmi dengan forum diskusi, sistem pengumuman, visualisasi roadmap, dan integrasi Clerk Auth.",
    category: "Web",
    status: "completed",
    progress: 100,
    iconName: "Globe",
    order: 3
  },
  {
    title: "Custom Voice Chat Integration",
    description: "Mengintegrasikan plugin Proximity Voice Chat (Plasmo Voice) untuk komunikasi suara 3D realistis di dalam game.",
    category: "Server",
    status: "planned",
    progress: 0,
    iconName: "Mic",
    order: 4
  },
  {
    title: "Economy & Banking System",
    description: "Menyediakan bank fisik, mesin ATM fungsional, dan kartu debit untuk transaksi uang digital antar player di server.",
    category: "Plugin",
    status: "in_progress",
    progress: 40,
    iconName: "Coins",
    order: 5
  }
];

async function insertDevs() {
  try {
    console.log("Checking and inserting local developments into the database...");
    
    for (const dev of developments) {
      // Check if it already exists by title
      const checkRes = await pool.query("SELECT id FROM developments WHERE title = $1", [dev.title]);
      if (checkRes.rows.length > 0) {
        console.log(`Development "${dev.title}" already exists. Skipping.`);
        continue;
      }
      
      // Insert if it doesn't exist
      await pool.query(
        `INSERT INTO developments (title, description, category, status, progress, icon_name, "order", created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [dev.title, dev.description, dev.category, dev.status, dev.progress, dev.iconName, dev.order]
      );
      console.log(`Inserted development: "${dev.title}"`);
    }
    
    console.log("Done checking/inserting developments.");
  } catch (err) {
    console.error("Error inserting developments:", err);
  } finally {
    await pool.end();
  }
}

insertDevs();
