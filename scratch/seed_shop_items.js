const pg = require("pg");
require("dotenv").config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const items = [
  // Borders
  {
    name: "Neon Cyberpunk",
    type: "border",
    rarity: "A",
    value: "border-amber-500 shadow-[0_0_10px_#f59e0b] animate-pulse",
    description: "Bingkai futuristik dengan pendaran neon oranye yang berdetak.",
    price: 150,
    isGacha: false,
    isShop: true
  },
  {
    name: "Vampire Blood",
    type: "border",
    rarity: "S",
    value: "border-rose-600 shadow-[0_0_12px_#e11d48]",
    description: "Bingkai merah darah yang gelap dan memancarkan aura kegelapan.",
    price: 250,
    isGacha: false,
    isShop: true
  },
  {
    name: "Ocean Wave",
    type: "border",
    rarity: "B",
    value: "border-sky-400 shadow-[0_0_8px_#38bdf8]",
    description: "Bingkai biru laut yang menenangkan pikiran.",
    price: 100,
    isGacha: false,
    isShop: true
  },
  {
    name: "Emerald Overlord",
    type: "border",
    rarity: "S",
    value: "border-emerald-500 shadow-[0_0_15px_#10b981]",
    description: "Bingkai legendaris milik sang penguasa hutan zamrud.",
    price: 300,
    isGacha: false,
    isShop: true
  },

  // Badges
  {
    name: "GACOR",
    type: "badge",
    rarity: "B",
    value: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    description: "Lencana untuk pemain yang selalu hoki dan gacor.",
    price: 50,
    isGacha: false,
    isShop: true
  },
  {
    name: "RICH ROLEPLAYER",
    type: "badge",
    rarity: "A",
    value: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    description: "Lencana eksklusif untuk para penguasa ekonomi roleplay.",
    price: 150,
    isGacha: false,
    isShop: true
  },
  {
    name: "WHALE",
    type: "badge",
    rarity: "S",
    value: "bg-violet-600/25 text-violet-400 border-violet-500/40",
    description: "Lencana bagi kolektor kosmetik kelas kakap.",
    price: 500,
    isGacha: false,
    isShop: true
  },
  {
    name: "SULTAN",
    type: "badge",
    rarity: "S",
    value: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    description: "Kasta tertinggi kemewahan di guild ini.",
    price: 1000,
    isGacha: false,
    isShop: true
  },

  // Backgrounds
  {
    name: "Cyber-Neon Alley",
    type: "background",
    rarity: "A",
    value: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600",
    description: "Latar belakang gang perkotaan futuristik penuh lampu neon.",
    price: 350,
    isGacha: false,
    isShop: true
  },
  {
    name: "Mystic Mountains",
    type: "background",
    rarity: "B",
    value: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600",
    description: "Latar belakang pegunungan berkabut yang mistis.",
    price: 200,
    isGacha: false,
    isShop: true
  },
  {
    name: "Cosmic Nebula",
    type: "background",
    rarity: "S",
    value: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=600",
    description: "Latar belakang luar angkasa dengan nebula berwarna-warni.",
    price: 400,
    isGacha: false,
    isShop: true
  }
];

async function seed() {
  try {
    console.log("Seeding shop items...");
    for (const item of items) {
      await pool.query(
        `INSERT INTO cosmetics (name, type, rarity, value, description, price, is_gacha, is_shop) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [item.name, item.type, item.rarity, item.value, item.description, item.price, item.isGacha, item.isShop]
      );
      console.log(`- Seeded item: ${item.name}`);
    }
    console.log("Seeding completed successfully!");
    await pool.end();
  } catch (err) {
    console.error("DB SEED ERROR:", err);
    await pool.end();
  }
}

seed();
