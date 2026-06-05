// seed.js — run once (or anytime) to insert/refresh the team roster, then
// print a fresh magic link for the first admin so you can bootstrap.
//   Run on Render via the Shell:  node seed.js
// Safe to re-run: existing people are updated (not duplicated), and no
// submissions are ever touched.
import { pool, initSchema } from "./db.js";
import { createMagicToken } from "./auth.js";

// Edit emails to real firm addresses before go-live. template_key must match
// a key in config/templates.js.
const TEAM = [
  // --- Admins ---
  { name: "Jen Fox",      email: "jen.fox@dorceylaw.com",     template_key: "admin_none",  is_admin: true },
  { name: "Josh Dorcey",  email: "josh.dorcey@dorceylaw.com", template_key: "attorney_ep", is_admin: true, location: "Fort Myers HQ" },
  { name: "Mike Scott",   email: "mike.scott@dorceylaw.com",  template_key: "attorney_ep", is_admin: true, location: "LaBelle" },

  // --- Estate Planning attorneys (Template A) ---
  { name: "Erica Johnson", email: "erica.johnson@dorceylaw.com", template_key: "attorney_ep", location: "Fort Myers HQ" },
  { name: "Kara Sajdak",   email: "kara.sajdak@dorceylaw.com",   template_key: "attorney_ep", location: "Naples / Marco Island" },
  { name: "Joe LoTempio",  email: "joe.lotempio@dorceylaw.com",  template_key: "attorney_ep", location: "Fort Myers HQ" },

  // --- Real Estate attorney ---
  { name: "Brad Butcher",  email: "brad.butcher@dorceylaw.com",  template_key: "attorney_realestate", location: "Fort Myers HQ" },

  // --- Probate / TA specialists (Template B) ---
  { name: "Doug Dodson",     email: "doug.dodson@dorceylaw.com",     template_key: "probate_specialist" },
  { name: "Brian Bronsther", email: "brian.bronsther@dorceylaw.com", template_key: "probate_specialist" },

  // --- Operational departments (Template C) ---
  { name: "File Creation",        email: "file.creation@dorceylaw.com",     template_key: "op_file_creation" },
  { name: "Processed Funding",    email: "processed.funding@dorceylaw.com",  template_key: "op_processed_funding" },
  { name: "Business Planning",    email: "business.planning@dorceylaw.com",  template_key: "op_business_planning" },
  { name: "Drafting",             email: "drafting@dorceylaw.com",           template_key: "op_drafting" },
  { name: "APP Funding",          email: "app.funding@dorceylaw.com",        template_key: "op_app_funding" },
  { name: "Drafting Funding",     email: "drafting.funding@dorceylaw.com",   template_key: "op_drafting_funding" },
  { name: "Deeds",                email: "deeds@dorceylaw.com",              template_key: "op_deeds" },
  { name: "DLF Registered Agent", email: "dlf.ra@dorceylaw.com",             template_key: "op_dlf_ra" },
  { name: "Marketing Global",     email: "marketing.global@dorceylaw.com",   template_key: "op_marketing_global" },
  { name: "Drafting Global",      email: "drafting.global@dorceylaw.com",    template_key: "op_drafting_global" },
  { name: "Probate-TA",           email: "probate.ta@dorceylaw.com",         template_key: "op_probate_ta" },
  { name: "Probate Intake",       email: "probate.intake@dorceylaw.com",     template_key: "op_probate_intake" },
  { name: "Probate Department",   email: "probate.dept@dorceylaw.com",       template_key: "op_probate_dept" },
  { name: "Admin / Marketing",    email: "jeana.renaud@dorceylaw.com",       template_key: "op_admin_marketing" },
  { name: "Receptionist",         email: "reception@dorceylaw.com",          template_key: "op_receptionist" },

  // --- Attribution / rollup trackers (Template D) ---
  { name: "APP Department",    email: "app.dept@dorceylaw.com",    template_key: "tracker_app" },
  { name: "Intake Department", email: "intake.dept@dorceylaw.com", template_key: "tracker_intake" },
];

async function run() {
  await initSchema();
  for (const m of TEAM) {
    await pool.query(
      `INSERT INTO rpt_users (name, email, template_key, location, is_admin)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         template_key = EXCLUDED.template_key,
         location = EXCLUDED.location,
         is_admin = EXCLUDED.is_admin,
         active = TRUE`,
      [m.name, m.email, m.template_key, m.location || null, !!m.is_admin]
    );
  }
  console.log(`Seeded ${TEAM.length} users.`);

  const { rows } = await pool.query(
    `SELECT id, name FROM rpt_users WHERE is_admin = TRUE ORDER BY id LIMIT 1`
  );
  if (rows[0]) {
    const token = await createMagicToken(rows[0].id);
    const base = process.env.APP_URL || "https://YOUR-APP.onrender.com";
    console.log("\n=== BOOTSTRAP SIGN-IN LINK (valid 3 days) ===");
    console.log(`${rows[0].name}: ${base}/login/${token}`);
    console.log("Open it, then go to /admin to generate everyone else's links.\n");
  }
  await pool.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
