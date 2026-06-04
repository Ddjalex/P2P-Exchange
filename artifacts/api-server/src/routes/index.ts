import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import walletRouter from "./wallet";
import transactionsRouter from "./transactions";
import adsRouter from "./ads";
import ordersRouter from "./orders";
import messagesRouter from "./messages";
import profileRouter from "./profile";
import kycRouter from "./kyc";
import notificationsRouter from "./notifications";
import statsRouter from "./stats";
import adminRouter from "./admin";
import sseRouter from "./sse";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/wallet", walletRouter);
router.use("/transactions", transactionsRouter);
router.use("/ads", adsRouter);
router.use("/orders", ordersRouter);
router.use("/messages", messagesRouter);
router.use("/profile", profileRouter);
router.use("/kyc", kycRouter);
router.use("/notifications", notificationsRouter);
router.use("/stats", statsRouter);
router.use("/admin", adminRouter);
router.use("/sse", sseRouter);

export default router;
