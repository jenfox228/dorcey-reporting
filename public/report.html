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

// ---- Per-tab access control -------------------------------------------------
// Each tab has its own column on rpt_users. is_admin now means ONE thing:
// "can manage users and mint sign-in links". It does NOT imply visibility of
// the Dashboard, Pulse, or Financials — that's what lets an operations admin
// exist who cannot see firm net income.
//
// Checked against the DB on every call rather than trusting whatever columns
// attachUser() happened to load, so a permission change takes effect on the
// user's very next request instead of whenever their session expires.

const TAB_COLUMNS = {
  admin:      "is_admin",
  dashboard:  "dashboard_access",
  pulse:      "pulse_access",
  financials: "fin_access",
  app:        "app_access",
  reports:    "report_access",
};

const TAB_PATHS = {
  admin:      "/admin",
  dashboard:  "/dashboard",
  pulse:      "/pulse",
  financials: "/financials",
  app:        "/app",
  reports:    "/reports",
};

async function canSee(user, tab) {
  if (!user) return false;
  const col = TAB_COLUMNS[tab];
  if (!col) return false;
  const { rows } = await pool.query(
    `SELECT ${col} AS ok FROM rpt_users WHERE id = $1 AND active = TRUE`,
    [user.id]
  );
  return !!rows[0]?.ok;
}

// Express guard for API routes. Usage: app.get("/x", requireUser, requireTab("pulse"), ...)
function requireTab(tab) {
  return async (req, res, next) => {
    if (await canSee(req.user, tab)) return next();
    res.status(403).json({ error: "forbidden" });
  };
}

// Every flag a user currently holds — used by the grant guardrail below.
async function accessFlagsFor(userId) {
  const { rows } = await pool.query(
    `SELECT is_admin, dashboard_access, pulse_access, fin_access,
            app_access, report_access
       FROM rpt_users WHERE id = $1`,
    [userId]
  );
  return rows[0] || {};
}

// ---- Where a person should land on sign-in ----------------------------------
// Attorneys and partners don't file their own numbers — their assistants do —
// so dropping everyone on the weekly form meant the people who only ever look
// at dashboards had to navigate away every single time.
//
// The role says where someone's work actually starts. If their role doesn't
// map (or they've been adjusted away from its preset), fall through to the
// first tab they genuinely hold. Somebody with no tabs at all still lands on
// the form, which is right — that IS their work.

const ROLE_HOME = {
  attorney:     "pulse",
  program_lead: "app",
  bookkeeper:   "financials",
  operations:   "dashboard",
  principal:    "pulse",
};

// Fallback order when the role gives no usable answer. Narrower, more
// role-defining tabs come first so the guess lands somewhere meaningful.
const HOME_FALLBACK = ["financials", "pulse", "dashboard", "app", "reports", "admin"];

async function homePathFor(userId) {
  const { rows } = await pool.query(
    `SELECT access_role, is_admin, dashboard_access, pulse_access,
            fin_access, app_access, report_access
       FROM rpt_users WHERE id = $1 AND active = TRUE`,
    [userId]
  );
  const u = rows[0];
  if (!u) return "/report";

  const can = {
    admin:      u.is_admin,
    dashboard:  u.dashboard_access,
    pulse:      u.pulse_access,
    financials: u.fin_access,
    app:        u.app_access,
    reports:    u.report_access,
  };

  const preferred = ROLE_HOME[u.access_role];
  if (preferred && can[preferred]) return TAB_PATHS[preferred];

  for (const tab of HOME_FALLBACK) {
    if (can[tab]) return TAB_PATHS[tab];
  }
  return "/report";
}

// Attorney code (JOD, MAS, …) a report user is pinned to. Someone with the
// leadership view (no code set) sees everyone.
async function attorneyCodeFor(user) {
  if (!user) return null;
  const { rows } = await pool.query(
    `SELECT attorney_code FROM rpt_users WHERE id = $1`,
    [user.id]
  );
  return (rows[0]?.attorney_code || "").trim().toUpperCase() || null;
}

// ---- Health ---------------------------------------------------------------

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---- Magic-link login -----------------------------------------------------
// Sets the session, then sends the person to wherever their work starts.

