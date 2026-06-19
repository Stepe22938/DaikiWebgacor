import { db, conversationsTable, usersTable, stickersTable } from "@workspace/db";

async function main() {
  const convs = await db.select().from(conversationsTable);
  console.log("=== CONVERSATIONS ===");
  console.log(JSON.stringify(convs, null, 2));

  const users = await db.select().from(usersTable);
  console.log("=== USERS ===");
  console.log(JSON.stringify(users, null, 2));

  const stickers = await db.select().from(stickersTable);
  console.log("=== STICKERS ===");
  console.log(JSON.stringify(stickers, null, 2));
}

main().catch(console.error);
