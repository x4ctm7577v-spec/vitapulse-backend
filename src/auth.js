const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { hashPassword, verifyPassword } = require("../utils/password");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user.id, clinicId: user.clinicId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function publicUser(user, clinic) {
  const c = clinic || user.clinic;
  return { id: user.id, name: user.name, email: user.email, role: user.role, clinicId: user.clinicId, clinicName: c ? c.name : undefined };
}

// Emails are matched without regard to upper/lower case (phones often capitalise
// the first letter), and stored in lower case.
const cleanText = (v) => (typeof v === "string" ? v.trim() : "");
const cleanEmail = (v) => cleanText(v).toLowerCase();
const findByEmail = (email) =>
  prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { clinic: true } });

// POST /auth/signup
// The FIRST person from a clinic to sign up creates the clinic itself and
// becomes its "owner" (the manager). Everyone else joins that same clinic
// via /auth/invite, never through /auth/signup again.
router.post("/signup", async (req, res) => {
  const clinicName = cleanText(req.body.clinicName);
  const name = cleanText(req.body.name);
  const email = cleanEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!clinicName || !name || !email || !password) {
    return res.status(400).json({ error: "clinicName, name, email and password are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await findByEmail(email);
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });

  const clinic = await prisma.clinic.create({ data: { name: clinicName } });
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { clinicId: clinic.id, email, passwordHash, name, role: "owner" }
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user, clinic), clinic });
});

// POST /auth/invite  (owner only)
// Adds a teammate — practitioner or staff — to the SAME clinic, with the
// same access to its patients, schedule, labs and billing.
router.post("/invite", requireAuth, requireRole("owner"), async (req, res) => {
  const name = cleanText(req.body.name);
  const email = cleanEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const role = req.body.role;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await findByEmail(email);
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { clinicId: req.clinicId, email, passwordHash, name, role: role === "staff" ? "staff" : "practitioner" }
  });

  res.status(201).json({ user: publicUser(user) });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await findByEmail(email);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /auth/me — handy for the frontend to check "am I still logged in".
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { clinic: true } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user: publicUser(user) });
});

// GET /auth/team — everyone on this clinic's account (for an admin screen).
router.get("/team", requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({ where: { clinicId: req.clinicId }, orderBy: { createdAt: "asc" } });
  res.json(users.map(publicUser));
});

module.exports = router;
