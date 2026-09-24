# VitaPulse API

A real, multi-tenant backend for VitaPulse: one Postgres database safely
serves many separate clinics, with practitioner login, per-seat Stripe
billing at $140/practitioner/month, and the same resources as the demo app
(patients, appointments, prescriptions, forms, labs, charges).

This is a **starting point**, not a finished, HIPAA-certified product — see
"What this is not" at the bottom before you put real patient data in it.

## 1. Set up

```bash
npm install
cp .env.example .env
# then fill in .env — see the comments in that file for where each value comes from
npx prisma migrate dev --name init
npm run dev
```

You'll need a Postgres database. The fastest way to get one for free while
testing: [Neon](https://neon.tech) or [Supabase](https://supabase.com) both
give you a `DATABASE_URL` in about a minute. For production, any managed
Postgres (RDS, Railway, Render, Supabase) works.

## 2. Try it

```bash
# Create the first clinic — this person becomes its "owner" (manager)
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"clinicName":"Riverside Family Medicine","name":"Dr. Maya Torres","email":"maya@example.com","password":"a-strong-password"}'

# -> returns { token, user, clinic }. Use that token for everything else:
curl http://localhost:4000/patients \
  -H "Authorization: Bearer <token>"

# Invite a teammate into the SAME clinic, same access:
curl -X POST http://localhost:4000/auth/invite \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Jordan Reyes","email":"jordan@example.com","password":"another-strong-password","role":"practitioner"}'
```

## 3. Set up billing

1. In your [Stripe dashboard](https://dashboard.stripe.com), create a
   Product ("VitaPulse — Practitioner seat") with a **recurring monthly
   Price of $140**. Copy its Price ID into `STRIPE_PRICE_ID`.
2. Add a webhook endpoint pointing at `https://yourdomain.com/billing/webhook`,
   listening for `checkout.session.completed`, `customer.subscription.updated`,
   and `customer.subscription.deleted`. Copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`.
3. From your frontend, call `POST /billing/create-checkout-session` (as the
   clinic owner) and redirect the browser to the `url` it returns — that's a
   normal Stripe Checkout page. Billing quantity is set automatically to the
   clinic's current number of users, so it scales as they add teammates.

## 4. Deploying

Any Node host works — Railway, Render, Fly.io, a VPS. Rough shape:

- Deploy this API somewhere with `DATABASE_URL`, `JWT_SECRET`, and the Stripe
  vars set as environment secrets (never commit `.env`).
- Run `npx prisma migrate deploy` once against the production database.
- Point your frontend's API calls at the deployed URL.

## 5. Connecting the existing VitaPulse interface

The Claude-artifact version of VitaPulse read and wrote data through
`window.claude`'s built-in shared database. A real frontend talks to this
API instead. The shape of the data is the same — only how you fetch/save it
changes. For example, loading patients:

```js
// Before (Claude artifact):
dbApi.collection("patients").onSnapshot(function (snap) {
  state.patients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderPatients();
});

// After (this API):
fetch("https://your-api.com/patients", {
  headers: { Authorization: "Bearer " + token }
})
  .then(r => r.json())
  .then(patients => { state.patients = patients; renderPatients(); });
```

Creating a record follows the same pattern — swap `writeDoc("patients", id, data)`
for `fetch(".../patients", { method: "POST", headers: {...}, body: JSON.stringify(data) })`.
There's no live `onSnapshot` push here; poll on an interval, refetch after
your own writes, or add a WebSocket layer later if real-time matters enough
to build.

Login replaces the old "whoever Claude says you are": call `POST /auth/login`,
store the returned `token` (e.g. in `localStorage`), and send it as
`Authorization: Bearer <token>` on every request after that.

## What this is not

- **Not HIPAA-certified.** Getting there needs a signed Business Associate
  Agreement with your hosting/database provider, encryption at rest and in
  transit (most managed Postgres does this by default, but confirm it),
  audit logging of who accessed what, and a written security policy. Talk to
  a healthcare compliance advisor before onboarding a real clinic's real
  patient data.
- **Not connected to any real pharmacy.** The `pharmacy` field on a
  prescription is just text you store — see the earlier conversation about
  Surescripts/EPCS if you want that to be real.
- **No tests yet.** Worth adding before you rely on this for paying
  customers.
