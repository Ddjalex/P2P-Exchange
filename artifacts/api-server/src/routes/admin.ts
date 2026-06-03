import { Router } from "express";
import { db } from "@workspace/db";
import { kycSubmissionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function formatSubmission(sub: any) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, sub.userId)).then(r => r[0]);
  return {
    id: sub.id,
    userId: sub.userId,
    username: user?.username ?? "Unknown",
    email: user?.email ?? "",
    fullName: sub.fullName,
    dateOfBirth: sub.dateOfBirth,
    nationality: sub.nationality,
    idType: sub.idType,
    frontImageUrl: sub.frontImageUrl,
    backImageUrl: sub.backImageUrl ?? null,
    selfieUrl: sub.selfieUrl,
    livenessResult: JSON.parse(sub.livenessResult),
    status: sub.status,
    rejectionReason: sub.rejectionReason ?? null,
    adminMessage: sub.adminMessage ?? null,
    reviewedBy: sub.reviewedBy ?? null,
    submittedAt: sub.submittedAt,
    reviewedAt: sub.reviewedAt ?? null,
  };
}

router.get("/kyc", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    let query = db.select().from(kycSubmissionsTable);
    const submissions = await query;
    const filtered = status
      ? submissions.filter(s => s.status === status)
      : submissions;
    const formatted = await Promise.all(filtered.map(formatSubmission));
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "Failed to list KYC submissions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/kyc/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const sub = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, userId)).then(r => r[0]);
    if (!sub) return res.status(404).json({ error: "KYC submission not found" });
    res.json(await formatSubmission(sub));
  } catch (err) {
    req.log.error({ err }, "Failed to get KYC submission");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/kyc/:userId/review", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { decision, rejectionReason, adminMessage } = req.body;

    const newKycStatus = decision === "verified" ? "verified"
      : decision === "rejected" ? "rejected"
      : "more_info_required";

    await db.update(kycSubmissionsTable).set({
      status: newKycStatus as any,
      rejectionReason: rejectionReason ?? null,
      adminMessage: adminMessage ?? null,
      reviewedBy: 0, // admin
      reviewedAt: new Date(),
    }).where(eq(kycSubmissionsTable.userId, userId));

    await db.update(usersTable).set({ kycStatus: newKycStatus as any })
      .where(eq(usersTable.id, userId));

    const sub = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, userId)).then(r => r[0]);
    res.json(await formatSubmission(sub!));
  } catch (err) {
    req.log.error({ err }, "Failed to review KYC");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
