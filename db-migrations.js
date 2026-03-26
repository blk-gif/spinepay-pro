'use strict';

// ── db-migrations.js ──────────────────────────────────────────────────────────
// Runs on every app start. All operations are idempotent:
//   • CREATE TABLE IF NOT EXISTS  — no-op if table already exists
//   • ALTER TABLE ADD COLUMN      — silently skipped if column already exists
// Never drops or renames existing data.

function runMigrations(db) {

  // ── New tables (create only if missing) ──────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_claims (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id      INTEGER,
      patient_name    TEXT,
      insurance_name  TEXT,
      claim_number    TEXT,
      service_date    TEXT,
      submitted_date  TEXT,
      cpt_codes       TEXT,
      icd_codes       TEXT,
      billed_amount   REAL    DEFAULT 0,
      paid_amount     REAL    DEFAULT 0,
      status          TEXT    DEFAULT 'pending',
      denial_reason   TEXT,
      resubmit_count  INTEGER DEFAULT 0,
      notes           TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id    INTEGER,
      patient_id     INTEGER,
      patient_name   TEXT,
      appointment_id INTEGER,
      channel        TEXT    DEFAULT 'sms',
      scheduled_at   DATETIME,
      sent_at        DATETIME,
      status         TEXT    DEFAULT 'pending',
      error_msg      TEXT,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      first_name TEXT,
      last_name  TEXT,
      role       TEXT,
      phone      TEXT,
      email      TEXT,
      hire_date  TEXT,
      active     INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_hipaa (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id       INTEGER NOT NULL,
      signature      TEXT NOT NULL,
      agreed_at      TEXT NOT NULL,
      ip_address     TEXT,
      policy_version TEXT DEFAULT '1.0'
    );

    CREATE TABLE IF NOT EXISTS staff_login_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id     INTEGER NOT NULL,
      logged_in_at TEXT DEFAULT (datetime('now')),
      ip_address   TEXT,
      success      INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      username      TEXT NOT NULL,
      action        TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id   TEXT,
      outcome       TEXT DEFAULT 'success',
      logged_at     DATETIME DEFAULT (datetime('now'))
    );
  `);

  // ── Column migrations ─────────────────────────────────────────────────────────
  // SQLite has no ADD COLUMN IF NOT EXISTS — wrap each in try/catch.
  const columns = [

    // ── soap_notes ──────────────────────────────────────────────────────────────
    'ALTER TABLE soap_notes ADD COLUMN patient_name TEXT',
    'ALTER TABLE soap_notes ADD COLUMN provider TEXT',
    'ALTER TABLE soap_notes ADD COLUMN voice_transcript TEXT',
    'ALTER TABLE soap_notes ADD COLUMN signed INTEGER DEFAULT 0',
    'ALTER TABLE soap_notes ADD COLUMN signed_at TEXT',
    'ALTER TABLE soap_notes ADD COLUMN updated_at DATETIME',

    // ── intake_forms ────────────────────────────────────────────────────────────
    'ALTER TABLE intake_forms ADD COLUMN first_name TEXT',
    'ALTER TABLE intake_forms ADD COLUMN last_name TEXT',
    'ALTER TABLE intake_forms ADD COLUMN city TEXT',
    'ALTER TABLE intake_forms ADD COLUMN state TEXT',
    'ALTER TABLE intake_forms ADD COLUMN zip TEXT',
    'ALTER TABLE intake_forms ADD COLUMN emergency_contact TEXT',
    'ALTER TABLE intake_forms ADD COLUMN emergency_phone TEXT',
    'ALTER TABLE intake_forms ADD COLUMN insurance_name TEXT',
    'ALTER TABLE intake_forms ADD COLUMN insurance_id TEXT',
    'ALTER TABLE intake_forms ADD COLUMN primary_complaint TEXT',
    'ALTER TABLE intake_forms ADD COLUMN pain_scale INTEGER',
    'ALTER TABLE intake_forms ADD COLUMN medications TEXT',
    'ALTER TABLE intake_forms ADD COLUMN prior_care TEXT',

    // ── pi_cases ────────────────────────────────────────────────────────────────
    'ALTER TABLE pi_cases ADD COLUMN patient_name TEXT',
    'ALTER TABLE pi_cases ADD COLUMN date_of_accident TEXT',
    'ALTER TABLE pi_cases ADD COLUMN accident_type TEXT',
    'ALTER TABLE pi_cases ADD COLUMN insurance_company TEXT',
    'ALTER TABLE pi_cases ADD COLUMN claim_number TEXT',
    'ALTER TABLE pi_cases ADD COLUMN adjuster_name TEXT',
    'ALTER TABLE pi_cases ADD COLUMN adjuster_phone TEXT',
    "ALTER TABLE pi_cases ADD COLUMN policy_limit REAL DEFAULT 0",
    'ALTER TABLE pi_cases ADD COLUMN updated_at DATETIME',

    // ── eob_records ─────────────────────────────────────────────────────────────
    'ALTER TABLE eob_records ADD COLUMN patient_name TEXT',
    'ALTER TABLE eob_records ADD COLUMN payer_name TEXT',
    'ALTER TABLE eob_records ADD COLUMN claim_number TEXT',
    'ALTER TABLE eob_records ADD COLUMN service_date TEXT',
    'ALTER TABLE eob_records ADD COLUMN adjustment REAL DEFAULT 0',
    'ALTER TABLE eob_records ADD COLUMN patient_resp REAL DEFAULT 0',
    'ALTER TABLE eob_records ADD COLUMN denial_reason TEXT',
    'ALTER TABLE eob_records ADD COLUMN eob_file_path TEXT',

    // ── waitlist ────────────────────────────────────────────────────────────────
    'ALTER TABLE waitlist ADD COLUMN patient_name TEXT',
    'ALTER TABLE waitlist ADD COLUMN phone TEXT',
    'ALTER TABLE waitlist ADD COLUMN email TEXT',
    'ALTER TABLE waitlist ADD COLUMN preferred_date TEXT',
    'ALTER TABLE waitlist ADD COLUMN preferred_time TEXT',
    'ALTER TABLE waitlist ADD COLUMN provider TEXT',
    'ALTER TABLE waitlist ADD COLUMN reason TEXT',
    "ALTER TABLE waitlist ADD COLUMN urgency TEXT DEFAULT 'normal'",
    'ALTER TABLE waitlist ADD COLUMN notified INTEGER DEFAULT 0',
    'ALTER TABLE waitlist ADD COLUMN added_at DATETIME DEFAULT CURRENT_TIMESTAMP',

    // ── time_clock ──────────────────────────────────────────────────────────────
    'ALTER TABLE time_clock ADD COLUMN staff_id INTEGER',
    'ALTER TABLE time_clock ADD COLUMN staff_name TEXT',
    'ALTER TABLE time_clock ADD COLUMN break_start DATETIME',
    'ALTER TABLE time_clock ADD COLUMN break_end DATETIME',
    'ALTER TABLE time_clock ADD COLUMN total_hours REAL',
    'ALTER TABLE time_clock ADD COLUMN overtime_hours REAL DEFAULT 0',
    'ALTER TABLE time_clock ADD COLUMN approved_by TEXT',

    // ── claims (original billing table) ────────────────────────────────────────
    'ALTER TABLE claims ADD COLUMN denial_reason TEXT',
    'ALTER TABLE claims ADD COLUMN resubmit_count INTEGER DEFAULT 0',
    'ALTER TABLE claims ADD COLUMN submitted_date TEXT',

    // ── reminder_templates ──────────────────────────────────────────────────────
    'ALTER TABLE reminder_templates ADD COLUMN updated_at DATETIME',

    // ── patients ────────────────────────────────────────────────────────────────
    'ALTER TABLE patients ADD COLUMN account_number TEXT',
    'ALTER TABLE patients ADD COLUMN referred_by TEXT',

    // ── appointments ────────────────────────────────────────────────────────────
    'ALTER TABLE appointments ADD COLUMN room TEXT',
    'ALTER TABLE appointments ADD COLUMN confirmed INTEGER DEFAULT 0',

    // ── users (auth + staff accounts) ───────────────────────────────────────────
    'ALTER TABLE users ADD COLUMN email TEXT',
    'ALTER TABLE users ADD COLUMN temp_password INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN last_login TEXT',
    'ALTER TABLE users ADD COLUMN hipaa_signed INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN hipaa_signed_at TEXT',
    'ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1',

    // ── staff (HR table) ─────────────────────────────────────────────────────────
    'ALTER TABLE staff ADD COLUMN temp_password INTEGER DEFAULT 1',
    'ALTER TABLE staff ADD COLUMN last_login TEXT',
    'ALTER TABLE staff ADD COLUMN hipaa_signed INTEGER DEFAULT 0',
    'ALTER TABLE staff ADD COLUMN hipaa_signed_at TEXT',
  ];

  for (const sql of columns) {
    try { db.exec(sql); } catch (_) { /* column already exists — skip */ }
  }

  // ── One-time data fixes ──────────────────────────────────────────────────────

  // FIX: Remove duplicate staff1 account (inactive legacy entry)
  try { db.prepare("DELETE FROM users WHERE username = 'staff1'").run(); } catch (_) {}

  // FIX: Mark all admin accounts as HIPAA-signed and clear temp_password flag.
  // Admins set up the system and do not need to complete the staff onboarding flow.
  try {
    db.prepare(`
      UPDATE users SET hipaa_signed = 1, hipaa_signed_at = datetime('now'), temp_password = 0
      WHERE role = 'admin' AND (hipaa_signed = 0 OR hipaa_signed IS NULL)
    `).run();
  } catch (_) {}
}

module.exports = { runMigrations };
