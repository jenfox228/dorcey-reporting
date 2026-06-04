# Dorcey Weekly Reporting

A lightweight, mobile-first weekly reporting app for Dorcey Law Firm. People get
a one-tap magic link, land straight on **their own** form pre-filled with last
week's numbers, and submit in under a minute. Data lands in PostgreSQL, ready for
the live per-attorney / per-department dashboard (next build).

Runs as a **sibling app** to the Estate AI platform: same stack (Node + Express +
Postgres on Render), same database, but every table is namespaced `rpt_*` so the
internal performance numbers stay walled off from the client-document side.

## What's here

```
server.js            Express app — auth, report API, admin API, page routes
db.js                Postgres pool + schema bootstrap (rpt_users, rpt_magic_tokens, rpt_submissions)
auth.js              Magic-link tokens + signed session cookies (no passwords)
config/templates.js  THE field definitions — edit forms here, never the database
seed.js              Inserts the team roster + prints a bootstrap sign-in link
public/report.html   The mobile form people actually fill out
public/admin.html    Generate/copy magic links per person
```

## Deploy to Render (first time)

1. Push this folder to a **new GitHub repo** (separate from the Estate AI repo).
2. In Render: **New → Web Service**, point it at the repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Add environment variables (see `.env.example`):
   - `DATABASE_URL` — same Postgres instance as the Estate AI app
   - `SESSION_SECRET` — a long random string
   - `APP_URL` — the service's public URL (e.g. `https://dorcey-reporting.onrender.com`)
4. Deploy. The schema auto-creates on first boot.
5. Open a **Shell** on the service and run: `node seed.js`
   - It seeds the team and prints a sign-in link for Jen. Open that link.
6. Go to `/admin`, generate links for everyone else, and text/email them out.

## How reporting works

- **Monday = Forecast**, **Friday = Actuals.** The form auto-picks based on the day,
  and people can flip the toggle.
- Each person only ever sees **their** fields (one of four template families).
- Numbers pre-fill from last week, so it's edit-not-retype.
- Submitting shows an instant "vs last week" snapshot — the feedback loop that
  keeps people coming back.

## Editing the forms

Open `config/templates.js`. Fields are plain objects. Add, remove, relabel —
no database migration needed, because submissions store a flexible JSONB payload.
Anything tagged `// VERIFY` is reconstructed from the April mapping and should be
checked against the live Google Form. Still-uncollected sections from April:
**Joe, Marketing, Operations, HR, Binders, Probate Global Drafting.**

## Still to build

- Live per-attorney / per-department dashboard reading off `rpt_submissions`
- Automated link delivery (email/Teams) so admin link-copying becomes the fallback
- The six uncollected department templates
- Philippines (Global) teams: schedule their reminders to local morning
