const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// Base64 data URIs are capped here so a careless upload can't bloat a row.
// ~7MB of base64 text is roughly a 5MB original file.
const MAX_BASE64_LENGTH = 7 * 1024 * 1024;

function tooLarge(value) {
  return typeof value === "string" && value.length > MAX_BASE64_LENGTH;
}

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
    // The list leaves out the big ID/insurance files so it stays fast;
    // open one patient (GET /patients/:id) to get those.
    select: {
      id: true, clinicId: true, name: true, dob: true, mrn: true,
      allergies: true, meds: true, vitals: true, visits: true,
      photo: true, idDocumentName: true, insuranceDocumentName: true,
      createdById: true, createdAt: true
    },
    orderBy: { name: "asc" }
  });
  res.json(patients);
});

// POST /patients — this is how a "New Patient Registration" form should be saved
router.post("/", async (req, res) => {
  const { name, dob, mrn, allergies, meds, vitals, visits, photo, idDocument, idDocumentName, insuranceDocument, insuranceDocumentName } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  if (tooLarge(photo) || tooLarge(idDocument) || tooLarge(insuranceDocument)) {
    return res.status(413).json({ error: "One of the uploaded files is too large (5MB max)" });
  }

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
      photo: photo || null,
      idDocument: idDocument || null,
      idDocumentName: idDocumentName || null,
      insuranceDocument: insuranceDocument || null,
      insuranceDocumentName: insuranceDocumentName || null,
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

// PATCH /patients/:id — e.g. adding a medication after a new prescription,
// or uploading/replacing a photo, ID, or insurance document
router.patch("/:id", async (req, res) => {
  const existing = await prisma.patient.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { name, dob, mrn, allergies, meds, vitals, visits, photo, idDocument, idDocumentName, insuranceDocument, insuranceDocumentName } = req.body;
  if (tooLarge(photo) || tooLarge(idDocument) || tooLarge(insuranceDocument)) {
    return res.status(413).json({ error: "One of the uploaded files is too large (5MB max)" });
  }

  const patient = await prisma.patient.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(dob !== undefined ? { dob } : {}),
      ...(mrn !== undefined ? { mrn } : {}),
      ...(allergies !== undefined ? { allergies } : {}),
      ...(meds !== undefined ? { meds } : {}),
      ...(vitals !== undefined ? { vitals } : {}),
      ...(visits !== undefined ? { visits } : {}),
      ...(photo !== undefined ? { photo } : {}),
      ...(idDocument !== undefined ? { idDocument } : {}),
      ...(idDocumentName !== undefined ? { idDocumentName } : {}),
      ...(insuranceDocument !== undefined ? { insuranceDocument } : {}),
      ...(insuranceDocumentName !== undefined ? { insuranceDocumentName } : {})
    }
  });
  res.json(patient);
});

module.exports = router;
