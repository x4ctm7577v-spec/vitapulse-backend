const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// GET /prescriptions?patientId=...
router.get("/", async (req, res) => {
  const { patientId } = req.query;
  const prescriptions = await prisma.prescription.findMany({
    where: { clinicId: req.clinicId, ...(patientId ? { patientId: String(patientId) } : {}) },
    include: { patient: { select: { id: true, name: true } } },
    orderBy: { date: "desc" }
  });
  res.json(prescriptions);
});

// POST /prescriptions
// Mirrors what the demo app did client-side: saving a prescription also
// appends it to the patient's active medication list, in the same request.
router.post("/", async (req, res) => {
  const { patientId, medication, dose, freq, qty, pharmacy } = req.body;
  if (!patientId || !medication || !dose) {
    return res.status(400).json({ error: "patientId, medication and dose are required" });
  }
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });

  const prescription = await prisma.prescription.create({
    data: {
      clinicId: req.clinicId,
      patientId,
      medication,
      dose,
      freq: freq || "",
      qty: qty || "Not specified",
      pharmacy: pharmacy || "",
      date: todayIso(),
      createdById: req.userId
    }
  });

  const meds = Array.isArray(patient.meds) ? patient.meds : [];
  await prisma.patient.update({
    where: { id: patientId },
    data: { meds: [...meds, { name: medication, dose, freq: freq || "" }] }
  });

  res.status(201).json(prescription);
});

module.exports = router;
