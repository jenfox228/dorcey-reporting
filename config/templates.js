// config/templates.js
// ---------------------------------------------------------------------------
// The reporting "DNA" — every form in the firm is one of these templates.
// Fields live HERE, not in the database, so changing a form is a code edit,
// never a migration. Each field: { key, label, type } where type is
// "number" (default) or "text".
//
// VERIFIED = field list taken from the live Google Form.
// RECONSTRUCTED = built from recovered categories; eyeball before go-live
//   (look for the // VERIFY tag).
// ---------------------------------------------------------------------------

const n = (key, label) => ({ key, label, type: "number" });
const t = (key, label) => ({ key, label, type: "text" });

export const TEMPLATES = {
  // ===== Admin-only (no self-report; lives in the dashboard/admin) ========
  admin_none: { label: "Admin", family: "-", monday: [], friday: [] },

  // ===== TEMPLATE A — Estate Planning Attorneys =========================
  // Josh, Mike, Erica, Kara, Joe. Calendar-heavy Monday, practice-area Friday.
  // Call/meeting fields intentionally KEPT — the firm wants attorney calls
  // tracked. RECONSTRUCTED.
  // July 2026: Revenue removed from Friday (case managers submit these and
  // don't have revenue data — Pulse covers revenue from the source sheet).
  // APP + Review appointments added to Monday to track maintenance-work
  // calendar load vs. rainmaking time.
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
      n("app_appts", "APP Appointments"),
      n("review_appts", "Review Appointments"),
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
    ],
  },

  // Real Estate Attorney — Brad Butcher. VERIFIED. Attorney area, so the
  // phone-calls field is kept. July 2026: APP + Review appointments added
  // to Monday (same rainmaking-time tracking as the EP attorneys).
  attorney_realestate: {
    label: "Real Estate Attorney",
    family: "A",
    monday: [
      n("re_closings_scheduled", "Real Estate closings scheduled this week"),
      n("re_new_client_appts", "New Real Estate client appts"),
      n("app_appts", "APP Appointments"),
      n("review_appts", "Review Appointments"),
    ],
    friday: [
      n("re_intake_calls", "New Real Estate intake calls"),
      n("re_clients_scheduled", "New Real Estate clients scheduled"),
      n("re_closings", "Real Estate closings this week"),
      n("re_phone_calls", "Real Estate phone calls"),
    ],
  },

  // ===== TEMPLATE B — Probate / TA Specialists ==========================
  // Doug, Brian. Attorney area — call/follow-up fields KEPT. VERIFIED.
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

  // Processed Funding — VERIFIED (real fields, replaced the old placeholder).
  op_processed_funding: {
    label: "Processed Funding",
    family: "C",
    monday: [
      n("funding_meetings", "Funding Meetings"),
      n("files_to_process", "Files to be Processed"),
      n("files_followup", "Files on Follow-Up List (misc.)"),
      n("deeds_to_process", "Deeds to Process"),
    ],
    friday: [
      n("processed_funding", "Processed Funding"),
      n("files_removed_followup", "Files removed from Follow-Up List"),
      n("deeds_processed", "Deeds Processed"),
      n("calls_emails_clients", "Calls/Emails with Clients"),
      n("calls_emails_institutions", "Calls/Emails with Financial Institutions"),
    ],
  },

  // Business Planning — VERIFIED. (JTM/MV = team-member attributions.)
  op_business_planning: {
    label: "Business Planning",
    family: "C",
    monday: [n("new_llcs", "New LLCs this past week")],
    friday: [
      n("llcs_drafted", "LLCs Drafted"),
      n("llcs_processed", "LLCs Processed"),
      n("new_mas_jtm", "New M&As (JTM)"),
      n("signed_in_person_jtm", "Signed In Person/Office (JTM)"),
      n("signed_docusign_mv", "Signed Via DocuSign (MV)"), // VERIFY M/F
      n("binders_made_jtm", "Binders Made (JTM)"), // VERIFY M/F
      n("llc_funding_mv", "LLC Funding (MV)"), // VERIFY M/F
      n("llcs_filed", "LLCs Filed"),
      n("new_bps_jtm", "New BPs (JTM)"),
      n("closed_files_jtm", "Closed Files (JTM)"),
    ],
  },

  // Business Planning — JT McGee. Added July 2026. Monday-only reporter:
  // all fields are previous-week counts, so Friday is intentionally empty.
  // Labels updated July 2026 (EA = Engagement Agreement); keys unchanged so
  // previously submitted data stays attached.
  op_bp_jtm: {
    label: "Business Planning — JT McGee",
    family: "C",
    monday: [
      n("bps", "# of BP EA's sent out (last week)"),
      n("mas", "# of M&A EA's sent out (last week)"),
      n("llcs", "# of LLCs created (last week)"),
      n("sent_for_signature", "# of DocuSign packages sent (last week)"),
      n("signed", "# of DocuSign packages signed (last week)"),
      n("final_payment", "# of closed BP/MA matters (last week)"),
      n("special_requests", "# of special request projects completed"),
    ],
    friday: [],
  },

  // Drafting — VERIFIED.
  op_drafting: {
    label: "Drafting",
    family: "C",
    monday: [
      n("files_to_draft", "Files to be Drafted"),
      n("adv_planning_to_draft", "Advanced Planning to be Drafted"),
    ],
    friday: [
      n("files_drafted", "Files Drafted"),
      n("adv_planning_drafted", "Advanced Planning files Drafted"),
    ],
  },

  // APP Funding — VERIFIED.
  op_app_funding: {
    label: "APP Funding",
    family: "C",
    monday: [
      n("packets_to_draft", "Funding Packets to be Drafted"),
      n("packets_to_process", "Funding Packets to be Processed"),
      n("funding_audit_meetings", "APP Funding/Audit Meetings"),
    ],
    friday: [
      n("drafted_packets", "Drafted Funding Packets"),
      n("processed_packets", "Processed Funding Packets"),
      n("audits_completed", "APP Audits Completed"),
      n("audits_remaining", "APP Audits Remaining (this month)"),
      n("calls_emails_clients", "Calls/Emails with Clients"),
      n("calls_emails_institutions", "Calls/Emails with Financial Institutions"),
    ],
  },

  // Drafting Funding — VERIFIED. (Touches O/S Deeds + the FVR tool.)
  op_drafting_funding: {
    label: "Drafting Funding",
    family: "C",
    monday: [
      n("funding_meetings", "Funding Meetings"),
      n("files_to_draft", "Files to Draft"),
      n("os_deeds_to_request", "O/S Deeds to Request"),
    ],
    friday: [
      n("files_drafted", "Files Drafted"),
      n("os_deeds_requested", "O/S Deeds Requested"),
      n("calls_emails_clients", "Calls/Emails with Clients"),
      n("audits", "Audits"),
      n("update_fvr", "Update FVR"),
    ],
  },

  // Deeds — VERIFIED. In-state vs out-of-state deed pipeline.
  op_deeds: {
    label: "Deeds",
    family: "C",
    monday: [
      n("in_state_deed_requests", "In-state deed requests"),
      n("oos_deed_requests", "Out-of-state deed requests"),
      n("deeds_sent_fft", "Deeds sent to Florida Freedom Title (FFT)"),
    ],
    friday: [
      n("deeds_processed_instate", "Deeds processed (in-state)"),
      n("deeds_processed_oos", "Deeds processed (out-of-state)"),
      n("deeds_recorded_instate", "Deeds recorded (in-state)"),
      n("deeds_recorded_oos", "Deeds recorded (out-of-state)"),
      n("deeds_left_to_process", "Deeds left to be processed"),
      n("deeds_rejected", "Deeds rejected this week"),
    ],
  },

  // DLF Registered Agent — VERIFIED.
  op_dlf_ra: {
    label: "DLF Registered Agent",
    family: "C",
    monday: [
      n("new_ra", "New RA last week"),
      n("ra_to_file", "RA to be filed"),
    ],
    friday: [
      n("ra_filed", "RA Filed"),
      n("fl_filing", "FL Filing"),
      n("wy_filing", "WY Filing"),
      n("other_state_filing", "Other State Filing"),
    ],
  },

  // Marketing Global — VERIFIED. Philippines team (PH) — schedule reminders
  // to their local morning, not Eastern time.
  op_marketing_global: {
    label: "Marketing Global",
    family: "C",
    ph_team: true,
    monday: [
      n("newsletter_created", "Monthly Newsletter Created"), // VERIFY M/F
      n("onedrive_project", "OneDrive Project"),
    ],
    friday: [
      n("numbers_project", "Numbers Project"),
      n("social_media_created", "Social Media Created"),
      n("videos_created", "Videos Created"),
    ],
  },

  // Drafting Global — VERIFIED. Philippines team (PH).
  op_drafting_global: {
    label: "Drafting Global",
    family: "C",
    ph_team: true,
    monday: [n("files_to_draft", "Files to be Drafted")],
    friday: [n("files_drafted", "Files Drafted")],
  },

  // Probate-TA — VERIFIED. Client follow-up field removed per firm request.
  op_probate_ta: {
    label: "Probate-TA",
    family: "C",
    monday: [n("new_tas", "New TAs last week")],
    friday: [
      n("closed_tas", "Closed TAs this week"),
      n("notices_736_sent", "736 notices sent out"),
      n("notice_of_trust_filed", "Cases with Notice of Trust filed"),
      n("cases_nearing_736_end", "Cases nearing end of 736 period"), // VERIFY M/F
      n("distributions_sent", "Distributions sent out"),
      n("docs_recording", "Docs sent for recording"),
    ],
  },

  // Probate Intake — VERIFIED. Client-calls field removed; Intake Calls KEPT.
  op_probate_intake: {
    label: "Probate Intake",
    family: "C",
    monday: [
      n("new_probates_retained", "New Probates retained last week"),
      n("new_files_to_create", "New files to create"),
      n("new_tas_retained", "New TAs retained last week"),
    ],
    friday: [
      n("intake_calls", "Intake Calls"),
      n("new_probate_appts", "New Probate appts scheduled"),
      n("new_ta_appts", "New TA appts scheduled"),
    ],
  },

  // Admin / Marketing (Jeana) — VERIFIED. Merge of Iron Mountain records work
  // plus admin/marketing tasks; there is no separate Iron Mountain department.
  op_admin_marketing: {
    label: "Admin / Marketing",
    family: "C",
    monday: [
      n("boxes_in_im", "Boxes left in Iron Mountain"),
      n("total_docs_returned", "Total documents returned (running total)"),
    ],
    friday: [
      n("letters_mailed", "Letters Mailed this week"),
      n("docs_returned_week", "Documents Returned this week"),
      n("forensis_files_closed", "Forensis Files Closed"), // VERIFY spelling
      n("research_tickets", "Research tickets"),
      n("dashboard_additions", "Dashboard additions"),
      n("client_tracking_sheets", "Client tracking sheets"),
      n("preconsult_video_views", "Pre-consult video views (WebinarJam)"),
      n("seminar_attendees", "Seminar attendees"),
      n("scan_shred_closed", "Scan & shred jobs closed"),
      n("files_put_away", "Files put away"),
    ],
  },

  // Receptionist — VERIFIED. Front-desk calls, signings, and binder handoffs.
  op_receptionist: {
    label: "Receptionist",
    family: "C",
    monday: [
      n("calls", "Number of calls"),
      n("signings", "Number of signings"),
    ],
    friday: [
      n("binders_called", "Binders called to pick up"),
      n("binders_picked_up", "Binders picked up"),
      n("binders_returned_shelf", "Binders returned to shelf"),
    ],
  },

  // Probate Department — VERIFIED. Phone calls, Emails, and client Follow-ups
  // removed per firm request; workflow/throughput fields kept.
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
      n("complex_discussed", "Complex cases discussed"),
      n("files_reviewed", "Files reviewed"),
      n("initial_docs_signing", "Initial docs sent for signing"),
      n("closing_docs_signing", "Closing docs sent for signing"),
      n("docs_recording", "Docs sent for recording"),
    ],
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
  return periodType === "F" ? tpl.friday : tpl.monday;
}
