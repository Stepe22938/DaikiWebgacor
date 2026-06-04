import { Router, type IRouter } from "express";
import { count, eq } from "drizzle-orm";
import { db, usersTable, announcementsTable, developmentsTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [[{ totalMembers }], [{ totalAnnouncements }], [{ totalDevelopments }], [{ completedDevelopments }], [{ inProgressDevelopments }]] = await Promise.all([
    db.select({ totalMembers: count() }).from(usersTable),
    db.select({ totalAnnouncements: count() }).from(announcementsTable),
    db.select({ totalDevelopments: count() }).from(developmentsTable),
    db.select({ completedDevelopments: count() }).from(developmentsTable).where(eq(developmentsTable.status, "completed")),
    db.select({ inProgressDevelopments: count() }).from(developmentsTable).where(eq(developmentsTable.status, "in_progress")),
  ]);

  res.json(GetStatsResponse.parse({
    totalMembers,
    totalAnnouncements,
    totalDevelopments,
    completedDevelopments,
    inProgressDevelopments,
  }));
});

export default router;
