import { Router, type IRouter } from "express";
import healthRouter from "./health";
import newsRouter from "./news";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(newsRouter);

export default router;
