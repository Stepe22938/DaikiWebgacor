import { db, conversationMembersTable, usersTable, announcementsTable, developmentsTable } from "./src/index.ts";
import { eq } from "drizzle-orm";

async function test() {
  try {
    const announcements = await db.select().from(announcementsTable);
    console.log('Announcements in DB:', announcements);

    const developments = await db.select().from(developmentsTable);
    console.log('Developments in DB:', developments);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

test();
