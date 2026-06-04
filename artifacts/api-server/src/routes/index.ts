import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import developmentsRouter from "./developments";
import announcementsRouter from "./announcements";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(developmentsRouter);
router.use(announcementsRouter);
router.use(statsRouter);

export default router;
