import { Router } from "express";
import { db } from "@workspace/db";
import { kycSubmissionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const DEV_USER_ID = 1;

router.get("/status", async (req, res) => {
  try {
    const submission = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, DEV_USER_ID))
      .then(r => r[0]);

    if (!submission) {
      const user = await db.select().from(usersTable).where(eq(usersTable.id, DEV_USER_ID)).then(r => r[0]);
      return res.json({
        status: user?.kycStatus ?? "none",
        rejectionReason: null,
        adminMessage: null,
        submittedAt: null,
        reviewedAt: null,
      });
    }

    res.json({
      status: submission.status,
      rejectionReason: submission.rejectionReason ?? null,
      adminMessage: submission.adminMessage ?? null,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get KYC status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/submit", async (req, res) => {
  try {
    const { fullName, dateOfBirth, nationality, idType, frontImageUrl, backImageUrl, selfieUrl, livenessResult } = req.body;

    // Upsert submission
    const existing = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, DEV_USER_ID)).then(r => r[0]);

    if (existing) {
      await db.update(kycSubmissionsTable).set({
        fullName,
        dateOfBirth,
        nationality,
        idType,
        frontImageUrl,
        backImageUrl: backImageUrl ?? null,
        selfieUrl,
        livenessResult: JSON.stringify(livenessResult || {}),
        status: "pending",
        rejectionReason: null,
        adminMessage: null,
        reviewedBy: null,
        reviewedAt: null,
      }).where(eq(kycSubmissionsTable.userId, DEV_USER_ID));
    } else {
      await db.insert(kycSubmissionsTable).values({
        userId: DEV_USER_ID,
        fullName,
        dateOfBirth,
        nationality,
        idType,
        frontImageUrl,
        backImageUrl: backImageUrl ?? null,
        selfieUrl,
        livenessResult: JSON.stringify(livenessResult || {}),
        status: "pending",
      });
    }

    // Update user kyc status
    await db.update(usersTable).set({ kycStatus: "pending" }).where(eq(usersTable.id, DEV_USER_ID));

    res.status(201).json({
      status: "pending",
      rejectionReason: null,
      adminMessage: null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to submit KYC");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
