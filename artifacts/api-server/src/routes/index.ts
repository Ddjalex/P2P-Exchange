import { Router, type IRouter } from "express";
import { userAuth } from "../middleware/user-auth";
import { checkAccountStatus } from "../middleware/security";
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
import webhookCardsRouter from "./webhook-cards";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/fees", feesRouter);
router.use("/config", configRouter);

// All routes below require a valid user JWT
router.use("/wallet", userAuth, checkAccountStatus, walletRouter);
router.use("/transactions", userAuth, checkAccountStatus, transactionsRouter);
router.use("/ads", userAuth, checkAccountStatus, adsRouter);
router.use("/orders", userAuth, checkAccountStatus, ordersRouter);
router.use("/messages", userAuth, checkAccountStatus, messagesRouter);
router.use("/profile", userAuth, checkAccountStatus, profileRouter);
router.use("/kyc", userAuth, checkAccountStatus, kycRouter);
router.use("/notifications", userAuth, checkAccountStatus, notificationsRouter);
router.use("/stats", userAuth, checkAccountStatus, statsRouter);
router.use("/sse", sseRouter);
router.use("/users", userAuth, checkAccountStatus, usersRouter);
router.use("/card", cardRouter);
router.use("/cards", nfcCardsRouter);
router.use("/push", userAuth, checkAccountStatus, pushRouter);

router.use("/webhooks", webhookCardsRouter);
router.use("/admin", adminRouter);

export default router;
