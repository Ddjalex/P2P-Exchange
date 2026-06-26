import { Router, type IRouter } from "express";
import { userAuth } from "../middleware/user-auth";
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
import usersRouter from "./users";
import cardRouter from "./card";
import nfcCardsRouter from "./nfc-cards";
import feesRouter from "./fees";
import pushRouter from "./push";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/fees", feesRouter);
router.use("/config", configRouter);

// All routes below require a valid user JWT
router.use("/wallet", userAuth, walletRouter);
router.use("/transactions", userAuth, transactionsRouter);
router.use("/ads", userAuth, adsRouter);
router.use("/orders", userAuth, ordersRouter);
router.use("/messages", userAuth, messagesRouter);
router.use("/profile", userAuth, profileRouter);
router.use("/kyc", userAuth, kycRouter);
router.use("/notifications", userAuth, notificationsRouter);
router.use("/stats", userAuth, statsRouter);
router.use("/sse", sseRouter);
router.use("/users", userAuth, usersRouter);
router.use("/card", cardRouter);
router.use("/cards", nfcCardsRouter);
router.use("/push", userAuth, pushRouter);

router.use("/admin", adminRouter);

export default router;
