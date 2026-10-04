const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// GET /injections?patientId=...
router.get("/", async (req, res) => {
  const { patientId } = req.query;
  const injections = await prisma.injection.findMany({
    where: { clinicId: req.clinicId, ...(patientId ? { patientId: String(patientId) } : {}) },
    orderBy: { date: "desc" }
  });
  res.json(injections);
});

// POST /injections
router.post("/", async (req, res) => {
  const { patientId, name, dose, site, lot } = req.body;
  if (!patientId || !name) return res.status(400).json({ error: "patientId and name are required" });

  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });

  const injection = await prisma.injection.create({
    data: { clinicId: req.clinicId, patientId, name, dose: dose || "", site: site || "", lot: lot || "", date: todayIso(), createdById: req.userId }
  });
  res.status(201).json(injection);
});

// DELETE /injections/:id
router.delete("/:id", async (req, res) => {
  const existing = await prisma.injection.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.injection.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

module.exports = router;
