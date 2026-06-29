const pg = require("pg");
const fs = require("fs");
const path = require("path");

// Manually parse .env from the root directory
const envPath = path.join(__dirname, "../../.env");
if (!fs.existsSync(envPath)) {
  console.error(`Error: .env file not found at ${envPath}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
if (!dbUrlMatch) {
  console.error("Error: DATABASE_URL not found in .env file");
  process.exit(1);
}

const connectionString = dbUrlMatch[1];
const pool = new pg.Pool({ connectionString });

const items = [
  {
    name: "Premium+ 7 Hari",
    type: "premium_plus",
    rarity: "A",
    value: "7",
    description: "Akses keuntungan tertinggi tier Premium+ selama 7 hari penuh.",
    price: 700,
    isGacha: false,
    isShop: true
  },
  {
    name: "Premium+ 30 Hari",
    type: "premium_plus",
    rarity: "S",
    value: "30",
    description: "Akses keuntungan tertinggi tier Premium+ selama 30 hari penuh.",
    price: 2400,
    isGacha: false,
    isShop: true
  },
  {
    name: "Premium+ 90 Hari",
    type: "premium_plus",
    rarity: "S",
    value: "90",
    description: "Paket hemat! Akses keuntungan tertinggi tier Premium+ selama 90 hari penuh.",
    price: 6000,
    isGacha: false,
    isShop: true
  }
];

async function seed() {
  try {
    console.log("Seeding premium_plus packages into shop...");
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
