const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// GET /forms?patientId=...
// Form TEMPLATES themselves (their fields, labels) are static content that
// belongs in the frontend — this only stores what got filled in.
router.get("/", async (req, res) => {
  const { patientId } = req.query;
  const forms = await prisma.formSubmission.findMany({
    where: { clinicId: req.clinicId, ...(patientId ? { patientId: String(patientId) } : {}) },
    orderBy: { date: "desc" }
  });
  res.json(forms);
});

// POST /forms
// Note: unlike the demo app, "New Patient Registration" is NOT a form
// submission here — create the patient first via POST /patients, then
// attach any other forms (consent, HIPAA, history) to that patientId.
router.post("/", async (req, res) => {
  const { patientId, templateId, templateName, data } = req.body;
  if (!patientId || !templateId || !templateName) {
    return res.status(400).json({ error: "patientId, templateId and templateName are required" });
  }
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });

  const form = await prisma.formSubmission.create({
    data: { clinicId: req.clinicId, patientId, templateId, templateName, data: data || {}, date: todayIso(), createdById: req.userId }
  });
  res.status(201).json(form);
});

module.exports = router;
