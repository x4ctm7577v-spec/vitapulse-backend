const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// GET /chart-notes?patientId=...
router.get("/", async (req, res) => {
  const { patientId } = req.query;
  const notes = await prisma.chartNote.findMany({
    where: { clinicId: req.clinicId, ...(patientId ? { patientId: String(patientId) } : {}) },
    orderBy: { date: "desc" }
  });
  res.json(notes);
});

// POST /chart-notes
router.post("/", async (req, res) => {
  const { patientId, type, date, subjective, objective, assessment, plan } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });

  const note = await prisma.chartNote.create({
    data: {
      clinicId: req.clinicId, patientId,
      type: type || "Office visit", date: date || todayIso(),
      subjective: subjective || "", objective: objective || "", assessment: assessment || "", plan: plan || "",
      createdById: req.userId
    }
  });
  res.status(201).json(note);
});

// PATCH /chart-notes/:id
router.patch("/:id", async (req, res) => {
  const existing = await prisma.chartNote.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { type, date, subjective, objective, assessment, plan } = req.body;
  const note = await prisma.chartNote.update({
    where: { id: req.params.id },
    data: {
      ...(type !== undefined ? { type } : {}),
      ...(date !== undefined ? { date } : {}),
      ...(subjective !== undefined ? { subjective } : {}),
      ...(objective !== undefined ? { objective } : {}),
      ...(assessment !== undefined ? { assessment } : {}),
      ...(plan !== undefined ? { plan } : {})
    }
  });
  res.json(note);
});

module.exports = router;
