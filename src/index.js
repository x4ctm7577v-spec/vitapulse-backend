require("dotenv").config();
const express = require("express");
const cors = require("cors");

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
app.use(cors());

// IMPORTANT: the Stripe webhook needs the raw, unparsed request body to
// verify its signature — so it's registered here, BEFORE express.json(),
// and it always sends its own response. Everything else uses JSON normally.
app.post("/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.json());

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
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`VitaPulse API listening on port ${PORT}`));
