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

function weekMonday(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}

function suggestedPeriod(d = new Date()) {
  const day = d.getDay();
  return day >= 1 && day <= 3 ? "M" : "F";
}

function appUrl(req) {
  return (
    process.env.APP_URL ||
    `${req.headers["x-forwarded-proto"] || req.protocol}://${req.get("host")}`
  );
}

function lastNWeeks(n = 8) {
  const [y, m, d] = weekMonday().split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(base - i * 7 * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function lastNWeeksEnding(n, isoMonday) {
  const [y, m, d] = isoMonday.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(base - i * 7 * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function weekMinus(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - n * 7 * 86400000).toISOString().slice(0, 10);
}

function sumNumeric(obj) {
  let s = 0;
  for (const v of Object.values(obj || {})) {
    if (typeof v === "number") s += v;
    else if (typeof v === "string" && v.trim() !== "" && !isNaN(+v)) s += +v;
  }
  return s;
}

function fieldDetail(templateKey, period, data) {
  return fieldsFor(templateKey, period).map((f) => ({
    label: f.label,
    value: data?.[f.key] ?? (f.type === "text" ? "" : 0),
  }));
}

// ---- APP-access helper ------------------------------------------------------
// Admins can see everything. Non-admins can see /app only if their
// app_access flag is set. Checked against the DB directly so it works
// no matter which columns attachUser() loads onto req.user.

async function hasAppAccess(user) {
  if (!user) return false;
  if (user.is_admin) return true;
  const { rows } = await pool.query(
    `SELECT app_access FROM rpt_users WHERE id = $1 AND active = TRUE`,
    [user.id]
  );
  return !!rows[0]?.app_access;
}

// ---- Health ---------------------------------------------------------------

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---- Magic-link login -----------------------------------------------------

app.get("/login/:token", async (req, res) => {
  try {
    const user = await consumeMagicToken(req.params.token);
    if (!user) return res.status(401).send(loginError());
    res.cookie("dlf_session", makeSessionCookie(user.id), COOKIE_OPTS);
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
  const lastWeek = weekMinus(thisWeek, 1);

  const { rows: cur } = await pool.query(
    `SELECT period_type, data FROM rpt_submissions
      WHERE user_id = $1 AND week_of = $2`,
    [u.id, thisWeek]
  );
  const existing = {};
  for (const r of cur) existing[r.period_type] = r.data;

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

  const { rows: wkRows } = await pool.query(
    `SELECT DISTINCT week_of::text AS w FROM rpt_submissions WHERE user_id = $1`,
    [u.id]
  );
  const reportedWeeks = new Set(wkRows.map((r) => r.w));
  let streak = 0;
  let probe = weekMinus(thisWeek, 1);
  while (reportedWeeks.has(probe)) {
    streak++;
    probe = weekMinus(probe, 1);
  }

  const missedLastWeek = !reportedWeeks.has(lastWeek);

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
    streak,
    missedLastWeek,
    lastWeek,
  });
});

app.post("/api/submit", requireUser, async (req, res) => {
  const { period, data } = req.body || {};
  if (!["M", "F"].includes(period))
    return res.status(400).json({ error: "bad_period" });

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

// ---- Past-week editing (last 2 weeks only) --------------------------------

app.get("/api/past-weeks", requireUser, async (req, res) => {
  const u = req.user;
  const tpl = TEMPLATES[u.template_key];
  if (!tpl) return res.status(500).json({ error: "unknown_template" });

  const thisWeek = weekMonday();
  const weeks = [weekMinus(thisWeek, 1), weekMinus(thisWeek, 2)];
  const earliest = weeks[weeks.length - 1];

  const { rows } = await pool.query(
    `SELECT period_type, week_of::text AS week_of, data
       FROM rpt_submissions
      WHERE user_id = $1 AND week_of >= $2 AND week_of < $3`,
    [u.id, earliest, thisWeek]
  );
  const byKey = {};
  for (const r of rows) byKey[`${r.week_of}|${r.period_type}`] = r.data;

  const out = weeks.map((w) => ({
    week: w,
    M: { existing: byKey[`${w}|M`] || null },
    F: { existing: byKey[`${w}|F`] || null },
  }));

  res.json({
    template: { label: tpl.label, monday: tpl.monday, friday: tpl.friday },
    weeks: out,
  });
});

app.post("/api/submit-past", requireUser, async (req, res) => {
  const u = req.user;
  const { week, period, data } = req.body || {};

  if (!["M", "F"].includes(period))
    return res.status(400).json({ error: "bad_period" });
  if (typeof week !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(week))
    return res.status(400).json({ error: "bad_week" });

  const thisWeek = weekMonday();
  const earliest = weekMinus(thisWeek, 2);
  if (week >= thisWeek || week < earliest)
    return res.status(400).json({ error: "week_out_of_range" });

  const allowed = new Set(fieldsFor(u.template_key, period).map((f) => f.key));
  const clean = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (allowed.has(k)) clean[k] = v;
  }

  const { rows: before } = await pool.query(
    `SELECT data FROM rpt_submissions
      WHERE user_id = $1 AND period_type = $2 AND week_of = $3`,
    [u.id, period, week]
  );
  const dataBefore = before[0]?.data || null;
  const action = dataBefore === null ? "backfill" : "edit";

  await pool.query(
    `INSERT INTO rpt_submissions (user_id, template_key, period_type, week_of, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, period_type, week_of)
     DO UPDATE SET data = EXCLUDED.data, submitted_at = now()`,
    [u.id, u.template_key, period, week, JSON.stringify(clean)]
  );

  await pool.query(
    `INSERT INTO rpt_audit_log
       (user_id, edited_by_user_id, template_key, period_type, week_of,
        action, data_before, data_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      u.id,
      u.id,
      u.template_key,
      period,
      week,
      action,
      dataBefore === null ? null : JSON.stringify(dataBefore),
      JSON.stringify(clean),
    ]
  );

  res.json({ ok: true, action });
});

// ---- Admin API ------------------------------------------------------------

app.get("/api/admin/users", requireUser, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, person, role, template_key, location, is_admin, active, app_access
       FROM rpt_users ORDER BY is_admin DESC, name ASC`
  );
  res.json({ users: rows });
});

app.get("/api/admin/templates", requireUser, requireAdmin, async (_req, res) => {
  const out = Object.entries(TEMPLATES)
    .filter(([key]) => key !== "admin_none")
    .map(([key, tpl]) => ({ key, label: tpl.label, family: tpl.family || "?" }))
    .sort((a, b) => a.label.localeCompare(b.label));
  res.json({ templates: out });
});

app.post("/api/admin/create-user", requireUser, requireAdmin, async (req, res) => {
  const {
    name,
    email,
    person,
    template_key,
    location,
    is_admin,
  } = req.body || {};

  if (!name || typeof name !== "string" || name.trim().length < 2)
    return res.status(400).json({ error: "name_required" });
  if (!email || typeof email !== "string" || !email.includes("@"))
    return res.status(400).json({ error: "email_required" });
  if (!template_key || !TEMPLATES[template_key])
    return res.status(400).json({ error: "unknown_template" });

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPerson = (person || "").trim() || null;
  const cleanLocation = (location || "").trim() || null;
  const admin = !!is_admin;

  try {
    const { rows } = await pool.query(
      `INSERT INTO rpt_users
        (name, email, person, template_key, location, is_admin, role, active)
       VALUES ($1, $2, $3, $4, $5, $6, 'reporter', TRUE)
       RETURNING id, name, email, person, template_key, location, is_admin`,
      [cleanName, cleanEmail, cleanPerson, template_key, cleanLocation, admin]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "name_taken" });
    }
    console.error("create-user error", e);
    res.status(500).json({ error: "create_failed" });
  }
});

// Update an existing user. Any subset of fields can be sent; only sent fields
// are updated. `id` is required. Guardrails:
//   - Name must remain unique (409 name_taken on collision).
//   - You cannot demote yourself from admin (prevents locking yourself out).
//   - You cannot deactivate yourself (same reason).
//   - Template must be a known key.
app.post("/api/admin/update-user", requireUser, requireAdmin, async (req, res) => {
  const b = req.body || {};
  const id = parseInt(b.id, 10);
  if (!id) return res.status(400).json({ error: "id_required" });

  // Build the SET clause dynamically from what the client sent.
  const sets = [];
  const vals = [];
  const push = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };

  if (typeof b.name === "string") {
    const v = b.name.trim();
    if (v.length < 2) return res.status(400).json({ error: "name_required" });
    push("name", v);
  }
  if (typeof b.email === "string") {
    const v = b.email.trim().toLowerCase();
    if (!v.includes("@")) return res.status(400).json({ error: "email_required" });
    push("email", v);
  }
  if (typeof b.person === "string") {
    const v = b.person.trim();
    push("person", v.length ? v : null);
  }
  if (typeof b.template_key === "string") {
    if (!TEMPLATES[b.template_key]) return res.status(400).json({ error: "unknown_template" });
    push("template_key", b.template_key);
  }
  if (typeof b.location === "string") {
    const v = b.location.trim();
    push("location", v.length ? v : null);
  }
  if (typeof b.is_admin === "boolean") {
    // Prevent self-demotion.
    if (id === req.user.id && !b.is_admin) {
      return res.status(400).json({ error: "cannot_demote_self" });
    }
    push("is_admin", b.is_admin);
  }
  if (typeof b.app_access === "boolean") {
    push("app_access", b.app_access);
  }
  if (typeof b.active === "boolean") {
    // Prevent self-deactivation.
    if (id === req.user.id && !b.active) {
      return res.status(400).json({ error: "cannot_deactivate_self" });
    }
    push("active", b.active);
  }

  if (!sets.length) return res.status(400).json({ error: "nothing_to_update" });

  vals.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE rpt_users SET ${sets.join(", ")}
        WHERE id = $${vals.length}
        RETURNING id, name, email, person, template_key, location, is_admin, active, app_access`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: "no_user" });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "name_taken" });
    console.error("update-user error", e);
    res.status(500).json({ error: "update_failed" });
  }
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

// Generate a sign-in link straight to APP Pulse. Works for admins and for
// users whose app_access flag is set.
app.post("/api/admin/applink", requireUser, requireAdmin, async (req, res) => {
  const { user_id } = req.body || {};
  const { rows } = await pool.query(
    `SELECT id, is_admin, app_access FROM rpt_users WHERE id = $1 AND active = TRUE`,
    [user_id]
  );
  if (!rows[0]) return res.status(404).json({ error: "no_user" });
  if (!rows[0].is_admin && !rows[0].app_access)
    return res.status(400).json({ error: "no_app_access" });
  const token = await createMagicToken(user_id);
  res.json({ url: `${appUrl(req)}/app/${token}` });
});

app.get("/api/admin/audit-log", requireUser, requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const { rows } = await pool.query(
    `SELECT
       a.id,
       a.user_id,
       u.name        AS user_name,
       u.person      AS user_person,
       a.edited_by_user_id,
       e.name        AS editor_name,
       a.template_key,
       a.period_type,
       a.week_of::text AS week_of,
       a.action,
       a.data_before,
       a.data_after,
       a.edited_at
     FROM rpt_audit_log a
     JOIN rpt_users u ON u.id = a.user_id
     JOIN rpt_users e ON e.id = a.edited_by_user_id
     ORDER BY a.edited_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json({ entries: rows });
});

