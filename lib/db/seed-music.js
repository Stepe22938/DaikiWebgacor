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

const tracks = [
  // === Local Tracks (RPG/Ambient) ===
  {
    title: "Town Square Melodies",
    artist: "Lobby Ambient",
    file: "/music/lobby_ambient.mp3",
    cover: "/village.png",
    duration: "6:12",
    type: "Lobby Favorites"
  },
  {
    title: "Quest of the Forest",
    artist: "Adventure Theme",
    file: "/music/adventure_theme.mp3",
    cover: "/dungeon.png",
    duration: "7:05",
    type: "Combat & Adventure"
  },
  {
    title: "The Drunken Dragon Inn",
    artist: "Tavern Theme",
    file: "/music/tavern_theme.mp3",
    cover: "/lobby.png",
    duration: "5:44",
    type: "Tavern Classics"
  },
  {
    title: "Valor & Iron",
    artist: "Castle Theme",
    file: "/music/castle_siege.mp3",
    cover: "/login_bg.png",
    duration: "5:02",
    type: "Combat & Adventure"
  },
  {
    title: "Echoes of the Nether",
    artist: "Nether Ambient",
    file: "/music/nether_echoes.mp3",
    cover: "/char_idle.png",
    duration: "6:02",
    type: "Combat & Adventure"
  },
  {
    title: "Starlight Oasis",
    artist: "Desert Ambient",
    file: "/music/starlight_oasis.mp3",
    cover: "/char_looking.png",
    duration: "7:38",
    type: "Lobby Favorites"
  },
  {
    title: "Ancient Ruins",
    artist: "Dungeon Ambient",
    file: "/music/ancient_ruins.mp3",
    cover: "/char_peekaboo.png",
    duration: "5:30",
    type: "Combat & Adventure"
  },
  {
    title: "Dragon's Lair",
    artist: "Boss Battle",
    file: "/music/dragons_lair.mp3",
    cover: "/login_character.png",
    duration: "5:18",
    type: "Combat & Adventure"
  },
  {
    title: "Whispering Woods",
    artist: "Forest Ambient",
    file: "/music/whispering_woods.mp3",
    cover: "/opengraph.jpg",
    duration: "6:35",
    type: "Lobby Favorites"
  },
  {
    title: "Shadow Dungeon",
    artist: "Dungeon Ambient",
    file: "/music/shadow_dungeon.mp3",
    cover: "/dungeon.png",
    duration: "8:47",
    type: "Combat & Adventure"
  },
  {
    title: "Fallen Kingdom",
    artist: "Castle Theme",
    file: "/music/fallen_kingdom.mp3",
    cover: "/login_bg.png",
    duration: "9:11",
    type: "Combat & Adventure"
  },
  {
    title: "The Golden Chalice",
    artist: "Tavern Theme",
    file: "/music/golden_chalice.mp3",
    cover: "/lobby.png",
    duration: "8:33",
    type: "Tavern Classics"
  },
  {
    title: "Eldritch Whispers",
    artist: "Nether Ambient",
    file: "/music/eldritch_whispers.mp3",
    cover: "/char_peekaboo.png",
    duration: "7:50",
    type: "Combat & Adventure"
  },
  {
    title: "Elven Sanctuary",
    artist: "Forest Ambient",
    file: "/music/elven_sanctuary.mp3",
    cover: "/char_idle.png",
    duration: "8:36",
    type: "Lobby Favorites"
  },
  {
    title: "Oceanic Voyage",
    artist: "Adventure Theme",
    file: "/music/oceanic_voyage.mp3",
    cover: "/char_looking.png",
    duration: "7:18",
    type: "Combat & Adventure"
  },
  {
    title: "Volcanic Depths",
    artist: "Nether Ambient",
    file: "/music/volcanic_depths.mp3",
    cover: "/login_character.png",
    duration: "8:03",
    type: "Combat & Adventure"
  },

  // === Online Tracks (Soundhelix / Lofi / Public Domain) ===
  {
    title: "Lofi Study Session",
    artist: "Lofi Chill Beats",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    cover: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?q=80&w=400&auto=format&fit=crop",
    duration: "6:12",
    type: "Lofi & Chill"
  },
  {
    title: "Midnight Coffee",
    artist: "Lofi Chill Beats",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    cover: "https://images.unsplash.com/photo-1507133750040-4a8f57021571?q=80&w=400&auto=format&fit=crop",
    duration: "7:05",
    type: "Lofi & Chill"
  },
  {
    title: "Rainy Day Lofi",
    artist: "Lofi Chill Beats",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    cover: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?q=80&w=400&auto=format&fit=crop",
    duration: "5:44",
    type: "Lofi & Chill"
  },
  {
    title: "Summer Breeze",
    artist: "Synthwave Sun",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop",
    duration: "5:02",
    type: "Synthwave Hits"
  },
  {
    title: "Neon Horizon",
    artist: "Synthwave Sun",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    cover: "https://images.unsplash.com/photo-1515260268569-9271009adfdb?q=80&w=400&auto=format&fit=crop",
    duration: "6:02",
    type: "Synthwave Hits"
  },
  {
    title: "Retro Drive",
    artist: "Synthwave Sun",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    cover: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&auto=format&fit=crop",
    duration: "7:38",
    type: "Synthwave Hits"
  },
  {
    title: "Creative Minds",
    artist: "Bensound",
    file: "https://www.bensound.com/bensound-music/bensound-creativeminds.mp3",
    cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=400&auto=format&fit=crop",
    duration: "2:27",
    type: "Pop Hits"
  },
  {
    title: "A New Beginning",
    artist: "Bensound",
    file: "https://www.bensound.com/bensound-music/bensound-anewbeginning.mp3",
    cover: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=400&auto=format&fit=crop",
    duration: "4:48",
    type: "Pop Hits"
  },
  {
    title: "Epic Journey",
    artist: "Cinematic Orchestra",
    file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    cover: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=400&auto=format&fit=crop",
    duration: "5:30",
    type: "Pop Hits"
  }
];

async function seed() {
  console.log("Seeding music table...");
  try {
    // Clean existing data in music table
    await pool.query("TRUNCATE TABLE music CASCADE;");
    console.log("Cleared existing music table.");

    for (const track of tracks) {
      await pool.query(
        `INSERT INTO music (title, artist, album, file, cover, duration, type, release_date, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [track.title, track.artist, track.album || "", track.file, track.cover, track.duration, track.type, track.releaseDate || ""]
      );
    }
    console.log(`Successfully seeded ${tracks.length} music tracks!`);
  } catch (error) {
    console.error("Error seeding music:", error);
  } finally {
    await pool.end();
  }
}

seed();
