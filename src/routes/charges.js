const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// GET /charges?patientId=...
// Note: these are the CLINIC's charges to ITS patients (what VitaPulse helps
// them track) — separate from the /billing routes, which handle the
// clinic's own subscription payment to you.
router.get("/", async (req, res) => {
  const { patientId } = req.query;
  const charges = await prisma.charge.findMany({
    where: { clinicId: req.clinicId, ...(patientId ? { patientId: String(patientId) } : {}) },
    orderBy: { date: "desc" }
  });
  res.json(charges);
});

// POST /charges
router.post("/", async (req, res) => {
  const { patientId, description, amount, payer, status } = req.body;
  if (!patientId || !description || !amount) {
    return res.status(400).json({ error: "patientId, description and amount are required" });
  }
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });

  const charge = await prisma.charge.create({
    data: { clinicId: req.clinicId, patientId, description, amount, payer: payer || "", status: status || "Pending", date: todayIso(), createdById: req.userId }
  });
  res.status(201).json(charge);
});

// PATCH /charges/:id
router.patch("/:id", async (req, res) => {
  const existing = await prisma.charge.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { amount, payer, status } = req.body;
  const charge = await prisma.charge.update({
    where: { id: req.params.id },
    data: {
      ...(amount !== undefined ? { amount } : {}),
      ...(payer !== undefined ? { payer } : {}),
      ...(status !== undefined ? { status } : {})
    }
  });
  res.json(charge);
});

module.exports = router;
