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
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      email        TEXT UNIQUE NOT NULL,
      role         TEXT NOT NULL DEFAULT 'reporter',
      template_key TEXT NOT NULL,
      location     TEXT,
      is_admin     BOOLEAN NOT NULL DEFAULT FALSE,
      active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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
  `);
}
