const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// GET /labs?patientId=...
router.get("/", async (req, res) => {
  const { patientId } = req.query;
  const labs = await prisma.labOrder.findMany({
    where: { clinicId: req.clinicId, ...(patientId ? { patientId: String(patientId) } : {}) },
    orderBy: { date: "desc" }
  });
  res.json(labs);
});

// POST /labs — order a new test
router.post("/", async (req, res) => {
  const { patientId, testName, type } = req.body;
  if (!patientId || !testName) return res.status(400).json({ error: "patientId and testName are required" });

  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });

  const lab = await prisma.labOrder.create({
    data: { clinicId: req.clinicId, patientId, testName, type: type === "Imaging" ? "Imaging" : "Lab", status: "Ordered", result: "", date: todayIso(), createdById: req.userId }
  });
  res.status(201).json(lab);
});

// PATCH /labs/:id — record a result, mark it Resulted
router.patch("/:id", async (req, res) => {
  const existing = await prisma.labOrder.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { status, result } = req.body;
  const lab = await prisma.labOrder.update({
    where: { id: req.params.id },
    data: { ...(status !== undefined ? { status } : {}), ...(result !== undefined ? { result } : {}) }
  });
  res.json(lab);
});

module.exports = router;
