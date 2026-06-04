// auth.js — magic-link tokens + lightweight signed session cookies.
// No passwords anywhere. People get a one-tap link; verifying it sets a
// signed, httpOnly session cookie good for 30 days so they don't re-auth
// every report.

import crypto from "crypto";
import { pool } from "./db.js";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-only-change-me-in-render-env";
const SESSION_DAYS = 30;
const TOKEN_TTL_HOURS = 72; // magic links stay valid 3 days

// ---- Magic links ----------------------------------------------------------

export async function createMagicToken(userId) {
  const token = crypto.randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);
  await pool.query(
    `INSERT INTO rpt_magic_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expires]
  );
  return token;
}

// Consumes a magic token. Returns the user row or null.
export async function consumeMagicToken(token) {
  const { rows } = await pool.query(
    `SELECT t.id AS token_id, t.expires_at, t.used_at, u.*
       FROM rpt_magic_tokens t
       JOIN rpt_users u ON u.id = t.user_id
      WHERE t.token = $1`,
    [token]
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null; // expired by time only
  if (!row.active) return null;
  // Reusable until expiry: link-preview bots / multiple taps won't "burn" it.
  // Record first use for audit, but never block re-use within the window.
  if (!row.used_at) {
    await pool.query(`UPDATE rpt_magic_tokens SET used_at = now() WHERE id = $1`, [
      row.token_id,
    ]);
  }
  return row;
}

// ---- Session cookie (HMAC-signed, no session table needed) ----------------

function sign(value) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

export function makeSessionCookie(userId) {
  const exp = Date.now() + SESSION_DAYS * 86400 * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionCookie(cookie) {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (sign(`${userId}.${exp}`) !== sig) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(userId);
}

// Express middleware: attaches req.user (or null) from the session cookie.
export function attachUser() {
  return async (req, _res, next) => {
    req.user = null;
    const uid = readSessionCookie(req.cookies?.dlf_session);
    if (uid) {
      const { rows } = await pool.query(
        `SELECT * FROM rpt_users WHERE id = $1 AND active = TRUE`,
        [uid]
      );
      req.user = rows[0] || null;
    }
    next();
  };
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "not_authenticated" });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin)
    return res.status(403).json({ error: "admin_only" });
  next();
}