// ---- Dashboard API (leadership) -------------------------------------------

app.get("/api/dashboard", requireUser, requireAdmin, async (req, res) => {
  const requested = req.query.week;
  const isValidWeek = typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested);
  const anchor = isValidWeek ? requested : null;
  const weeks = anchor ? lastNWeeksEnding(8, anchor) : lastNWeeks(8);
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

// ---- Revenue Pulse (Jen & Josh only) ---------------------------------------

const TAB_2025_CANDIDATES = [
  "ONLY 2025 Clients",
  " ONLY 2025 Clients",
  " ONLY 2025 Clients ",
  "Only 2025 Clients",
];

app.get("/api/revenue-feed", requireUser, requireAdmin, async (req, res) => {
  try {
    const url = process.env.REVENUE_FEED_URL;
    if (!url) return res.status(500).json({ error: "feed_not_configured" });
    const bust = url.includes("?") ? "&" : "?";

    if (req.query.tab === "2025") {
      for (const name of TAB_2025_CANDIDATES) {
        const r = await fetch(
          `${url}${bust}tab=${encodeURIComponent(name)}&_=${Date.now()}`,
          { redirect: "follow" }
        );
        if (!r.ok) continue;
        const data = await r.json();
        if (data && !data.error) {
          res.set("Cache-Control", "no-store");
          return res.json(data);
        }
      }
      return res.status(502).json({ error: "tab_2025_not_found" });
    }

    const r = await fetch(`${url}${bust}_=${Date.now()}`, { redirect: "follow" });
    if (!r.ok) return res.status(502).json({ error: "feed_unreachable" });
    const data = await r.json();
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (e) {
    console.error("revenue feed error", e);
    res.status(502).json({ error: "feed_error" });
  }
});

// ---- APP Pulse feed (admins + app_access users) -----------------------------

app.get("/api/app-feed", requireUser, async (req, res) => {
  try {
    if (!(await hasAppAccess(req.user)))
      return res.status(403).json({ error: "forbidden" });
    const url = process.env.APP_FEED_URL;
    if (!url) return res.status(500).json({ error: "feed_not_configured" });
    const bust = url.includes("?") ? "&" : "?";
    const r = await fetch(`${url}${bust}_=${Date.now()}`, { redirect: "follow" });
    if (!r.ok) return res.status(502).json({ error: "feed_unreachable" });
    const data = await r.json();
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (e) {
    console.error("app feed error", e);
    res.status(502).json({ error: "feed_error" });
  }
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

app.get("/pulse", (req, res) => {
  if (!req.user?.is_admin) return res.status(403).send(loginError());
  res.sendFile(path.join(__dirname, "public", "pulse.html"));
});

app.get("/pulse/:token", async (req, res) => {
  try {
    const user = await consumeMagicToken(req.params.token);
    if (!user || !user.is_admin) return res.status(401).send(loginError());
    res.cookie("dlf_session", makeSessionCookie(user.id), COOKIE_OPTS);
    res.sendFile(path.join(__dirname, "public", "pulse.html"));
  } catch (e) {
    console.error("pulse login error", e);
    res.status(500).send(loginError());
  }
});

app.get("/app", async (req, res) => {
  if (!(await hasAppAccess(req.user))) return res.status(403).send(loginError());
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.get("/app/:token", async (req, res) => {
  try {
    const user = await consumeMagicToken(req.params.token);
    if (!user || !(await hasAppAccess(user)))
      return res.status(401).send(loginError());
    res.cookie("dlf_session", makeSessionCookie(user.id), COOKIE_OPTS);
    res.sendFile(path.join(__dirname, "public", "app.html"));
  } catch (e) {
    console.error("app login error", e);
    res.status(500).send(loginError());
  }
});

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
  .then(() =>
    pool.query(
      `ALTER TABLE rpt_users ADD COLUMN IF NOT EXISTS app_access BOOLEAN NOT NULL DEFAULT FALSE`
    )
  )
  .then(() => app.listen(PORT, () => console.log(`Reporting app on :${PORT}`)))
  .catch((e) => {
    console.error("Failed to init schema", e);
    process.exit(1);
  });
