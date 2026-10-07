// Records are stamped with a "YYYY-MM-DD" date. The browser sends the clinic's
// local date; if it's missing or not a real calendar date we fall back to the
// server's (UTC) date. Without this, anything saved in the evening in the US
// would be stamped with tomorrow's date.
function pickDate(clientDate) {
  if (typeof clientDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    const d = new Date(clientDate + "T00:00:00Z");
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === clientDate) return clientDate;
  }
  return new Date().toISOString().slice(0, 10);
}

module.exports = { pickDate };
