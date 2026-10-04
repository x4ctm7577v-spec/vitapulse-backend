const jwt = require("jsonwebtoken");

// Every protected route runs this first. It reads the "Authorization: Bearer <token>"
// header, verifies it, and attaches req.userId / req.clinicId / req.role — every
// other route then filters its database queries by req.clinicId, which is what
// keeps one clinic from ever seeing another clinic's patients.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.clinicId = payload.clinicId;
    req.role = payload.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Optional extra gate for owner-only actions (e.g. inviting teammates,
// starting checkout). Use after requireAuth: requireRole("owner")
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.role)) {
      return res.status(403).json({ error: "Not allowed for your role" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
