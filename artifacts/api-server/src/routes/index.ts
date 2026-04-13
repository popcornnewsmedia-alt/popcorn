import { Router, type IRouter } from "express";
import healthRouter from "./health";
import newsRouter from "./news";
import authRouter from "./auth";
import curationRouter from "./curation";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(newsRouter);
router.use(curationRouter);

export default router;
