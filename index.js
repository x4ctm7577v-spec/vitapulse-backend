require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Express 4 does not pass errors thrown inside async route handlers to the
// error handler, so one failed database call could crash the server or leave a
// request hanging forever. This makes those errors reach the handler below.
try {
  const Layer = require("express/lib/router/layer");
  Layer.prototype.handle_request = function handleRequest(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next();
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === "function") result.catch(next);
    } catch (err) {
      next(err);
    }
  };
} catch (err) {
  console.warn("Could not enable async error handling:", err.message);
}

const authRoutes = require("./routes/auth");
const patientRoutes = require("./routes/patients");
const appointmentRoutes = require("./routes/appointments");
const prescriptionRoutes = require("./routes/prescriptions");
const formRoutes = require("./routes/forms");
const labRoutes = require("./routes/labs");
const chargeRoutes = require("./routes/charges");
const chartNoteRoutes = require("./routes/chartNotes");
const taskRoutes = require("./routes/tasks");
const injectionRoutes = require("./routes/injections");
const referralRoutes = require("./routes/referrals");
const { router: billingRoutes, handleStripeWebhook } = require("./routes/billing");

const app = express();
app.set("trust proxy", 1); // Railway sits in front of the app; this makes req.ip the real visitor
app.use(cors());

// Small login/sign-up brake: at most 10 tries per minute from one address.
const attempts = new Map();
function limitAttempts(req, res, next) {
  if (req.method !== "POST") return next();
  const key = req.ip + " " + req.baseUrl;
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((t) => now - t < 60 * 1000);
  if (recent.length >= 10) {
    return res.status(429).json({ error: "Too many attempts. Please wait a minute and try again." });
  }
  recent.push(now);
  attempts.set(key, recent);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of attempts) {
    const recent = list.filter((t) => now - t < 60 * 1000);
    if (recent.length) attempts.set(key, recent); else attempts.delete(key);
  }
}, 5 * 60 * 1000).unref();
app.use("/auth/login", limitAttempts);
app.use("/auth/signup", limitAttempts);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /replace-with|changeme/i.test(process.env.JWT_SECRET)) {
  console.warn("WARNING: JWT_SECRET is missing, short or still a placeholder. Set a long random value in your environment variables.");
}

// IMPORTANT: the Stripe webhook needs the raw, unparsed request body to
// verify its signature — so it's registered here, BEFORE express.json(),
// and it always sends its own response. Everything else uses JSON normally.
app.post("/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.json({ limit: "12mb" }));

app.get("/health", (req, res) => res.json({ ok: true, service: "vitapulse-api" }));

app.use("/auth", authRoutes);
app.use("/patients", patientRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/prescriptions", prescriptionRoutes);
app.use("/forms", formRoutes);
app.use("/labs", labRoutes);
app.use("/charges", chargeRoutes);
app.use("/chart-notes", chartNoteRoutes);
app.use("/tasks", taskRoutes);
app.use("/injections", injectionRoutes);
app.use("/referrals", referralRoutes);
app.use("/billing", billingRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "That upload is too large" });
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request" });
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`VitaPulse API listening on port ${PORT}`));
