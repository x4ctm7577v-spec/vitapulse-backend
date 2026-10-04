const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /appointments?from=2026-09-23&to=2026-09-30
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: req.clinicId,
      ...(from || to
        ? { date: { ...(from ? { gte: String(from) } : {}), ...(to ? { lte: String(to) } : {}) } }
        : {})
    },
    include: { patient: { select: { id: true, name: true, mrn: true } } },
    orderBy: [{ date: "asc" }, { time: "asc" }]
  });
  res.json(appointments);
});

// POST /appointments
router.post("/", async (req, res) => {
  const { patientId, date, time, type, reason } = req.body;
  if (!patientId || !date || !time) {
    return res.status(400).json({ error: "patientId, date and time are required" });
  }
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });

  const appointment = await prisma.appointment.create({
    data: { clinicId: req.clinicId, patientId, date, time, type: type || "Office visit", reason: reason || "", createdById: req.userId }
  });
  res.status(201).json(appointment);
});

// PATCH /appointments/:id
router.patch("/:id", async (req, res) => {
  const existing = await prisma.appointment.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { date, time, type, reason } = req.body;
  const appointment = await prisma.appointment.update({
    where: { id: req.params.id },
    data: {
      ...(date !== undefined ? { date } : {}),
      ...(time !== undefined ? { time } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(reason !== undefined ? { reason } : {})
    }
  });
  res.json(appointment);
});

// DELETE /appointments/:id
router.delete("/:id", async (req, res) => {
  const existing = await prisma.appointment.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.appointment.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

module.exports = router;
