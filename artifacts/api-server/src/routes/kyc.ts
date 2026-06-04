import { Router } from "express";
import { db } from "@workspace/db";
import { kycSubmissionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";

const router = Router();

const uploadsDir = path.resolve(process.cwd(), "uploads", "kyc");
mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const name = randomBytes(16).toString("hex") + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const url = `/uploads/kyc/${req.file.filename}`;
  res.json({ url });
});

router.get("/status", async (req, res) => {
  try {
    const submission = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, (req as any).userId))
      .then(r => r[0]);

    if (!submission) {
      const user = await db.select().from(usersTable).where(eq(usersTable.id, (req as any).userId)).then(r => r[0]);
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
      fullName: submission.fullName ?? null,
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

    const existing = await db.select().from(kycSubmissionsTable)
      .where(eq(kycSubmissionsTable.userId, (req as any).userId)).then(r => r[0]);

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
      }).where(eq(kycSubmissionsTable.userId, (req as any).userId));
    } else {
      await db.insert(kycSubmissionsTable).values({
        userId: (req as any).userId,
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

    await db.update(usersTable).set({ kycStatus: "pending" }).where(eq(usersTable.id, (req as any).userId));

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
