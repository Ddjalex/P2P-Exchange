import { Router } from "express";

const router = Router();

router.get("/telegram", (_req, res) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || null;
  const enabled = !!process.env.TELEGRAM_BOT_TOKEN;
  res.json({ botUsername, enabled });
});

export default router;
