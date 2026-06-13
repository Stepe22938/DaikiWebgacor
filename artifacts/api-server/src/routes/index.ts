import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import developmentsRouter from "./developments";
import announcementsRouter from "./announcements";
import statsRouter from "./stats";
import followsRouter from "./follows";
import conversationsRouter from "./conversations";
import settingsRouter from "./settings";
import uploadRouter from "./upload";
import ticketsRouter from "./tickets";
import formsRouter from "./forms";
import creditsRouter from "./credits";
import badgesRouter from "./badges";
import gachaRouter from "./gacha";
import musicRouter from "./music";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(developmentsRouter);
router.use(announcementsRouter);
router.use(statsRouter);
router.use(followsRouter);
router.use(conversationsRouter);
router.use(settingsRouter);
router.use(uploadRouter);
router.use(ticketsRouter);
router.use(formsRouter);
router.use(creditsRouter);
router.use(badgesRouter);
router.use(gachaRouter);
router.use(musicRouter);

export default router;
