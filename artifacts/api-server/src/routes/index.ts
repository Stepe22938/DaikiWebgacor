import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import developmentsRouter from "./developments";
import announcementsRouter from "./announcements";
import statsRouter from "./stats";
import followsRouter from "./follows";
import conversationsRouter from "./conversations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(developmentsRouter);
router.use(announcementsRouter);
router.use(statsRouter);
router.use(followsRouter);
router.use(conversationsRouter);

export default router;
