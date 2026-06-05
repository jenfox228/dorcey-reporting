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
  { name: "Jen Fox",      email: "jen.fox@dorceylaw.com",  template_key: "admin_none",  is_admin: true },
  { name: "Josh Dorcey",  email: "msilva@dorceylaw.com",   template_key: "attorney_ep", is_admin: true, location: "Fort Myers HQ" },   // Marissa
  { name: "Mike Scott",   email: "bgonzalez@dorceylaw.com", template_key: "attorney_ep", is_admin: true, location: "LaBelle" },        // Bianca

  // --- Estate Planning attorneys ---
  { name: "Erica Johnson", email: "alebert@dorceylaw.com", template_key: "attorney_ep", location: "Fort Myers HQ" },          // Amanda
  { name: "Kara Sajdak",   email: "aking@dorceylaw.com",   template_key: "attorney_ep", location: "Naples / Marco Island" },  // Lexi
  { name: "Joe LoTempio",  email: "joe.lotempio@dorceylaw.com", template_key: "attorney_ep", location: "Fort Myers HQ" },     // TODO assign

  // --- Real Estate attorney ---
  { name: "Brad Butcher",  email: "cwoodcraft@dorceylaw.com", template_key: "attorney_realestate", location: "Fort Myers HQ" }, // Carri

  // --- Probate / TA specialists ---
  { name: "Doug Dodson",     email: "ADiazFelipe@dorceylaw.com", template_key: "probate_specialist" }, // Arlethys
  { name: "Brian Bronsther", email: "brian.bronsther@dorceylaw.com", template_key: "probate_specialist" }, // TODO assign

  // --- Operational departments ---
  { name: "File Creation",        email: "krenaud@dorceylaw.com",  template_key: "op_file_creation" },     // Kayla
  { name: "Processed Funding",    email: "abowes@dorceylaw.com",   template_key: "op_processed_funding" }, // Alyse
  { name: "Business Planning",    email: "MVillagracia@dorceylaw.com", template_key: "op_business_planning" }, // Michael
  { name: "Drafting",             email: "alebert@dorceylaw.com",  template_key: "op_drafting" },          // Amanda (also Erica)
  { name: "APP Funding",          email: "mpena@dorceylaw.com",    template_key: "op_app_funding" },       // Mariela
  { name: "Drafting Funding",     email: "cconnell@dorceylaw.com", template_key: "op_drafting_funding" },  // Cherrian
  { name: "Deeds",                email: "apavy@dorceylaw.com",    template_key: "op_deeds" },             // Amy
  { name: "DLF Registered Agent", email: "Jarandia@dorceylaw.com", template_key: "op_dlf_ra" },            // John
  { name: "Marketing Global",     email: "CArandia@dorceylaw.com", template_key: "op_marketing_global" }, // Cristina
  { name: "Drafting Global",      email: "SHayo@dorceylaw.com",    template_key: "op_drafting_global" },   // Saira
  { name: "Probate-TA",           email: "ellie@dorceylaw.com", notify_email: "kroth@dorceylaw.com", template_key: "op_probate_ta" },   // Kait & Ellie
  { name: "Probate Intake",       email: "ADiazFelipe@dorceylaw.com", template_key: "op_probate_intake" }, // Arlethys (also Doug)
  { name: "Probate Department",   email: "ellie@dorceylaw.com", notify_email: "kroth@dorceylaw.com", template_key: "op_probate_dept" }, // Kait & Ellie
  { name: "Admin / Marketing",    email: "jeana@dorceylaw.com",    template_key: "op_admin_marketing" },   // Jeana
  { name: "Receptionist",         email: "kchapas@dorceylaw.com",  template_key: "op_receptionist" },      // Karina

  // --- Attribution / rollup trackers ---
  { name: "APP Department",    email: "krenaud@dorceylaw.com", template_key: "tracker_app" },    // Kayla (also File Creation)
  { name: "Intake Department", email: "kwright@dorceylaw.com",  template_key: "tracker_intake" }, // Karen
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
            SET email=$1, notify_email=$2, template_key=$3, location=$4, is_admin=$5, active=TRUE
          WHERE name=$6`,
        [m.email, m.notify_email || null, m.template_key, m.location || null, !!m.is_admin, m.name]
      );
      updated++;
    } else {
      await pool.query(
        `INSERT INTO rpt_users (name, email, notify_email, template_key, location, is_admin)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [m.name, m.email, m.notify_email || null, m.template_key, m.location || null, !!m.is_admin]
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
