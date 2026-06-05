import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from workspace root
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in your .env file!");
}

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });

async function seed() {
  console.log("Seeding database...");
  try {
    // Clean existing data
    await pool.query("TRUNCATE TABLE developments, announcements, follows, conversation_members, messages, conversations, users CASCADE;");
    console.log("Cleared existing database tables.");

    // 1. Insert Developments (Roadmap)
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

    for (const dev of developments) {
      await pool.query(
        `INSERT INTO developments (title, description, category, status, progress, icon_name, "order", created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [dev.title, dev.description, dev.category, dev.status, dev.progress, dev.iconName, dev.order]
      );
    }
    console.log("Inserted mock developments.");

    // 2. Insert Announcements
    const announcements = [
      {
        title: "Selamat Datang di Arcadia Studio!",
        content: "Halo para petualang! Arcadia Server resmi memasuki tahap pengembangan Alpha. Kami mengundang kalian untuk mendaftar dan memantau perkembangan server melalui roadmap di website ini. Jangan ragu untuk memberikan saran dan kritik melalui Discord kami!",
        type: "general",
        pinned: true,
        authorName: "Admin Arcadia"
      },
      {
        title: "Pembaruan Sistem Pekerjaan (Roleplay Jobs)",
        content: "Kami baru saja mengupdate sistem pekerjaan di server. Sekarang gaji pekerjaan akan otomatis ditransfer ke rekening bank pribadi kalian setiap jam bermain (Payday). Silakan cek panduan di member area untuk detail gaji masing-masing pekerjaan.",
        type: "update",
        pinned: false,
        authorName: "Dev Arcadia"
      },
      {
        title: "Maintenance Database & Optimalisasi Server",
        content: "Kami akan melakukan pemeliharaan database terjadwal malam ini pukul 23:00 WIB untuk meningkatkan performa sinkronisasi data pemain. Server web mungkin tidak dapat diakses selama kurang lebih 10 menit. Terima kasih atas pengertiannya.",
        type: "maintenance",
        pinned: false,
        authorName: "System"
      }
    ];

    for (const ann of announcements) {
      await pool.query(
        `INSERT INTO announcements (title, content, type, pinned, author_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [ann.title, ann.content, ann.type, ann.pinned, ann.authorName]
      );
    }
    console.log("Inserted mock announcements.");

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await pool.end();
  }
}

seed();
