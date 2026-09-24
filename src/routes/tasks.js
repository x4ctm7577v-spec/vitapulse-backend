const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /tasks
router.get("/", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { clinicId: req.clinicId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }]
  });
  res.json(tasks);
});

// POST /tasks
router.post("/", async (req, res) => {
  const { title, patientId, notes, dueDate, status } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  if (patientId) {
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
    if (!patient) return res.status(404).json({ error: "Patient not found in this clinic" });
  }

  const task = await prisma.task.create({
    data: {
      clinicId: req.clinicId, title, patientId: patientId || null,
      notes: notes || "", dueDate: dueDate || "", status: status || "To do",
      createdById: req.userId
    }
  });
  res.status(201).json(task);
});

// PATCH /tasks/:id
router.patch("/:id", async (req, res) => {
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { title, patientId, notes, dueDate, status } = req.body;
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(patientId !== undefined ? { patientId: patientId || null } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(status !== undefined ? { status } : {})
    }
  });
  res.json(task);
});

// DELETE /tasks/:id
router.delete("/:id", async (req, res) => {
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

module.exports = router;