app.get("/login/:token", async (req, res) => {
  try {
    const user = await consumeMagicToken(req.params.token);
    if (!user) return res.status(401).send(loginError());
    res.cookie("dlf_session", makeSessionCookie(user.id), COOKIE_OPTS);
    const home = await homePathFor(user.id);
    if (home === "/report") {
      return res.sendFile(path.join(__dirname, "public", "report.html"));
    }
    res.redirect(home);
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

  // Which tabs this person can reach — lets report.html render a nav for the
  // handful of people who have one, and nothing at all for the other thirty.
  const flags = await accessFlagsFor(u.id);

  // A viewer record (admin_none) has no weekly form. The page uses this to
  // show a friendly "you have no numbers to file" panel instead of an empty
  // card with a Submit button that does nothing.
  const hasForm =
    u.template_key !== "admin_none" &&
    ((tpl.monday && tpl.monday.length) || (tpl.friday && tpl.friday.length));

  res.json({
    user: {
      name: u.name,
      person: u.person,
      location: u.location,
      template_key: u.template_key,
      is_admin: u.is_admin,
    },
    access: {
      admin:      !!flags.is_admin,
      dashboard:  !!flags.dashboard_access,
      pulse:      !!flags.pulse_access,
      financials: !!flags.fin_access,
      app:        !!flags.app_access,
      reports:    !!flags.report_access,
    },
    hasForm: !!hasForm,
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
// requireAdmin now gates exactly one capability: managing users. Seeing the
// Dashboard / Pulse / Financials is separate, per-tab.

app.get("/api/admin/users", requireUser, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, person, role, template_key, location,
            is_admin, active, access_role,
            dashboard_access, pulse_access, fin_access,
            app_access, report_access, attorney_code
       FROM rpt_users ORDER BY is_admin DESC, name ASC`
  );
  // The caller's own flags travel with the payload so the UI can grey out
  // any checkbox they aren't allowed to hand to someone else.
  const mine = await accessFlagsFor(req.user.id);
  res.json({
    users: rows,
    granter: {
      admin:      !!mine.is_admin,
      dashboard:  !!mine.dashboard_access,
      pulse:      !!mine.pulse_access,
      financials: !!mine.fin_access,
      app:        !!mine.app_access,
      reports:    !!mine.report_access,
    },
  });
});

app.get("/api/admin/templates", requireUser, requireAdmin, async (_req, res) => {
  // admin_none is offered explicitly: it's how you mark someone as a viewer
  // with no weekly form, which also drops them out of the compliance
  // dashboard's denominator. Sorted to the top so it's easy to find.
  const out = Object.entries(TEMPLATES)
    .filter(([key]) => key !== "admin_none")
    .map(([key, tpl]) => ({ key, label: tpl.label, family: tpl.family || "?" }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (TEMPLATES.admin_none) {
    out.unshift({
      key: "admin_none",
      label: "— Viewer only · no weekly form —",
      family: "Z",
    });
  }
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

  // Can't create someone more powerful than you are.
  if (admin) {
    const mine = await accessFlagsFor(req.user.id);
    if (!mine.is_admin) return res.status(403).json({ error: "cannot_grant_admin" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO rpt_users
        (name, email, person, template_key, location, is_admin, role, active, access_role)
       VALUES ($1, $2, $3, $4, $5, $6, 'reporter', TRUE, 'reporter')
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
//   - You cannot deactivate or demote the LAST remaining admin.
//   - You cannot GRANT an access level you do not hold yourself. Revoking is
//     always permitted — you can take away what you don't have, you just
//     can't hand it out. This is what makes "admin, but no financials" a real
//     boundary instead of a polite request.
//   - Template must be a known key.
app.post("/api/admin/update-user", requireUser, requireAdmin, async (req, res) => {
  const b = req.body || {};
  const id = parseInt(b.id, 10);
  if (!id) return res.status(400).json({ error: "id_required" });

  const mine = await accessFlagsFor(req.user.id);
  const theirs = await accessFlagsFor(id);
  if (!Object.keys(theirs).length) return res.status(404).json({ error: "no_user" });

  // The grant guardrail. Only fires when TURNING A FLAG ON that the person
  // making the change doesn't have.
  const GRANTABLE = [
    ["is_admin",         "is_admin",         "cannot_grant_admin"],
    ["dashboard_access", "dashboard_access", "cannot_grant_dashboard"],
    ["pulse_access",     "pulse_access",     "cannot_grant_pulse"],
    ["fin_access",       "fin_access",       "cannot_grant_financials"],
    ["app_access",       "app_access",       "cannot_grant_app"],
    ["report_access",    "report_access",    "cannot_grant_reports"],
  ];
  for (const [field, myCol, errCode] of GRANTABLE) {
    if (typeof b[field] === "boolean" && b[field] === true && !theirs[field] && !mine[myCol]) {
      return res.status(403).json({ error: errCode });
    }
  }

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
  if (typeof b.access_role === "string") {
    const v = b.access_role.trim();
    push("access_role", v.length ? v : null);
  }
  if (typeof b.is_admin === "boolean") {
    // Prevent self-demotion.
    if (id === req.user.id && !b.is_admin) {
      return res.status(400).json({ error: "cannot_demote_self" });
    }
    // Prevent removing the last admin standing.
    if (!b.is_admin && theirs.is_admin) {
      const { rows: cnt } = await pool.query(
        `SELECT count(*)::int AS n FROM rpt_users WHERE is_admin = TRUE AND active = TRUE`
      );
      if (cnt[0].n <= 1) return res.status(400).json({ error: "last_admin" });
    }
    push("is_admin", b.is_admin);
  }
  if (typeof b.dashboard_access === "boolean") push("dashboard_access", b.dashboard_access);
  if (typeof b.pulse_access === "boolean")     push("pulse_access", b.pulse_access);
  if (typeof b.fin_access === "boolean")       push("fin_access", b.fin_access);
  if (typeof b.app_access === "boolean")       push("app_access", b.app_access);
  if (typeof b.report_access === "boolean")    push("report_access", b.report_access);
  if (typeof b.attorney_code === "string") {
    const v = b.attorney_code.trim().toUpperCase();
    push("attorney_code", v.length ? v : null);
  }
  if (typeof b.active === "boolean") {
    // Prevent self-deactivation.
    if (id === req.user.id && !b.active) {
      return res.status(400).json({ error: "cannot_deactivate_self" });
    }
    // Prevent deactivating the last admin standing.
    if (!b.active && theirs.is_admin) {
      const { rows: cnt } = await pool.query(
        `SELECT count(*)::int AS n FROM rpt_users WHERE is_admin = TRUE AND active = TRUE`
      );
      if (cnt[0].n <= 1) return res.status(400).json({ error: "last_admin" });
    }
    push("active", b.active);
  }

  if (!sets.length) return res.status(400).json({ error: "nothing_to_update" });

  vals.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE rpt_users SET ${sets.join(", ")}
        WHERE id = $${vals.length}
        RETURNING id, name, email, person, template_key, location, is_admin, active,
                  access_role, dashboard_access, pulse_access, fin_access,
                  app_access, report_access, attorney_code`,
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
  // Where this link will actually land them, so the admin panel can say so.
  const home = await homePathFor(user_id);
  res.json({ url: `${appUrl(req)}/login/${token}`, home });
});

// Generic tab-link minter. Refuses to mint a link for a tab the target user
// can't actually open — otherwise you'd hand someone a URL that 403s.
function tabLinkRoute(tab, pathPrefix) {
  return async (req, res) => {
    const { user_id } = req.body || {};
    const { rows } = await pool.query(
      `SELECT id FROM rpt_users WHERE id = $1 AND active = TRUE`,
      [user_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "no_user" });
    if (!(await canSee({ id: user_id }, tab)))
      return res.status(400).json({ error: "no_access" });
    if (tab === "reports") {
      const { rows: rc } = await pool.query(
        `SELECT is_admin, attorney_code FROM rpt_users WHERE id = $1`,
        [user_id]
      );
      if (!rc[0].is_admin && !rc[0].attorney_code)
        return res.status(400).json({ error: "no_attorney_code" });
    }
    const token = await createMagicToken(user_id);
    res.json({ url: `${appUrl(req)}${pathPrefix}/${token}` });
  };
}

app.post("/api/admin/dashlink",   requireUser, requireAdmin, tabLinkRoute("dashboard",  "/dash"));
app.post("/api/admin/pulselink",  requireUser, requireAdmin, tabLinkRoute("pulse",      "/pulse"));
app.post("/api/admin/finlink",    requireUser, requireAdmin, tabLinkRoute("financials", "/financials"));
app.post("/api/admin/applink",    requireUser, requireAdmin, tabLinkRoute("app",        "/app"));
app.post("/api/admin/reportlink", requireUser, requireAdmin, tabLinkRoute("reports",    "/reports"));

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

app.get("/api/dashboard", requireUser, requireTab("dashboard"), async (req, res) => {
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

// ---- Revenue Pulse ---------------------------------------------------------

const TAB_2025_CANDIDATES = [
  "ONLY 2025 Clients",
  " ONLY 2025 Clients",
  " ONLY 2025 Clients ",
  "Only 2025 Clients",
];

app.get("/api/revenue-feed", requireUser, requireTab("pulse"), async (req, res) => {
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

// ---- Reports feed (security boundary) --------------------------------------
// Wraps the revenue feed and enforces per-attorney isolation SERVER-SIDE.
// A pinned attorney receives ONLY their own rows plus {pinned:"CODE"} — their
// browser never holds anyone else's data, so no URL/console trick can leak it.

async function sendFilteredReports(res, user, data) {
  const code = await attorneyCodeFor(user); // null = leadership view
  res.set("Cache-Control", "no-store");
  if (!code) return res.json({ ...data, pinned: null });

  const key = (s) => String(s || "").trim().toUpperCase();
  const rows = Array.isArray(data.entries) ? data.entries
             : Array.isArray(data.rows) ? data.rows : [];
  const mine = rows.filter((row) => {
    const o = key(row["Originating Attorney"] ?? row["Originating Attorney "]);
    const c = key(row["Closing Attorney"] ?? row["Closing Attorney "]);
    return o === code || c === code;
  });
  const out = Array.isArray(data.entries) ? { entries: mine } : { rows: mine };
  res.json({ ...out, pinned: code });
}

app.get("/api/reports-feed", requireUser, requireTab("reports"), async (req, res) => {
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
        const d = await r.json();
        if (d && !d.error) return sendFilteredReports(res, req.user, d);
      }
      return res.status(502).json({ error: "tab_2025_not_found" });
    }

    const r = await fetch(`${url}${bust}_=${Date.now()}`, { redirect: "follow" });
    if (!r.ok) return res.status(502).json({ error: "feed_unreachable" });
    const data = await r.json();
    return sendFilteredReports(res, req.user, data);
  } catch (e) {
    console.error("reports feed error", e);
    res.status(502).json({ error: "feed_error" });
  }
});

// ---- APP Pulse feeds --------------------------------------------------------

app.get("/api/app-feed", requireUser, requireTab("app"), async (req, res) => {
  try {
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

// Renewal money — served by the Apps Script on the APP Invoicing Spreadsheet.
app.get("/api/app-invoice-feed", requireUser, requireTab("app"), async (req, res) => {
  try {
    const url = process.env.APP_INVOICE_FEED_URL;
    if (!url) return res.status(500).json({ error: "feed_not_configured" });
    const bust = url.includes("?") ? "&" : "?";
    const r = await fetch(`${url}${bust}_=${Date.now()}`, { redirect: "follow" });
    if (!r.ok) return res.status(502).json({ error: "feed_unreachable" });
    const data = await r.json();
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (e) {
    console.error("app invoice feed error", e);
    res.status(502).json({ error: "feed_error" });
  }
});

// ---- Financial summary (bookkeeper → QuickBooks figures) --------------------
// Gated on fin_access, NOT on is_admin — that separation is the whole point.
// These numbers come from QuickBooks and live only in Postgres, so they are
// never exposed to anyone with client-sheet access.
//
// One row per reporting month, keyed on the first of that month. Re-saving a
// month updates it in place rather than creating a duplicate.

// Metric keys the form is allowed to store. Anything else is ignored, so a
// stray field can't bloat the row. Add a key here when you add a form field.
const FIN_FIELDS = new Set([
  "rev_delta", "rev_pct", "k1", "total_delta", "total_pct",
  "share", "due", "full_pct",
  "ni", "ni_margin", "ni_yoy", "insurance", "ni_adj", "ni_full",
  "expected", "qb_actual", "variance", "variance_pct",
]);

app.get("/api/financials", requireUser, requireTab("financials"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.period::text AS period,
              f.report_date,
              f.data,
              f.notes,
              f.updated_at,
              u.name AS updated_by_name
         FROM rpt_financials f
         LEFT JOIN rpt_users u ON u.id = f.updated_by
        ORDER BY f.period DESC
        LIMIT 24`
    );
    res.set("Cache-Control", "no-store");
    res.json({ latest: rows[0] || null, periods: rows });
  } catch (e) {
    console.error("financials read error", e);
    res.status(500).json({ error: "read_failed" });
  }
});

app.post("/api/financials", requireUser, requireTab("financials"), async (req, res) => {
  const b = req.body || {};
  const period = String(b.period || "").trim(); // expects "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(period))
    return res.status(400).json({ error: "bad_period" });

  const periodDate = `${period}-01`;
  const reportDate =
    typeof b.report_date === "string" ? b.report_date.trim().slice(0, 60) || null : null;
  const notes = typeof b.notes === "string" ? b.notes.slice(0, 8000) : null;

  const data = {};
  for (const [k, v] of Object.entries(b.data || {})) {
    if (!FIN_FIELDS.has(k)) continue;
    if (v === "" || v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isFinite(n)) data[k] = n;
  }

  try {
    await pool.query(
      `INSERT INTO rpt_financials (period, report_date, data, notes, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (period) DO UPDATE
         SET report_date = EXCLUDED.report_date,
             data        = EXCLUDED.data,
             notes       = EXCLUDED.notes,
             updated_by  = EXCLUDED.updated_by,
             updated_at  = now()`,
      [periodDate, reportDate, JSON.stringify(data), notes, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("financials write error", e);
    res.status(500).json({ error: "write_failed" });
  }
});

// ---- Page routes ----------------------------------------------------------
// Each gated page has two doors: the plain path (uses an existing session)
// and a /:token path (magic link, sets the session then serves the page).

app.get("/report", (req, res) => {
  if (!req.user) return res.status(401).send(loginError());
  res.sendFile(path.join(__dirname, "public", "report.html"));
});

function pageRoute(tab, file) {
  return async (req, res) => {
    if (!(await canSee(req.user, tab))) return res.status(403).send(loginError());
    res.sendFile(path.join(__dirname, "public", file));
  };
}

function tokenPageRoute(tab, file) {
  return async (req, res) => {
    try {
      const user = await consumeMagicToken(req.params.token);
      if (!user || !(await canSee(user, tab)))
        return res.status(401).send(loginError());
      res.cookie("dlf_session", makeSessionCookie(user.id), COOKIE_OPTS);
      res.sendFile(path.join(__dirname, "public", file));
    } catch (e) {
      console.error(`${tab} login error`, e);
      res.status(500).send(loginError());
    }
  };
}

app.get("/admin",             pageRoute("admin",      "admin.html"));
app.get("/dashboard",         pageRoute("dashboard",  "dashboard.html"));
app.get("/pulse",             pageRoute("pulse",      "pulse.html"));
app.get("/financials",        pageRoute("financials", "financials.html"));
app.get("/app",               pageRoute("app",        "app.html"));
app.get("/reports",           pageRoute("reports",    "reports.html"));

app.get("/dash/:token",       tokenPageRoute("dashboard",  "dashboard.html"));
app.get("/pulse/:token",      tokenPageRoute("pulse",      "pulse.html"));
app.get("/financials/:token", tokenPageRoute("financials", "financials.html"));
app.get("/app/:token",        tokenPageRoute("app",        "app.html"));
app.get("/reports/:token",    tokenPageRoute("reports",    "reports.html"));

// Root sends a signed-in person wherever their work starts.
app.get("/", async (req, res) => {
  if (!req.user) return res.redirect("/report");
  const home = await homePathFor(req.user.id);
  res.redirect(home);
});

function loginError() {
  return `<!doctype html><meta charset="utf-8">
  <body style="font-family:Georgia,serif;background:#0f1f3a;color:#f5f1e6;
  display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
  <div><h1 style="color:#c9a14a">Link expired</h1>
  <p>This sign-in link is no longer valid, or you don't have access to that page.<br>
  Ask Jen for a fresh one.</p></div></body>`;
}

// ---- Boot -----------------------------------------------------------------

const PORT = process.env.PORT || 3000;
initSchema()
  .then(() => app.listen(PORT, () => console.log(`Reporting app on :${PORT}`)))
  .catch((e) => {
    console.error("Failed to init schema", e);
    process.exit(1);
  });
