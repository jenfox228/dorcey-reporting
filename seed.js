// seed.js — inserts/updates the team roster with real emails, then prints a
// fresh admin sign-in link. Safe to re-run anytime: it matches people by
// NAME and updates them in place (never duplicates, never touches links or
// submissions).
//   Run on Render via the Shell:  node seed.js
import { pool, initSchema } from "./db.js";
import { createMagicToken } from "./auth.js";

// Department/role -> the person who fills it + their real email.
// notify_email = optional second recipient (e.g., Probate is Kait AND Ellie).
// Two "unsure" roles (Brian, Joe) keep placeholders until someone is assigned.
const TEAM = [
  // --- Admins ---
  { name: "Jen Fox",      person: "Jen",     email: "jen.fox@dorceylaw.com",  template_key: "admin_none",  is_admin: true },
  { name: "Josh Dorcey",  person: "Marissa", email: "msilva@dorceylaw.com",   template_key: "attorney_ep", is_admin: true, location: "Fort Myers HQ" },
  { name: "Mike Scott",   person: "Bianca",  email: "bgonzalez@dorceylaw.com", template_key: "attorney_ep", is_admin: true, location: "LaBelle" },

  // --- Estate Planning attorneys ---
  { name: "Erica Johnson", person: "Amanda", email: "alebert@dorceylaw.com", template_key: "attorney_ep", location: "Fort Myers HQ" },
  { name: "Kara Sajdak",   person: "Lexi",   email: "aking@dorceylaw.com",   template_key: "attorney_ep", location: "Naples / Marco Island" },
  { name: "Joe LoTempio",  person: null,     email: "joe.lotempio@dorceylaw.com", template_key: "attorney_ep", location: "Fort Myers HQ" }, // TODO assign

  // --- Real Estate attorney ---
  { name: "Brad Butcher",  person: "Carri",  email: "cwoodcraft@dorceylaw.com", template_key: "attorney_realestate", location: "Fort Myers HQ" },

  // --- Probate / TA specialists ---
  { name: "Doug Dodson",     person: "Arlethys", email: "ADiazFelipe@dorceylaw.com", template_key: "probate_specialist" },
  { name: "Brian Bronsther", person: null,       email: "brian.bronsther@dorceylaw.com", template_key: "probate_specialist" }, // TODO assign

  // --- Operational departments ---
  { name: "File Creation",        person: "Kayla",        email: "krenaud@dorceylaw.com",  template_key: "op_file_creation" },
  { name: "Processed Funding",    person: "Alyse",        email: "abowes@dorceylaw.com",   template_key: "op_processed_funding" },
  { name: "Business Planning",    person: "Michael",      email: "MVillagracia@dorceylaw.com", template_key: "op_business_planning" },
  { name: "Drafting",             person: "Amanda",       email: "alebert@dorceylaw.com",  template_key: "op_drafting" },
  { name: "APP Funding",          person: "Mariela",      email: "mpena@dorceylaw.com",    template_key: "op_app_funding" },
  { name: "Drafting Funding",     person: "Cherrian",     email: "cconnell@dorceylaw.com", template_key: "op_drafting_funding" },
  { name: "Deeds",                person: "Amy",          email: "apavy@dorceylaw.com",    template_key: "op_deeds" },
  { name: "DLF Registered Agent", person: "John",         email: "Jarandia@dorceylaw.com", template_key: "op_dlf_ra" },
  { name: "Marketing Global",     person: "Cristina",     email: "CArandia@dorceylaw.com", template_key: "op_marketing_global" },
  { name: "Drafting Global",      person: "Saira",        email: "SHayo@dorceylaw.com",    template_key: "op_drafting_global" },
  { name: "Probate-TA",           person: "Kait / Ellie", email: "ellie@dorceylaw.com", notify_email: "kroth@dorceylaw.com", template_key: "op_probate_ta" },
  { name: "Probate Intake",       person: "Arlethys",     email: "ADiazFelipe@dorceylaw.com", template_key: "op_probate_intake" },
  { name: "Probate Department",   person: "Kait / Ellie", email: "ellie@dorceylaw.com", notify_email: "kroth@dorceylaw.com", template_key: "op_probate_dept" },
  { name: "Admin / Marketing",    person: "Jeana",        email: "jeana@dorceylaw.com",    template_key: "op_admin_marketing" },
  { name: "Receptionist",         person: "Karina",       email: "kchapas@dorceylaw.com",  template_key: "op_receptionist" },

  // --- Attribution / rollup trackers ---
  { name: "APP Department",    person: "Kayla", email: "krenaud@dorceylaw.com", template_key: "tracker_app" },
  { name: "Intake Department", person: "Karen", email: "kwright@dorceylaw.com",  template_key: "tracker_intake" },
];

async function run() {
  await initSchema();
  // This firm's reality: one person can fill several forms, so the same email
  // legitimately appears on multiple rows. Drop the old one-email-per-row rule
  // and make sure the optional second-recipient column exists. Both idempotent.
  await pool.query(`ALTER TABLE rpt_users DROP CONSTRAINT IF EXISTS rpt_users_email_key;`);
  await pool.query(`ALTER TABLE rpt_users ADD COLUMN IF NOT EXISTS notify_email TEXT;`);

  let updated = 0, inserted = 0;
  for (const m of TEAM) {
    const { rows } = await pool.query(`SELECT id FROM rpt_users WHERE name = $1`, [m.name]);
    if (rows.length) {
      await pool.query(
        `UPDATE rpt_users
            SET email=$1, notify_email=$2, person=$3, template_key=$4, location=$5, is_admin=$6, active=TRUE
          WHERE name=$7`,
        [m.email, m.notify_email || null, m.person || null, m.template_key, m.location || null, !!m.is_admin, m.name]
      );
      updated++;
    } else {
      await pool.query(
        `INSERT INTO rpt_users (name, email, notify_email, person, template_key, location, is_admin)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [m.name, m.email, m.notify_email || null, m.person || null, m.template_key, m.location || null, !!m.is_admin]
      );
      inserted++;
    }
  }
  console.log(`Roster synced — ${updated} updated, ${inserted} added (${TEAM.length} total).`);

  const { rows } = await pool.query(
    `SELECT id, name FROM rpt_users WHERE is_admin = TRUE ORDER BY id LIMIT 1`
  );
  if (rows[0]) {
    const token = await createMagicToken(rows[0].id);
    const base = process.env.APP_URL || "https://YOUR-APP.onrender.com";
    console.log("\n=== BOOTSTRAP SIGN-IN LINK (valid 1 year) ===");
    console.log(`${rows[0].name}: ${base}/login/${token}`);
    console.log("Open it, then go to /admin.\n");
  }
  await pool.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
