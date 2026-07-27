// db.js — Postgres connection pool + schema bootstrap.
// Reuses the same Render PostgreSQL instance as the Estate AI platform,
// but every table here is namespaced with rpt_ so the reporting data
// stays cleanly separated from the client-document side.
import pg from "pg";
const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's managed Postgres requires SSL; relax cert checking the same
  // way the Estate AI app does.
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});
// Creates tables if they don't exist. Safe to run on every boot.
export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rpt_users (
      id            SERIAL PRIMARY KEY,
      name          TEXT UNIQUE NOT NULL,
      email         TEXT NOT NULL,
      notify_email  TEXT,
      person        TEXT,
      role          TEXT NOT NULL DEFAULT 'reporter',
      template_key  TEXT NOT NULL,
      location      TEXT,
      is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
      active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS rpt_magic_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES rpt_users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ
    );
    -- One row per person, per reporting period (Monday "M" or Friday "F"),
    -- per week. The JSONB payload holds whatever fields that person's
    -- template defines, so adding/changing fields never requires a migration.
    CREATE TABLE IF NOT EXISTS rpt_submissions (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES rpt_users(id) ON DELETE CASCADE,
      template_key TEXT NOT NULL,
      period_type  TEXT NOT NULL CHECK (period_type IN ('M','F')),
      week_of      DATE NOT NULL,
      data         JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, period_type, week_of)
    );
    CREATE INDEX IF NOT EXISTS rpt_submissions_week_idx
      ON rpt_submissions (week_of);
    -- Audit log for past-week edits + backfills. One row per save action
    -- that touched a previous week. Captures before/after snapshots so we
    -- can always reconstruct what changed and when.
    --   action = 'backfill' (no prior submission for that week)
    --          | 'edit'     (overwrote an existing submission)
    --   edited_by_user_id = who made the change (often same as user_id, but
    --                       could be an admin editing someone else's data)
    --   data_before / data_after = JSONB snapshots; data_before is NULL for
    --                              backfills since there was nothing there.
    CREATE TABLE IF NOT EXISTS rpt_audit_log (
      id                 SERIAL PRIMARY KEY,
      user_id            INTEGER NOT NULL REFERENCES rpt_users(id) ON DELETE CASCADE,
      edited_by_user_id  INTEGER NOT NULL REFERENCES rpt_users(id) ON DELETE CASCADE,
      template_key       TEXT NOT NULL,
      period_type        TEXT NOT NULL CHECK (period_type IN ('M','F')),
      week_of            DATE NOT NULL,
      action             TEXT NOT NULL CHECK (action IN ('backfill','edit')),
      data_before        JSONB,
      data_after         JSONB NOT NULL,
      edited_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS rpt_audit_log_user_idx
      ON rpt_audit_log (user_id, week_of DESC);
    CREATE INDEX IF NOT EXISTS rpt_audit_log_when_idx
      ON rpt_audit_log (edited_at DESC);

    -- Bookkeeper's monthly financial summary. Sourced from QuickBooks, NOT
    -- from the client-tracking Google Sheet — these figures are admin-only
    -- and never touch the shared spreadsheet.
    --   period  = first of the reporting month (2026-06-01 = "through June")
    --   data    = JSONB of the metrics, so adding a figure later is a form
    --             change rather than a migration
    --   notes   = her narrative commentary, shown verbatim on the Pulse
    CREATE TABLE IF NOT EXISTS rpt_financials (
      id            SERIAL PRIMARY KEY,
      period        DATE NOT NULL UNIQUE,
      report_date   TEXT,
      data          JSONB NOT NULL DEFAULT '{}'::jsonb,
      notes         TEXT,
      updated_by    INTEGER REFERENCES rpt_users(id) ON DELETE SET NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS rpt_financials_period_idx
      ON rpt_financials (period DESC);

    -- Backfill the contact-email column on tables created before it existed.
    ALTER TABLE rpt_users ADD COLUMN IF NOT EXISTS notify_email TEXT;
    ALTER TABLE rpt_users ADD COLUMN IF NOT EXISTS person TEXT;
    -- Migrate existing databases: one person can own several reporting roles,
    -- so email must NOT be unique; the role NAME is the unique identity instead.
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rpt_users_email_key') THEN
        ALTER TABLE rpt_users DROP CONSTRAINT rpt_users_email_key;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rpt_users_name_key') THEN
        ALTER TABLE rpt_users ADD CONSTRAINT rpt_users_name_key UNIQUE (name);
      END IF;
    END $$;
  `);
}
