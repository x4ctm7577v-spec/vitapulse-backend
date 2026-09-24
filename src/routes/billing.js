const express = require("express");
const stripe = require("../lib/stripe");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// POST /billing/create-checkout-session   (owner only)
// Charges $140/practitioner/month: quantity = however many users are
// currently on the clinic's account. Call this again (or update the
// subscription quantity) whenever the team size changes.
router.post("/create-checkout-session", requireAuth, requireRole("owner"), async (req, res) => {
  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });

    const seatCount = await prisma.user.count({ where: { clinicId: req.clinicId } });

    let customerId = clinic.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { clinicId: clinic.id }, name: clinic.name });
      customerId = customer.id;
      await prisma.clinic.update({ where: { id: clinic.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: Math.max(seatCount, 1) }],
      success_url: `${process.env.APP_URL}/billing/success`,
      cancel_url: `${process.env.APP_URL}/billing/cancelled`,
      metadata: { clinicId: clinic.id }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session failed:", err);
    res.status(500).json({ error: "Could not start checkout" });
  }
});

// GET /billing/status
router.get("/status", requireAuth, async (req, res) => {
  const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  res.json({ status: clinic.subscriptionStatus });
});

// POST /billing/portal — lets the owner manage/cancel their subscription
// through Stripe's own hosted billing page, instead of you building one.
router.post("/portal", requireAuth, requireRole("owner"), async (req, res) => {
  const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
  if (!clinic || !clinic.stripeCustomerId) return res.status(400).json({ error: "No billing account yet" });

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: clinic.stripeCustomerId,
    return_url: process.env.APP_URL
  });
  res.json({ url: portalSession.url });
});

// The raw Stripe webhook handler. This is NOT mounted through this router —
// index.js wires it up directly, BEFORE express.json(), because Stripe's
// signature check needs the exact raw request body. Keeping it here just
// keeps all the billing logic in one file.
async function handleStripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature check failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const obj = event.data.object;

    switch (event.type) {
      case "checkout.session.completed": {
        const clinicId = obj.metadata && obj.metadata.clinicId;
        if (clinicId) {
          await prisma.clinic.update({
            where: { id: clinicId },
            data: { stripeSubscriptionId: obj.subscription, subscriptionStatus: "active" }
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const clinic = await prisma.clinic.findFirst({ where: { stripeSubscriptionId: obj.id } });
        if (clinic) {
          await prisma.clinic.update({ where: { id: clinic.id }, data: { subscriptionStatus: obj.status } });
        }
        break;
      }
      default:
        break; // ignore events we don't act on
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Error handling webhook event:", err);
    res.status(500).send("Webhook handler error");
  }
}

module.exports = { router, handleStripeWebhook };
