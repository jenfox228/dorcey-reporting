// config/templates.js
// ---------------------------------------------------------------------------
// The reporting "DNA" — every form in the firm is one of these templates.
// Fields live HERE, not in the database, so changing a form is a code edit,
// never a migration. Each field: { key, label, type } where type is
// "number" (default) or "text".
//
// VERIFIED = field list recovered exactly from the April mapping.
// RECONSTRUCTED = built from the recovered *categories* and needs a quick
//   eyeball against the live Google Form before go-live (look for the
//   // VERIFY tag).
// ---------------------------------------------------------------------------

const n = (key, label) => ({ key, label, type: "number" });
const t = (key, label) => ({ key, label, type: "text" });

export const TEMPLATES = {
  // ===== Admin-only (no self-report; lives in the dashboard/admin) ========
  admin_none: { label: "Admin", family: "-", monday: [], friday: [] },


  // ===== TEMPLATE A — Estate Planning Attorneys =========================
  // Josh, Mike, Erica, Kara (+ Joe pending). Calendar-heavy Monday,
  // practice-area-heavy Friday. RECONSTRUCTED from recovered categories.
  attorney_ep: {
    label: "Estate Planning Attorney",
    family: "A",
    monday: [
      n("calls", "Phone calls"), // VERIFY against live form
      n("zooms", "Zoom meetings"),
      n("office_meetings", "In-office meetings"),
      n("hdd", "HDDs scheduled"),
      n("hdd_exe", "HDD + Execution (HDD Exe)"),
      n("cfx", "Changes/Funding/Execution (CFX)"),
      n("exe", "Executions (EXE)"),
      n("seminars", "Seminars / speaking"),
      n("coaching", "Coaching sessions"),
      n("breakfast_lunch", "Breakfast / lunch meetings"),
      n("new_consults", "New consults scheduled"),
      n("followups", "Follow-ups (FU)"),
      n("cx", "Cancellations (CX)"),
      n("rs", "Reschedules (RS)"),
    ],
    friday: [
      n("ep", "EP — Estate Planning engaged"),
      n("bp_fl", "BP FL — Business Planning (Florida)"),
      n("bp_wy", "BP WY — Business Planning (Wyoming)"),
      n("el", "EL — Employment Law"),
      n("ta", "TA — Trust Administration"),
      n("app", "APP — new memberships"),
      n("ma", "M&A — Mergers & Acquisitions"),
      n("probate", "Probate"),
      n("advanced", "Advanced / Charitable Planning"),
      n("dapt", "DAPT"),
      n("new_engaged", "New clients engaged"),
      n("revenue", "Revenue closed ($)"),
    ],
  },

  // ===== TEMPLATE B — Probate / TA Specialists ==========================
  // Doug, Brian. VERIFIED — both forms identical.
  probate_specialist: {
    label: "Probate / TA Specialist",
    family: "B",
    monday: [
      n("new_phone_calls", "New — Phone calls"),
      n("new_probate", "New — Probate"),
      n("new_ta", "New — TA"),
      n("new_fu", "New — Follow-ups"),
      n("executions", "Executions"),
    ],
    friday: [
      n("new_probate_engaged", "New Probate — Engaged"),
      n("new_ta_engaged", "New TA — Engaged"),
    ],
  },

  // ===== TEMPLATE C — Operational Departments ===========================
  // Queue-in / work-out. Monday = the plate, Friday = the output.

  // File Creation — VERIFIED.
  op_file_creation: {
    label: "File Creation",
    family: "C",
    monday: [
      n("bp_fl", "BP FL"),
      n("bp_wy", "BP WY"),
      n("bp", "BP"),
      n("trademark", "Trademark"),
      n("clear_title", "Clear Title"),
      n("design", "Design"),
      n("gun_trust", "Gun Trust"),
      n("dapt", "DAPT"),
    ],
    friday: [
      n("el", "EL"),
      n("ep", "EP"),
      n("probate", "Probate"),
      n("ta", "TA"),
      n("deep_dive", "Deep Dive"),
      n("ma", "M&A"),
      n("deed", "DEED"),
      n("phase1_ep", "Phase 1 — General EP"),
      n("prenup_postnup", "Pre-Nup / Post-Nup"),
    ],
  },

  // Probate Department — VERIFIED (16-field probate funnel).
  op_probate_dept: {
    label: "Probate Department",
    family: "C",
    monday: [
      n("total_open_probates", "Total open probates"),
      n("ntc_expiring", "Notices to creditors expiring this week"),
      n("accountings", "Accountings this week"),
      n("files_to_review", "Files to be reviewed"),
    ],
    friday: [
      n("closed_probates", "Closed probates"),
      n("petitions_filed", "Petitions filed"),
      n("ntc_filed", "Notices to creditors filed"),
      n("phone_calls", "Phone calls"),
      n("emails", "Emails"),
      n("complex_discussed", "Complex cases discussed"),
      n("files_reviewed", "Files reviewed"),
      n("followups", "Follow-ups with clients"),
      n("initial_docs_signing", "Initial docs sent for signing"),
      n("closing_docs_signing", "Closing docs sent for signing"),
      n("docs_recording", "Docs sent for recording"),
    ],
  },

  // Processed Funding — placeholder operational template until the exact
  // field list is re-collected. RECONSTRUCTED.
  op_processed_funding: {
    label: "Processed Funding",
    family: "C",
    monday: [n("in_queue", "Funding items in queue")], // VERIFY
    friday: [n("processed", "Funding items processed")], // VERIFY
  },

  // ===== TEMPLATE D — Attribution / Rollup Trackers =====================

  // APP Department — VERIFIED. New APPs broken out by originating attorney.
  tracker_app: {
    label: "APP Department",
    family: "D",
    monday: [
      n("app_signings", "APP signings"),
      n("app_phone_calls", "APP phone calls"),
      n("app_meetings", "APP meetings this week"),
    ],
    friday: [
      n("new_apps", "New APPs (total)"),
      n("new_apps_josh", "New APPs — Josh"),
      n("new_apps_mike", "New APPs — Mike"),
      n("new_apps_erica", "New APPs — Erica"),
      n("new_apps_kara", "New APPs — Kara"),
      n("new_apps_brian", "New APPs — Brian"),
      n("new_apps_joe", "New APPs — Joe"),
      n("total_new_app_ytd", "Total new APP this year"),
      n("deceased_app", "Deceased APP clients this week"),
    ],
  },

  // Intake Department — referral sources + appointment funnel.
  // RECONSTRUCTED — re-collect exact fields before go-live.
  tracker_intake: {
    label: "Intake Department",
    family: "D",
    monday: [
      n("appts_scheduled", "Appointments scheduled"), // VERIFY
      n("calls_in", "Inbound calls"),
    ],
    friday: [
      n("appts_held", "Appointments held"),
      n("referrals_total", "Referrals received (total)"),
      t("top_referral_source", "Top referral source"),
    ],
  },
};

// Helper used everywhere: get the field list for a template + period.
export function fieldsFor(templateKey, periodType) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) return [];
  return periodType === "M" ? tpl.monday : tpl.friday;
}
