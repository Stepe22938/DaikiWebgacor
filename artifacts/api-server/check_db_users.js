const pg = require("pg");
const path = require("path");
const fs = require("fs");
const zod = require("zod");

// Load .env
const rootEnvPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
  require("dotenv").config({ path: rootEnvPath });
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const listMembersResponseUserTagRegExp = new RegExp('^#[0-9]{3,}$');
const ListMembersResponseItem = zod.object({
  "id": zod.number(),
  "username": zod.string(),
  "userTag": zod.string().regex(listMembersResponseUserTagRegExp),
  "role": zod.enum(['member', 'admin', 'staff', 'dev', 'dev_website', 'bot', 'ai']),
  "displayName": zod.string().nullish(),
  "avatarUrl": zod.string().nullish(),
  "bio": zod.string().nullish(),
  "youtubeLiveUrl": zod.string().nullish(),
  "createdAt": zod.any(), // bypass date serializing for this check
  "isFollowing": zod.boolean(),
  "followerCount": zod.number(),
  "followingCount": zod.number(),
  "equippedBorder": zod.string().nullish(),
  "equippedBadge": zod.string().nullish(),
  "equippedBackground": zod.string().nullish()
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM users");
    console.log(`Checking ${res.rows.length} users...`);
    for (const u of res.rows) {
      // Mock followers/following count
      const testUser = {
        ...u,
        isFollowing: false,
        followerCount: 0,
        followingCount: 0,
        equippedBorder: null,
        equippedBadge: null,
        equippedBackground: null
      };
      const parseResult = ListMembersResponseItem.safeParse(testUser);
      if (!parseResult.success) {
        console.error(`VALIDATION FAILED for user ID ${u.id} (${u.username}):`, JSON.stringify(parseResult.error.format(), null, 2));
        console.error("User object was:", JSON.stringify(u, null, 2));
      }
    }
  } catch (err) {
    console.error("ERROR running check:", err.stack);
  } finally {
    await pool.end();
  }
}

run();
