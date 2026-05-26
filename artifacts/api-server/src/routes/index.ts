import { Router, type IRouter } from "express";
import healthRouter from "./health";
import extractQuestionsRouter from "./extractQuestions";
import extractSplitRouter from "./extractSplit";
import aiStatusRouter from "./aiStatus";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiStatusRouter);
router.use(extractQuestionsRouter);
router.use(extractSplitRouter);

export default router;
