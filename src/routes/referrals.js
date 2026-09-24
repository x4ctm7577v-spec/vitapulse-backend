const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// GET /referrals?patientId=...
router.get("/", async (req, res) => {
  const { patientId } = req.query;
  const referrals = await prisma.referral.findMany({
    where: { clinicId: req.clinicId, ...(patientId ? { patientId: String(patientId) } : {}) },
    orderBy: { date: "desc" }
  });
  res.json(referrals);
});

// POST /referrals
router.post("/", async (req, res) => {
  const { patientId, specialty, referredTo, reason, status } = req.body;
  if (!patientId || !specialty) return res.status(400).json({ error: "patientId and specialty are required" });

  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });

  const referral = await prisma.referral.create({
    data: { clinicId: req.clinicId, patientId, specialty, referredTo: referredTo || "", reason: reason || "", status: status || "Sent", date: todayIso(), createdById: req.userId }
  });
  res.status(201).json(referral);
});

// PATCH /referrals/:id
router.patch("/:id", async (req, res) => {
  const existing = await prisma.referral.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { specialty, referredTo, reason, status } = req.body;
  const referral = await prisma.referral.update({
    where: { id: req.params.id },
    data: {
      ...(specialty !== undefined ? { specialty } : {}),
      ...(referredTo !== undefined ? { referredTo } : {}),
      ...(reason !== undefined ? { reason } : {}),
      ...(status !== undefined ? { status } : {})
    }
  });
  res.json(referral);
});

module.exports = router;
