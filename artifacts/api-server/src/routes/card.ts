import { Router } from "express";
import { db } from "@workspace/db";
import { cardWaitlistTable, kycSubmissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { userAuth } from "../middleware/user-auth";

const router = Router();

// GET /api/card/notify/status — check if current user is on waitlist
router.get("/notify/status", userAuth, async (req: any, res) => {
  try {
    const existing = await db.query.cardWaitlistTable.findFirst({
      where: eq(cardWaitlistTable.userId, req.user.id),
    });
    return res.json({ isOnWaitlist: !!existing });
  } catch {
    return res.json({ isOnWaitlist: false });
  }
});

// POST /api/card/notify — user joins waitlist
router.post("/notify", userAuth, async (req: any, res) => {
  try {
    const existing = await db.query.cardWaitlistTable.findFirst({
      where: eq(cardWaitlistTable.userId, req.user.id),
    });
    if (existing) {
      return res.json({ message: "Already on waitlist", alreadyJoined: true });
    }

    const kyc = await db.query.kycSubmissionsTable.findFirst({
      where: eq(kycSubmissionsTable.userId, req.user.id),
    });

    await db.insert(cardWaitlistTable).values({
      userId: req.user.id,
      username: req.user.username,
      email: req.user.email ?? null,
      kycName: kyc?.fullName ?? null,
    });

    return res.json({ message: "Added to waitlist", success: true });
  } catch (error) {
    req.log?.error({ error }, "Waitlist error");
    return res.status(500).json({ message: "Failed to join waitlist" });
  }
});

export default router;
