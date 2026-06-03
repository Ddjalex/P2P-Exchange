import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Dev bypass — returns or creates a default user
router.get("/me", async (req, res) => {
  try {
    let user = await db.select().from(usersTable).where(eq(usersTable.id, 1)).then(r => r[0]);
    if (!user) {
      const [created] = await db.insert(usersTable).values({
        username: "EthioFuture",
        email: "user@ethiop2p.com",
        country: "Ethiopia",
        kycStatus: "verified",
        isMerchant: false,
        emailVerified: true,
        smsVerified: true,
        addressVerified: true,
      }).returning();
      user = created;
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone ?? null,
      country: user.country,
      kycStatus: user.kycStatus,
      isMerchant: user.isMerchant,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
