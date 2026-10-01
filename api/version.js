// api/version.js
// Returns an identifier that's stable for the lifetime of one deployment
// and changes automatically on the next one — no manual version bump
// needed. Vercel populates VERCEL_GIT_COMMIT_SHA (and friends) in every
// serverless function's environment at build/runtime for Git-connected
// projects, so this requires zero upkeep going forward.
//
// Polled by split/boot.js on every app launch (always no-store, so this
// response itself is never what's stale) to detect that a newer version
// has shipped and force a reload — this is what lets an "Add to Home
// Screen" shortcut on iOS pick up updates instead of being stuck showing
// whatever was cached the day it was added.
//
// Usage: GET /api/version

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const id =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    "dev";

  return res.status(200).json({ id });
}
