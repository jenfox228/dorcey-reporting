// server.js — Dorcey weekly reporting app (sibling to the Estate AI platform).
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { pool, initSchema } from "./db.js";
import { TEMPLATES, fieldsFor } from "./config/templates.js";
import {
  createMagicToken,
  consumeMagicToken,
  makeSessionCookie,
  attachUser,
  requireUser,
  requireAdmin,
} from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(attachUser());
app.use(express.static(path.join(__dirname, "public")));

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 30 * 86400 * 1000,
};

// ---- Date helpers ---------------------------------------------------------

// Monday (YYYY-MM-DD) of the reporting week containing `d`.
function weekMonday(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}

function suggestedPeriod(d = new Date()) {
  const day = d.getDay(); // Mon-Wed -> forecast (M), Thu-Sun -> actuals (F)
  return day >= 1 && day <= 3 ? "M" : "F";
}

function appUrl(req) {
  return (
    process.env.APP_URL ||
    `${req.headers["x-forwarded-proto"] || req.protocol}://${req.get("host")}`
  );
}

// Last N reporting weeks (Monday YYYY-MM-DD), oldest -> newest. UTC-safe.
function lastNWeeks(n = 8) {
  const [y, m, d] = weekMonday().split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(base - i * 7 * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

// Sum the numeric values in a JSONB data object (ignores text fields).
function sumNumeric(obj) {
  let s = 0;
  for (const v of Object.values(obj || {})) {
    if (typeof v === "number") s += v;
    else if (typeof v === "string" && v.trim() !== "" && !isNaN(+v)) s += +v;
  }
  return s;
}

// Map a stored data object to labeled field rows using the template.
function fieldDetail(templateKey, period, data) {
  return fieldsFor(templateKey, period).map((f) => ({
    label: f.label,
    value: data?.[f.key] ?? (f.type === "text" ? "" : 0),
  }));
}

// ---- Health ---------------------------------------------------------------

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---- Magic-link login -----------------------------------------------------

app.get("/login/:token", async (req, res) => {
  try {
    const user = await consumeMagicToken(req.params.token);
    if (!user) return res.status(401).send(loginError());
    res.cookie("dlf_session", makeSessionCookie(user.id), COOKIE_OPTS);
    // Serve the form here (no redirect) so the URL stays the unique link —
    // bookmarking it re-opens THIS person's form every time, even if they
    // also use a second link for a different role.
    res.sendFile(path.join(__dirname, "public", "report.html"));
  } catch (e) {
    console.error("login error", e);
    res.status(500).send(loginError());
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("dlf_session");
  res.json({ ok: true });
});

// ---- Report data API ------------------------------------------------------

app.get("/api/me", requireUser, async (req, res) => {
  const u = req.user;
  const tpl = TEMPLATES[u.template_key];
  if (!tpl) return res.status(500).json({ error: "unknown_template" });

  const thisWeek = weekMonday();

  // Existing submissions for THIS week (so people can edit, not double-enter).
  const { rows: cur } = await pool.query(
    `SELECT period_type, data FROM rpt_submissions
      WHERE user_id = $1 AND week_of = $2`,
    [u.id, thisWeek]
  );
  const existing = {};
  for (const r of cur) existing[r.period_type] = r.data;

  // Most recent prior submission of each period type, for prefill.
  const prefill = {};
  for (const p of ["M", "F"]) {
    const { rows } = await pool.query(
      `SELECT data FROM rpt_submissions
        WHERE user_id = $1 AND period_type = $2 AND week_of < $3
        ORDER BY week_of DESC LIMIT 1`,
      [u.id, p, thisWeek]
    );
    prefill[p] = rows[0]?.data || {};
  }

  res.json({
    user: {
      name: u.name,
      person: u.person,
      location: u.location,
      template_key: u.template_key,
      is_admin: u.is_admin,
    },
    template: { label: tpl.label, monday: tpl.monday, friday: tpl.friday },
    weekOf: thisWeek,
    suggestedPeriod: suggestedPeriod(),
    prefill,
    existing,
  });
});

app.post("/api/submit", requireUser, async (req, res) => {
  const { period, data } = req.body || {};
  if (!["M", "F"].includes(period))
    return res.status(400).json({ error: "bad_period" });

  // Whitelist incoming keys against the template so nothing junk lands in DB.
  const allowed = new Set(fieldsFor(req.user.template_key, period).map((f) => f.key));
  const clean = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (allowed.has(k)) clean[k] = v;
  }

  await pool.query(
    `INSERT INTO rpt_submissions (user_id, template_key, period_type, week_of, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, period_type, week_of)
     DO UPDATE SET data = EXCLUDED.data, submitted_at = now()`,
    [req.user.id, req.user.template_key, period, weekMonday(), JSON.stringify(clean)]
  );
  res.json({ ok: true });
});

// ---- Admin API ------------------------------------------------------------

app.get("/api/admin/users", requireUser, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, template_key, location, is_admin, active
       FROM rpt_users ORDER BY is_admin DESC, name ASC`
  );
  res.json({ users: rows });
});

app.post("/api/admin/link", requireUser, requireAdmin, async (req, res) => {
  const { user_id } = req.body || {};
  const { rows } = await pool.query(
    `SELECT id FROM rpt_users WHERE id = $1 AND active = TRUE`,
    [user_id]
  );
  if (!rows[0]) return res.status(404).json({ error: "no_user" });
  const token = await createMagicToken(user_id);
  res.json({ url: `${appUrl(req)}/login/${token}` });
});

// A durable link that drops an admin straight onto the dashboard (for Josh).
app.post("/api/admin/dashlink", requireUser, requireAdmin, async (req, res) => {
  const { user_id } = req.body || {};
  const { rows } = await pool.query(
    `SELECT id, is_admin FROM rpt_users WHERE id = $1 AND active = TRUE`,
    [user_id]
  );
  if (!rows[0]) return res.status(404).json({ error: "no_user" });
  if (!rows[0].is_admin) return res.status(400).json({ error: "not_admin" });
  const token = await createMagicToken(user_id);
  res.json({ url: `${appUrl(req)}/dash/${token}` });
});

// ---- Dashboard API (leadership) -------------------------------------------

app.get("/api/dashboard", requireUser, requireAdmin, async (_req, res) => {
  const weeks = lastNWeeks(8);
  const earliest = weeks[0];
  const thisWeek = weeks[weeks.length - 1];

  const { rows: users } = await pool.query(
    `SELECT id, name, person, template_key, location FROM rpt_users
      WHERE active = TRUE AND template_key <> 'admin_none'
      ORDER BY name`
  );
  const { rows: subs } = await pool.query(
    `SELECT user_id, period_type, week_of::text AS week_of, data
       FROM rpt_submissions WHERE week_of >= $1`,
    [earliest]
  );

  const byUser = {};
  for (const s of subs) {
    (byUser[s.user_id] ??= {})[`${s.week_of}|${s.period_type}`] = s.data;
  }

  // All-time compliance: when did each person last report, and how many
  // distinct weeks total (looks back further than the 8-week window).
  const { rows: lastRep } = await pool.query(
    `SELECT user_id, max(week_of)::text AS last_week,
            count(DISTINCT week_of) AS weeks_reported
       FROM rpt_submissions GROUP BY user_id`
  );
  const compBy = {};
  for (const r of lastRep) compBy[r.user_id] = r;

  const out = users.map((u) => {
    const tpl = TEMPLATES[u.template_key] || { label: u.template_key, family: "?" };
    const cell = (wk, p) => byUser[u.id]?.[`${wk}|${p}`] || null;
    const history = weeks.map((wk) => ({
      week: wk,
      mTotal: sumNumeric(cell(wk, "M")),
      fTotal: sumNumeric(cell(wk, "F")),
      reported: !!cell(wk, "F") || !!cell(wk, "M"),
    }));
    const curM = cell(thisWeek, "M");
    const curF = cell(thisWeek, "F");
    return {
      name: u.name,
      person: u.person,
      location: u.location,
      family: tpl.family,
      templateLabel: tpl.label,
      thisWeek: {
        M: { submitted: !!curM, total: sumNumeric(curM), fields: curM ? fieldDetail(u.template_key, "M", curM) : [] },
        F: { submitted: !!curF, total: sumNumeric(curF), fields: curF ? fieldDetail(u.template_key, "F", curF) : [] },
      },
      history,
      lastReported: compBy[u.id]?.last_week || null,
      weeksReported: Number(compBy[u.id]?.weeks_reported || 0),
    };
  });

  res.json({ weeks, thisWeek, users: out });
});

// ---- Page routes ----------------------------------------------------------

app.get("/report", (req, res) => {
  if (!req.user) return res.status(401).send(loginError());
  res.sendFile(path.join(__dirname, "public", "report.html"));
});

app.get("/admin", (req, res) => {
  if (!req.user?.is_admin) return res.status(403).send(loginError());
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/dashboard", (req, res) => {
  if (!req.user?.is_admin) return res.status(403).send(loginError());
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Durable dashboard link (for Josh): sign in via token, land on the dashboard.
app.get("/dash/:token", async (req, res) => {
  try {
    const user = await consumeMagicToken(req.params.token);
    if (!user || !user.is_admin) return res.status(401).send(loginError());
    res.cookie("dlf_session", makeSessionCookie(user.id), COOKIE_OPTS);
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
  } catch (e) {
    console.error("dash login error", e);
    res.status(500).send(loginError());
  }
});

app.get("/", (req, res) => res.redirect(req.user ? "/report" : "/report"));

function loginError() {
  return `<!doctype html><meta charset="utf-8">
  <body style="font-family:Georgia,serif;background:#0f1f3a;color:#f5f1e6;
  display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
  <div><h1 style="color:#c9a14a">Link expired</h1>
  <p>This sign-in link is no longer valid. Ask Jen for a fresh one.</p></div></body>`;
}

// ---- Boot -----------------------------------------------------------------

const PORT = process.env.PORT || 3000;
initSchema()
  .then(() => app.listen(PORT, () => console.log(`Reporting app on :${PORT}`)))
  .catch((e) => {
    console.error("Failed to init schema", e);
    process.exit(1);
  });
