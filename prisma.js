const { PrismaClient } = require("@prisma/client");

// Reuse one client across hot reloads in dev instead of opening a new
// connection pool on every file change.
const prisma = global.__vitapulsePrisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__vitapulsePrisma = prisma;

module.exports = prisma;
