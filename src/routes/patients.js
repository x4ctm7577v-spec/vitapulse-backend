const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /patients?search=whitfield
router.get("/", async (req, res) => {
  const { search } = req.query;
  const patients = await prisma.patient.findMany({
    where: {
      clinicId: req.clinicId,
      ...(search
        ? { OR: [{ name: { contains: String(search), mode: "insensitive" } }, { mrn: { contains: String(search), mode: "insensitive" } }] }
        : {})
    },
    orderBy: { name: "asc" }
  });
  res.json(patients);
});

// POST /patients — this is how a "New Patient Registration" form should be saved
router.post("/", async (req, res) => {
  const { name, dob, mrn, allergies, meds, vitals, visits } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const patient = await prisma.patient.create({
    data: {
      clinicId: req.clinicId,
      name,
      dob: dob || "",
      mrn: mrn || `MRN-${Math.floor(10000 + Math.random() * 89999)}`,
      allergies: allergies || [],
      meds: meds || [],
      vitals: vitals || {},
      visits: visits || [],
      createdById: req.userId
    }
  });
  res.status(201).json(patient);
});

// GET /patients/:id
router.get("/:id", async (req, res) => {
  const patient = await prisma.patient.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Not found" });
  res.json(patient);
});

// PATCH /patients/:id — e.g. adding a medication after a new prescription
router.patch("/:id", async (req, res) => {
  const existing = await prisma.patient.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { name, dob, mrn, allergies, meds, vitals, visits } = req.body;
  const patient = await prisma.patient.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(dob !== undefined ? { dob } : {}),
      ...(mrn !== undefined ? { mrn } : {}),
      ...(allergies !== undefined ? { allergies } : {}),
      ...(meds !== undefined ? { meds } : {}),
      ...(vitals !== undefined ? { vitals } : {}),
      ...(visits !== undefined ? { visits } : {})
    }
  });
  res.json(patient);
});

module.exports = router;
