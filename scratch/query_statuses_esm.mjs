import { db, statusesTable } from "../lib/db/src/index.ts";
import { gt } from "drizzle-orm";

async function check() {
  try {
    const res = await db.select().from(statusesTable);
    console.log("STATUSES ALL COUNT:", res.length);
    console.log("STATUSES ALL:", JSON.stringify(res, null, 2));

    const active = await db.select().from(statusesTable).where(gt(statusesTable.expiresAt, new Date()));
    console.log("STATUSES ACTIVE:", JSON.stringify(active, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("DB ERROR:", err);
    process.exit(1);
  }
}

check();
