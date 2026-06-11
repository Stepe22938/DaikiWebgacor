import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from workspace root
const rootEnvPath = path.resolve(__dirname, "../../.env");
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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in your .env file!");
}

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });

const cosmeticsList = [
  // === BADGES (10 items) ===
  {
    name: "Gacha God 👑",
    type: "badge",
    rarity: "S",
    value: "bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white font-extrabold shadow-lg animate-pulse border border-red-300",
    description: "Untuk mereka yang diberkati keberuntungan tak terbatas oleh Dewa Gacha."
  },
  {
    name: "Arcadia Emperor 🏰",
    type: "badge",
    rarity: "S",
    value: "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black shadow-xl border border-indigo-200",
    description: "Gelar tertinggi kebangsawanan di alam semesta Arcadia."
  },
  {
    name: "Rich Citizen 💎",
    type: "badge",
    rarity: "A",
    value: "bg-sky-500 text-white font-extrabold border border-sky-300 shadow-sm",
    description: "Warga elit dengan kekayaan melimpah."
  },
  {
    name: "Server Helper 🛠️",
    type: "badge",
    rarity: "A",
    value: "bg-teal-700 text-teal-100 font-extrabold border border-teal-400",
    description: "Tanda kehormatan bagi asisten pembangun realm."
  },
  {
    name: "Guild Veteran ⚔️",
    type: "badge",
    rarity: "B",
    value: "bg-indigo-500 text-white font-bold",
    description: "Pejuang berpengalaman yang setia melayani Guild."
  },
  {
    name: "Bounty Hunter 🏹",
    type: "badge",
    rarity: "B",
    value: "bg-amber-700 text-white font-bold",
    description: "Memburu target demi koin dan ketenaran."
  },
  {
    name: "Active Player 🏃",
    type: "badge",
    rarity: "C",
    value: "bg-emerald-500 text-white font-bold",
    description: "Pemain rajin yang selalu hadir di realm."
  },
  {
    name: "Chatterbox 💬",
    type: "badge",
    rarity: "C",
    value: "bg-cyan-500 text-white font-bold",
    description: "Selalu meramaikan percakapan di lobi."
  },
  {
    name: "Rookie Player 🥚",
    type: "badge",
    rarity: "D",
    value: "bg-slate-400 text-slate-100 font-semibold",
    description: "Pendatang baru yang sedang memulai petualangan."
  },
  {
    name: "Newbie 🍃",
    type: "badge",
    rarity: "D",
    value: "bg-slate-300 text-slate-700 font-semibold",
    description: "Pemain baru di dunia Arcadia."
  },

  // === BORDERS (10 items) ===
  {
    name: "Golden Aura",
    type: "border",
    rarity: "S",
    value: "ring-4 ring-yellow-400 shadow-[0_0_15px_#facc15] animate-pulse",
    description: "Border emas murni yang bercahaya dan sangat megah."
  },
  {
    name: "Rainbow Pulsar",
    type: "border",
    rarity: "S",
    value: "ring-4 ring-[#6d5dfc] shadow-[0_0_15px_#6d5dfc] animate-bounce",
    description: "Border kosmik berwarna ungu neon yang berdenyut aktif."
  },
  {
    name: "Cyber Punk Glow",
    type: "border",
    rarity: "A",
    value: "ring-4 ring-pink-500 shadow-[0_0_10px_#ec4899]",
    description: "Sinar neon pink futuristik untuk profil modern."
  },
  {
    name: "Eldritch Purple",
    type: "border",
    rarity: "A",
    value: "ring-4 ring-purple-600 shadow-[0_0_10px_#9333ea]",
    description: "Energi sihir ungu kuno yang mengelilingi avatar."
  },
  {
    name: "Royal Blue Border",
    type: "border",
    rarity: "B",
    value: "ring-3 ring-blue-500 shadow-[0_0_6px_#3b82f6]",
    description: "Lambang kehormatan ksatria kerajaan biru."
  },
  {
    name: "Emerald Shield",
    type: "border",
    rarity: "B",
    value: "ring-3 ring-emerald-500",
    description: "Border hijau batu zamrud pelindung."
  },
  {
    name: "Classic Steel",
    type: "border",
    rarity: "C",
    value: "ring-2 ring-slate-400",
    description: "Border baja klasik yang kokoh."
  },
  {
    name: "Bronze Ring",
    type: "border",
    rarity: "C",
    value: "ring-2 ring-amber-700",
    description: "Border perunggu sederhana dari hasil kerja keras."
  },
  {
    name: "Simple Outline",
    type: "border",
    rarity: "D",
    value: "ring-1 ring-slate-200",
    description: "Border tipis abu-abu minimalis."
  },
  {
    name: "Dark Border",
    type: "border",
    rarity: "D",
    value: "ring-1 ring-slate-800",
    description: "Border gelap hitam polos."
  },

  // === BACKGROUNDS (9 items) ===
  {
    name: "Nebula Vortex",
    type: "background",
    rarity: "S",
    value: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=800",
    description: "Bintang-bintang dan debu galaksi nebula kosmik."
  },
  {
    name: "Abyssal Rift",
    type: "background",
    rarity: "S",
    value: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800",
    description: "Seni ombak abstrak berwarna neon gelap premium."
  },
  {
    name: "Cyber Grid",
    type: "background",
    rarity: "A",
    value: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800",
    description: "Kisi-kisi futuristik bercahaya ungu dan biru."
  },
  {
    name: "Crimson Sunset",
    type: "background",
    rarity: "A",
    value: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=800",
    description: "Gradasi warna matahari terbenam yang dramatis."
  },
  {
    name: "Ocean Deep Backdrop",
    type: "background",
    rarity: "B",
    value: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=800",
    description: "Kedalaman air samudra biru yang tenang."
  },
  {
    name: "Forest Mist Backdrop",
    type: "background",
    rarity: "B",
    value: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=800",
    description: "Pemandangan hutan pinus berkabut di pagi hari."
  },
  {
    name: "Slate Stone Backdrop",
    type: "background",
    rarity: "C",
    value: "https://images.unsplash.com/photo-1533038590840-1cde6b66b72d?q=80&w=800",
    description: "Tekstur batu abu-abu abu minimalis yang rapi."
  },
  {
    name: "Clean Gradient Backdrop",
    type: "background",
    rarity: "D",
    value: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=800",
    description: "Gradasi warna pastel yang sederhana dan bersih."
  }
];

async function seed() {
  console.log("Seeding cosmetics...");
  try {
    // Check table exists
    const checkTable = await pool.query("SELECT to_regclass('public.cosmetics');");
    if (!checkTable.rows[0].to_regclass) {
      console.error("Cosmetics table does not exist yet! Run push first.");
      process.exit(1);
    }

    // Clean existing cosmetics
    await pool.query("TRUNCATE TABLE user_cosmetics, cosmetics CASCADE;");
    console.log("Cleared existing cosmetics tables.");

    for (const c of cosmeticsList) {
      await pool.query(
        `INSERT INTO cosmetics (name, type, rarity, value, description, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [c.name, c.type, c.rarity, c.value, c.description]
      );
    }
    console.log(`Successfully seeded ${cosmeticsList.length} cosmetics!`);
  } catch (err) {
    console.error("Error seeding cosmetics:", err);
  } finally {
    await pool.end();
  }
}

seed();
