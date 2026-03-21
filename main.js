const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { runMigrations } = require('./db-migrations');

const { nodewhisper } = require('nodejs-whisper');
const os = require('os');

let mainWindow;
let db;
let currentUser = null;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function initDatabase() {
  const Database = require('better-sqlite3');
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'spinepay.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      full_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dob TEXT,
      gender TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS insurance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      type TEXT DEFAULT 'primary',
      provider TEXT,
      policy_number TEXT,
      group_number TEXT,
      subscriber_name TEXT,
      subscriber_dob TEXT,
      subscriber_id TEXT,
      relationship TEXT,
      copay REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER DEFAULT 30,
      type TEXT DEFAULT 'adjustment',
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      provider TEXT DEFAULT 'Dr. Walden Bailey',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      subjective TEXT,
      objective TEXT,
      assessment TEXT,
      plan TEXT,
      diagnosis_codes TEXT,
      procedure_codes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      appointment_id INTEGER,
      claim_number TEXT,
      insurer TEXT,
      claim_type TEXT DEFAULT 'insurance',
      amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      filed_date TEXT,
      service_date TEXT,
      icd_codes TEXT,
      cpt_codes TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      claim_id INTEGER,
      amount REAL NOT NULL,
      method TEXT DEFAULT 'cash',
      reference TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      type TEXT DEFAULT 'doctor',
      recipient_name TEXT,
      recipient_email TEXT,
      recipient_phone TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      sent_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS intake_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      appointment_id INTEGER,
      personal_info TEXT,
      insurance_info TEXT,
      medical_history TEXT,
      reason_for_visit TEXT,
      current_medications TEXT,
      allergies TEXT,
      signature TEXT,
      signed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS insurance_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      insurance_id INTEGER,
      provider TEXT,
      copay REAL DEFAULT 0,
      deductible REAL DEFAULT 0,
      deductible_met REAL DEFAULT 0,
      coverage_limit REAL DEFAULT 0,
      auth_required INTEGER DEFAULT 0,
      auth_number TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      verified_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS soap_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      patient_id INTEGER NOT NULL,
      subjective TEXT,
      objective TEXT,
      assessment TEXT,
      plan TEXT,
      diagnosis_codes TEXT,
      procedure_codes TEXT,
      note_date TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eob_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER,
      patient_id INTEGER NOT NULL,
      insurer TEXT,
      billed_amount REAL DEFAULT 0,
      allowed_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      patient_responsibility REAL DEFAULT 0,
      adjustment_reason TEXT,
      status TEXT DEFAULT 'received',
      received_date TEXT,
      discrepancy_flag INTEGER DEFAULT 0,
      discrepancy_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'sms',
      trigger_hours INTEGER DEFAULT 24,
      subject TEXT,
      body TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reminder_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      patient_id INTEGER,
      template_id INTEGER,
      type TEXT,
      recipient TEXT,
      message TEXT,
      status TEXT DEFAULT 'sent',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      desired_date TEXT,
      desired_time TEXT,
      location_id INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'waiting',
      notified_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transportation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      patient_id INTEGER NOT NULL,
      pickup_address TEXT,
      pickup_time TEXT,
      dropoff_address TEXT,
      driver_name TEXT,
      driver_notes TEXT,
      status TEXT DEFAULT 'requested',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pi_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      referral_id INTEGER,
      accident_date TEXT,
      accident_description TEXT,
      attorney_name TEXT,
      attorney_firm TEXT,
      attorney_phone TEXT,
      attorney_email TEXT,
      case_number TEXT,
      lien_amount REAL DEFAULT 0,
      settlement_amount REAL DEFAULT 0,
      case_status TEXT DEFAULT 'open',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS time_clock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      clock_in DATETIME NOT NULL,
      clock_out DATETIME,
      notes TEXT,
      approved INTEGER DEFAULT 0,
      approved_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hcfa_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      soap_note_id INTEGER,
      patient_id INTEGER NOT NULL,
      form_data TEXT,
      status TEXT DEFAULT 'Draft',
      fax_recipient TEXT,
      fax_sent_at TEXT,
      fax_sent_by TEXT,
      printed_at TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);

  // ── Migrate existing databases: add missing columns ─────────────────────────
  // SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we try/catch.
  const migrations = [
    'ALTER TABLE intake_forms ADD COLUMN full_name TEXT',
    'ALTER TABLE intake_forms ADD COLUMN dob TEXT',
    'ALTER TABLE intake_forms ADD COLUMN gender TEXT',
    'ALTER TABLE intake_forms ADD COLUMN address TEXT',
    'ALTER TABLE intake_forms ADD COLUMN phone TEXT',
    'ALTER TABLE intake_forms ADD COLUMN email TEXT',
    'ALTER TABLE intake_forms ADD COLUMN insurance_provider TEXT',
    'ALTER TABLE intake_forms ADD COLUMN policy_number TEXT',
    'ALTER TABLE intake_forms ADD COLUMN group_number TEXT',
    'ALTER TABLE intake_forms ADD COLUMN hipaa_acknowledged INTEGER DEFAULT 0',
    'ALTER TABLE intake_forms ADD COLUMN signature_date TEXT',
    'ALTER TABLE intake_forms ADD COLUMN submitted_at TEXT',
    'ALTER TABLE soap_notes ADD COLUMN note_date TEXT',
    'ALTER TABLE claims ADD COLUMN claim_type TEXT DEFAULT \'insurance\'',
    'ALTER TABLE reminder_log ADD COLUMN message TEXT',
  ];
  for (const q of migrations) {
    try { db.exec(q); } catch (_) { /* column already exists */ }
  }

  // ── Migrate soap_notes: remove NOT NULL from appointment_id ─────────────────
  // SQLite cannot drop constraints via ALTER TABLE; reconstruct the table.
  const soapCols = db.prepare('PRAGMA table_info(soap_notes)').all();
  const apptCol  = soapCols.find(c => c.name === 'appointment_id');
  if (apptCol && apptCol.notnull === 1) {
    db.exec('PRAGMA foreign_keys=OFF');
    db.exec('DROP TABLE IF EXISTS soap_notes_tmp');
    db.exec(`CREATE TABLE soap_notes_tmp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      patient_id INTEGER NOT NULL,
      subjective TEXT, objective TEXT, assessment TEXT, plan TEXT,
      diagnosis_codes TEXT, procedure_codes TEXT, note_date TEXT,
      created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )`);
    db.exec(`INSERT INTO soap_notes_tmp
      SELECT id, appointment_id, patient_id, subjective, objective, assessment, plan,
             diagnosis_codes, procedure_codes, note_date, created_by, created_at
      FROM soap_notes`);
    db.exec('DROP TABLE soap_notes');
    db.exec('ALTER TABLE soap_notes_tmp RENAME TO soap_notes');
    db.exec('PRAGMA foreign_keys=ON');
  }

  // ── Run db-migrations.js (new tables + missing columns) ─────────────────────
  runMigrations(db);

  // Insert default users if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    db.prepare(`INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)`).run(
      'admin', hashPassword('admin123'), 'admin', 'Administrator'
    );
  }
  const staffExists = db.prepare('SELECT id FROM users WHERE username = ?').get('staff');
  if (!staffExists) {
    db.prepare(`INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)`).run(
      'staff', hashPassword('staff123'), 'staff', 'Front Desk Staff'
    );
  }

  // Seed default location
  const locExists = db.prepare('SELECT id FROM locations WHERE name = ?').get('Walden Ave - Main Office');
  if (!locExists) {
    db.prepare(`INSERT INTO locations (name, address, phone) VALUES (?, ?, ?)`).run(
      'Walden Ave - Main Office', '1086 Walden Ave Suite 1, Buffalo, NY 14211', '(716) 893-9200'
    );
  }

  // Seed default reminder templates
  const tmplCount = db.prepare('SELECT COUNT(*) as cnt FROM reminder_templates').get();
  if (tmplCount.cnt === 0) {
    db.prepare(`INSERT INTO reminder_templates (name, type, trigger_hours, subject, body) VALUES (?, ?, ?, ?, ?)`).run(
      '24-Hour SMS Reminder', 'sms', 24, null,
      'Hi {{patient_name}}, this is a reminder of your appointment at Walden Bailey Chiropractic tomorrow at {{time}}. Reply STOP to opt out.'
    );
    db.prepare(`INSERT INTO reminder_templates (name, type, trigger_hours, subject, body) VALUES (?, ?, ?, ?, ?)`).run(
      '24-Hour Email Reminder', 'email', 24,
      'Appointment Reminder - Walden Bailey Chiropractic',
      'Dear {{patient_name}},\n\nThis is a friendly reminder of your appointment scheduled for {{date}} at {{time}}.\n\nLocation: 1086 Walden Ave Suite 1, Buffalo, NY 14211\nPhone: (716) 893-9200\n\nIf you need to reschedule, please call us at least 24 hours in advance.\n\nSee you soon!\nWalden Bailey Chiropractic'
    );
  }

  // Insert sample data if patients table is empty
  const patientCount = db.prepare('SELECT COUNT(*) as cnt FROM patients').get();
  if (patientCount.cnt === 0) {
    insertSampleData();
  }
}

function insertSampleData() {
  // Get today and this week's dates
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  function fmtDate(d) {
    return d.toISOString().split('T')[0];
  }
  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  const todayStr = fmtDate(today);
  const monStr = fmtDate(monday);
  const tueStr = fmtDate(addDays(monday, 1));
  const wedStr = fmtDate(addDays(monday, 2));
  const thuStr = fmtDate(addDays(monday, 3));

  // Insert sample patients
  const insertPatient = db.prepare(`
    INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address, city, state, zip, emergency_contact, emergency_phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  const p1 = insertPatient.run('James', 'Morrison', '1985-03-15', 'male', '716-555-0101', 'jmorrison@email.com', '142 Elmwood Ave', 'Buffalo', 'NY', '14201', 'Sarah Morrison', '716-555-0102');
  const p2 = insertPatient.run('Linda', 'Chen', '1972-07-22', 'female', '716-555-0201', 'lchen@email.com', '89 Delaware Ave', 'Buffalo', 'NY', '14202', 'David Chen', '716-555-0202');
  const p3 = insertPatient.run('Robert', 'Kowalski', '1990-11-08', 'male', '716-555-0301', 'rkowalski@email.com', '315 Main St', 'Buffalo', 'NY', '14203', 'Anna Kowalski', '716-555-0302');
  const p4 = insertPatient.run('Maria', 'Santos', '1968-05-30', 'female', '716-555-0401', 'msantos@email.com', '77 Hertel Ave', 'Buffalo', 'NY', '14207', 'Carlos Santos', '716-555-0402');
  const p5 = insertPatient.run('Thomas', 'Williams', '1955-09-12', 'male', '716-555-0501', 'twilliams@email.com', '500 Grider St', 'Buffalo', 'NY', '14215', 'Patricia Williams', '716-555-0502');

  // Insert insurance
  const insertIns = db.prepare(`
    INSERT INTO insurance (patient_id, type, provider, policy_number, group_number, subscriber_name, relationship, copay)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertIns.run(p1.lastInsertRowid, 'primary', 'BlueCross Blue Shield', 'BCBS-100123', 'GRP-5500', 'James Morrison', 'self', 30);
  insertIns.run(p2.lastInsertRowid, 'primary', 'Aetna', 'AET-200456', 'GRP-6600', 'Linda Chen', 'self', 25);
  insertIns.run(p3.lastInsertRowid, 'primary', 'UnitedHealth', 'UHC-300789', 'GRP-7700', 'Robert Kowalski', 'self', 35);
  insertIns.run(p4.lastInsertRowid, 'primary', 'Medicare', 'MC-400111', '', 'Maria Santos', 'self', 0);
  insertIns.run(p5.lastInsertRowid, 'primary', 'Cigna', 'CIG-500222', 'GRP-8800', 'Thomas Williams', 'self', 40);

  // Insert appointments for this week
  const insertAppt = db.prepare(`
    INSERT INTO appointments (patient_id, date, time, duration, type, status, provider)
    VALUES (?, ?, ?, ?, ?, ?, 'Dr. Walden Bailey')
  `);
  insertAppt.run(p1.lastInsertRowid, monStr, '08:00', 30, 'initial-exam', 'completed');
  insertAppt.run(p2.lastInsertRowid, monStr, '08:30', 30, 'adjustment', 'completed');
  insertAppt.run(p3.lastInsertRowid, todayStr, '09:00', 30, 'adjustment', 'scheduled');
  insertAppt.run(p4.lastInsertRowid, todayStr, '09:30', 30, 'follow-up', 'checked-in');
  insertAppt.run(p5.lastInsertRowid, todayStr, '10:00', 30, 'adjustment', 'scheduled');
  insertAppt.run(p1.lastInsertRowid, wedStr, '08:00', 30, 'adjustment', 'scheduled');
  insertAppt.run(p2.lastInsertRowid, wedStr, '09:00', 30, 'adjustment', 'scheduled');
  insertAppt.run(p3.lastInsertRowid, thuStr, '08:30', 30, 'follow-up', 'scheduled');

  // Insert sample claims
  const insertClaim = db.prepare(`
    INSERT INTO claims (patient_id, claim_number, insurer, claim_type, amount, paid_amount, status, filed_date, service_date, icd_codes, cpt_codes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertClaim.run(p1.lastInsertRowid, 'CLM-2024-001', 'BlueCross Blue Shield', 'insurance', 350.00, 280.00, 'partial', fmtDate(addDays(today, -14)), monStr, 'M54.5,M99.01', '98941,98940');
  insertClaim.run(p2.lastInsertRowid, 'CLM-2024-002', 'Aetna', 'insurance', 275.00, 0, 'submitted', fmtDate(addDays(today, -7)), monStr, 'M54.2,M99.02', '98940,97012');
  insertClaim.run(p4.lastInsertRowid, 'CLM-2024-003', 'Medicare', 'insurance', 180.00, 144.00, 'paid', fmtDate(addDays(today, -21)), fmtDate(addDays(today, -21)), 'M54.4', '98940');

  // Insert sample payment
  const insertPayment = db.prepare(`
    INSERT INTO payments (patient_id, amount, method, reference, date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertPayment.run(p1.lastInsertRowid, 280.00, 'insurance', 'INS-PAY-001', fmtDate(addDays(today, -7)), 'BCBS payment for CLM-2024-001');
  insertPayment.run(p4.lastInsertRowid, 144.00, 'insurance', 'MC-PAY-001', fmtDate(addDays(today, -14)), 'Medicare payment');
  insertPayment.run(p3.lastInsertRowid, 35.00, 'cash', 'CASH-001', fmtDate(addDays(today, -3)), 'Copay');

  // Insert sample referral
  const insertRef = db.prepare(`
    INSERT INTO referrals (patient_id, type, recipient_name, recipient_email, recipient_phone, reason, status, sent_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRef.run(p3.lastInsertRowid, 'attorney', 'Johnson & Associates Law', 'info@johnsonlaw.com', '716-555-9000', 'Motor vehicle accident injury - personal injury claim', 'sent', fmtDate(addDays(today, -5)));
  insertRef.run(p5.lastInsertRowid, 'specialist', 'Dr. Patricia Nguyen, MD', 'pnguyen@buffaloortho.com', '716-555-8000', 'Chronic lumbar stenosis - orthopedic evaluation needed', 'pending', null);
}

function createWindow() {
  // Grant microphone (and camera) permissions automatically for speech recognition
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') callback(true);
    else callback(false);
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // required — contextBridge won't work without this
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// ─── IPC HANDLERS ─────────────────────────────────────────────────────────────

// AUTH
ipcMain.handle('auth:login', (event, { username, password }) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return { success: false, error: 'Invalid username or password' };
    const hash = hashPassword(password);
    if (hash !== user.password_hash) return { success: false, error: 'Invalid username or password' };
    currentUser = { id: user.id, username: user.username, role: user.role, full_name: user.full_name };
    return { success: true, user: currentUser };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:logout', () => {
  currentUser = null;
  return { success: true };
});

ipcMain.handle('auth:get-current-user', () => {
  return currentUser;
});

// PATIENTS
ipcMain.handle('patients:get-all', () => {
  return db.prepare('SELECT * FROM patients ORDER BY last_name, first_name').all();
});

ipcMain.handle('patients:get-by-id', (event, id) => {
  return db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
});

ipcMain.handle('patients:create', (event, data) => {
  const stmt = db.prepare(`
    INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address, city, state, zip, emergency_contact, emergency_phone, notes, status)
    VALUES (@first_name, @last_name, @dob, @gender, @phone, @email, @address, @city, @state, @zip, @emergency_contact, @emergency_phone, @notes, @status)
  `);
  const result = stmt.run({ ...data, status: data.status || 'active' });
  return { success: true, id: result.lastInsertRowid };
});

ipcMain.handle('patients:update', (event, { id, data }) => {
  const stmt = db.prepare(`
    UPDATE patients SET first_name=@first_name, last_name=@last_name, dob=@dob, gender=@gender,
    phone=@phone, email=@email, address=@address, city=@city, state=@state, zip=@zip,
    emergency_contact=@emergency_contact, emergency_phone=@emergency_phone, notes=@notes,
    status=@status, updated_at=CURRENT_TIMESTAMP WHERE id=@id
  `);
  stmt.run({ ...data, id });
  return { success: true };
});

ipcMain.handle('patients:delete', (event, id) => {
  db.prepare('DELETE FROM patients WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('patients:search', (event, query) => {
  const q = `%${query}%`;
  return db.prepare(`
    SELECT * FROM patients WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?
    ORDER BY last_name, first_name LIMIT 20
  `).all(q, q, q, q);
});

ipcMain.handle('patients:import-csv', (event, rows) => {
  const insert = db.prepare(`
    INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address, city, state, zip, status)
    VALUES (@first_name, @last_name, @dob, @gender, @phone, @email, @address, @city, @state, @zip, 'active')
  `);
  const insertMany = db.transaction((patients) => {
    let count = 0;
    for (const p of patients) {
      insert.run(p);
      count++;
    }
    return count;
  });
  const count = insertMany(rows);
  return { success: true, count };
});

// INSURANCE
ipcMain.handle('insurance:get-by-patient', (event, patientId) => {
  return db.prepare('SELECT * FROM insurance WHERE patient_id = ? ORDER BY type').all(patientId);
});

ipcMain.handle('insurance:create', (event, data) => {
  const stmt = db.prepare(`
    INSERT INTO insurance (patient_id, type, provider, policy_number, group_number, subscriber_name, subscriber_dob, subscriber_id, relationship, copay)
    VALUES (@patient_id, @type, @provider, @policy_number, @group_number, @subscriber_name, @subscriber_dob, @subscriber_id, @relationship, @copay)
  `);
  const result = stmt.run(data);
  return { success: true, id: result.lastInsertRowid };
});

ipcMain.handle('insurance:update', (event, { id, data }) => {
  const stmt = db.prepare(`
    UPDATE insurance SET type=@type, provider=@provider, policy_number=@policy_number, group_number=@group_number,
    subscriber_name=@subscriber_name, subscriber_dob=@subscriber_dob, subscriber_id=@subscriber_id,
    relationship=@relationship, copay=@copay WHERE id=@id
  `);
  stmt.run({ ...data, id });
  return { success: true };
});

ipcMain.handle('insurance:delete', (event, id) => {
  db.prepare('DELETE FROM insurance WHERE id = ?').run(id);
  return { success: true };
});

// APPOINTMENTS
ipcMain.handle('appointments:get-all', () => {
  return db.prepare(`
    SELECT a.*, p.first_name, p.last_name, p.phone
    FROM appointments a JOIN patients p ON a.patient_id = p.id
    ORDER BY a.date DESC, a.time ASC
  `).all();
});

ipcMain.handle('appointments:get-by-date', (event, { startDate, endDate }) => {
  return db.prepare(`
    SELECT a.*, p.first_name, p.last_name, p.phone
    FROM appointments a JOIN patients p ON a.patient_id = p.id
    WHERE a.date BETWEEN ? AND ?
    ORDER BY a.date ASC, a.time ASC
  `).all(startDate, endDate);
});

ipcMain.handle('appointments:get-by-patient', (event, patientId) => {
  return db.prepare(`
    SELECT * FROM appointments WHERE patient_id = ? ORDER BY date DESC, time ASC
  `).all(patientId);
});

ipcMain.handle('appointments:create', (event, data) => {
  const stmt = db.prepare(`
    INSERT INTO appointments (patient_id, date, time, duration, type, status, notes, provider)
    VALUES (@patient_id, @date, @time, @duration, @type, @status, @notes, @provider)
  `);
  const result = stmt.run({ status: 'scheduled', provider: 'Dr. Walden Bailey', ...data });
  return { success: true, id: result.lastInsertRowid };
});

ipcMain.handle('appointments:update', (event, { id, data }) => {
  const stmt = db.prepare(`
    UPDATE appointments SET patient_id=@patient_id, date=@date, time=@time, duration=@duration,
    type=@type, status=@status, notes=@notes, provider=@provider WHERE id=@id
  `);
  stmt.run({ ...data, id });
  return { success: true };
});

ipcMain.handle('appointments:delete', (event, id) => {
  db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('appointments:update-status', (event, { id, status }) => {
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
  return { success: true };
});

// VISIT NOTES
ipcMain.handle('visit-notes:get-by-appointment', (event, appointmentId) => {
  return db.prepare('SELECT * FROM visit_notes WHERE appointment_id = ?').get(appointmentId);
});

ipcMain.handle('visit-notes:create', (event, data) => {
  const stmt = db.prepare(`
    INSERT INTO visit_notes (appointment_id, patient_id, subjective, objective, assessment, plan, diagnosis_codes, procedure_codes)
    VALUES (@appointment_id, @patient_id, @subjective, @objective, @assessment, @plan, @diagnosis_codes, @procedure_codes)
  `);
  const result = stmt.run(data);
  return { success: true, id: result.lastInsertRowid };
});

ipcMain.handle('visit-notes:update', (event, { id, data }) => {
  const stmt = db.prepare(`
    UPDATE visit_notes SET subjective=@subjective, objective=@objective, assessment=@assessment,
    plan=@plan, diagnosis_codes=@diagnosis_codes, procedure_codes=@procedure_codes WHERE id=@id
  `);
  stmt.run({ ...data, id });
  return { success: true };
});

// CLAIMS
ipcMain.handle('claims:get-all', () => {
  return db.prepare(`
    SELECT c.*, p.first_name, p.last_name
    FROM claims c JOIN patients p ON c.patient_id = p.id
    ORDER BY c.created_at DESC
  `).all();
});

ipcMain.handle('claims:get-by-patient', (event, patientId) => {
  return db.prepare('SELECT * FROM claims WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
});

ipcMain.handle('claims:create', (event, data) => {
  if (!data.claim_number) {
    const ts = Date.now().toString().slice(-6);
    data.claim_number = `CLM-${new Date().getFullYear()}-${ts}`;
  }
  const stmt = db.prepare(`
    INSERT INTO claims (patient_id, appointment_id, claim_number, insurer, claim_type, amount, paid_amount, status, filed_date, service_date, icd_codes, cpt_codes, notes)
    VALUES (@patient_id, @appointment_id, @claim_number, @insurer, @claim_type, @amount, @paid_amount, @status, @filed_date, @service_date, @icd_codes, @cpt_codes, @notes)
  `);
  const result = stmt.run({ appointment_id: null, paid_amount: 0, status: 'pending', ...data });
  return { success: true, id: result.lastInsertRowid };
});

ipcMain.handle('claims:update', (event, { id, data }) => {
  const stmt = db.prepare(`
    UPDATE claims SET patient_id=@patient_id, insurer=@insurer, claim_type=@claim_type, amount=@amount,
    paid_amount=@paid_amount, status=@status, filed_date=@filed_date, service_date=@service_date,
    icd_codes=@icd_codes, cpt_codes=@cpt_codes, notes=@notes WHERE id=@id
  `);
  stmt.run({ ...data, id });
  return { success: true };
});

ipcMain.handle('claims:delete', (event, id) => {
  db.prepare('DELETE FROM claims WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('claims:update-status', (event, { id, status }) => {
  db.prepare('UPDATE claims SET status = ? WHERE id = ?').run(status, id);
  return { success: true };
});

// PAYMENTS
ipcMain.handle('payments:get-by-patient', (event, patientId) => {
  return db.prepare('SELECT * FROM payments WHERE patient_id = ? ORDER BY date DESC').all(patientId);
});

ipcMain.handle('payments:get-all', () => {
  return db.prepare(`
    SELECT pay.*, p.first_name, p.last_name
    FROM payments pay JOIN patients p ON pay.patient_id = p.id
    ORDER BY pay.date DESC
  `).all();
});

ipcMain.handle('payments:create', (event, data) => {
  const stmt = db.prepare(`
    INSERT INTO payments (patient_id, claim_id, amount, method, reference, date, notes)
    VALUES (@patient_id, @claim_id, @amount, @method, @reference, @date, @notes)
  `);
  const result = stmt.run(data);
  // Update claim paid_amount if claim_id provided
  if (data.claim_id) {
    db.prepare(`
      UPDATE claims SET paid_amount = paid_amount + ? WHERE id = ?
    `).run(data.amount, data.claim_id);
    // Auto-update claim status
    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(data.claim_id);
    if (claim) {
      let newStatus = claim.status;
      if (claim.paid_amount >= claim.amount) newStatus = 'paid';
      else if (claim.paid_amount > 0) newStatus = 'partial';
      db.prepare('UPDATE claims SET status = ? WHERE id = ?').run(newStatus, data.claim_id);
    }
  }
  return { success: true, id: result.lastInsertRowid };
});

// REFERRALS
ipcMain.handle('referrals:get-all', () => {
  return db.prepare(`
    SELECT r.*, p.first_name, p.last_name, p.phone, p.email
    FROM referrals r JOIN patients p ON r.patient_id = p.id
    ORDER BY r.created_at DESC
  `).all();
});

ipcMain.handle('referrals:get-by-patient', (event, patientId) => {
  return db.prepare('SELECT * FROM referrals WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
});

ipcMain.handle('referrals:create', (event, data) => {
  const stmt = db.prepare(`
    INSERT INTO referrals (patient_id, type, recipient_name, recipient_email, recipient_phone, reason, status, sent_date, notes)
    VALUES (@patient_id, @type, @recipient_name, @recipient_email, @recipient_phone, @reason, @status, @sent_date, @notes)
  `);
  const result = stmt.run({ status: 'pending', ...data });
  return { success: true, id: result.lastInsertRowid };
});

ipcMain.handle('referrals:update', (event, { id, data }) => {
  const stmt = db.prepare(`
    UPDATE referrals SET type=@type, recipient_name=@recipient_name, recipient_email=@recipient_email,
    recipient_phone=@recipient_phone, reason=@reason, status=@status, sent_date=@sent_date, notes=@notes WHERE id=@id
  `);
  stmt.run({ ...data, id });
  return { success: true };
});

ipcMain.handle('referrals:delete', (event, id) => {
  db.prepare('DELETE FROM referrals WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('referrals:send-referral', (event, id) => {
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`UPDATE referrals SET status = 'sent', sent_date = ? WHERE id = ?`).run(today, id);
  return { success: true };
});

// REPORTS
ipcMain.handle('reports:revenue-summary', (event, { startDate, endDate }) => {
  const payments = db.prepare(`
    SELECT SUM(amount) as total FROM payments WHERE date BETWEEN ? AND ?
  `).get(startDate, endDate);
  const claims = db.prepare(`
    SELECT SUM(amount) as billed, SUM(paid_amount) as collected, COUNT(*) as count
    FROM claims WHERE service_date BETWEEN ? AND ?
  `).get(startDate, endDate);
  const pending = db.prepare(`
    SELECT SUM(amount - paid_amount) as pending FROM claims
    WHERE status NOT IN ('paid','denied') AND service_date BETWEEN ? AND ?
  `).get(startDate, endDate);
  return {
    total_collected: payments.total || 0,
    total_billed: claims.billed || 0,
    total_claims_collected: claims.collected || 0,
    claims_count: claims.count || 0,
    pending_amount: pending.pending || 0
  };
});

ipcMain.handle('reports:appointment-stats', (event, { startDate, endDate }) => {
  return db.prepare(`
    SELECT status, COUNT(*) as count FROM appointments
    WHERE date BETWEEN ? AND ? GROUP BY status
  `).all(startDate, endDate);
});

// FILE
ipcMain.handle('file:show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options || {
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    properties: ['openFile']
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { filePath, content };
});

// ── LOCATIONS ──────────────────────────────────────────────────────────────
ipcMain.handle('locations:get-all', () => {
  return db.prepare('SELECT * FROM locations WHERE active = 1 ORDER BY name').all();
});
ipcMain.handle('locations:create', (event, data) => {
  const result = db.prepare(`INSERT INTO locations (name, address, phone) VALUES (@name, @address, @phone)`).run(data);
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('locations:update', (event, { id, data }) => {
  db.prepare(`UPDATE locations SET name=@name, address=@address, phone=@phone, active=@active WHERE id=@id`).run({ ...data, id });
  return { success: true };
});

// ── INTAKE FORMS ────────────────────────────────────────────────────────────
ipcMain.handle('intake:get-all', () => {
  return db.prepare(`
    SELECT f.*, p.first_name, p.last_name
    FROM intake_forms f JOIN patients p ON f.patient_id = p.id
    ORDER BY f.created_at DESC
  `).all();
});
ipcMain.handle('intake:get-by-patient', (event, patientId) => {
  return db.prepare(`
    SELECT f.*, p.first_name, p.last_name
    FROM intake_forms f JOIN patients p ON f.patient_id = p.id
    WHERE f.patient_id = ? ORDER BY f.created_at DESC
  `).all(patientId);
});
ipcMain.handle('intake:get-by-id', (event, id) => {
  return db.prepare(`
    SELECT f.*, p.first_name, p.last_name
    FROM intake_forms f JOIN patients p ON f.patient_id = p.id
    WHERE f.id = ?
  `).get(id);
});
ipcMain.handle('intake:create', (event, data) => {
  const stmt = db.prepare(`
    INSERT INTO intake_forms (patient_id, full_name, dob, gender, address, phone, email, insurance_provider, policy_number, group_number, medical_history, current_medications, allergies, reason_for_visit, hipaa_acknowledged, signature, signature_date, submitted_at)
    VALUES (@patient_id, @full_name, @dob, @gender, @address, @phone, @email, @insurance_provider, @policy_number, @group_number, @medical_history, @current_medications, @allergies, @reason_for_visit, @hipaa_acknowledged, @signature, @signature_date, @submitted_at)
  `);
  const result = stmt.run({ hipaa_acknowledged: 0, ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('intake:update', (event, { id, data }) => {
  const stmt = db.prepare(`
    UPDATE intake_forms SET full_name=@full_name, dob=@dob, gender=@gender, address=@address, phone=@phone,
    email=@email, insurance_provider=@insurance_provider, policy_number=@policy_number, group_number=@group_number,
    medical_history=@medical_history, current_medications=@current_medications, allergies=@allergies,
    reason_for_visit=@reason_for_visit, hipaa_acknowledged=@hipaa_acknowledged, signature=@signature,
    signature_date=@signature_date, submitted_at=@submitted_at WHERE id=@id
  `);
  stmt.run({ hipaa_acknowledged: 0, ...data, id });
  return { success: true };
});

// ── INSURANCE VERIFICATION ──────────────────────────────────────────────────
ipcMain.handle('insverify:get-by-patient', (event, patientId) => {
  return db.prepare('SELECT * FROM insurance_verifications WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
});
ipcMain.handle('insverify:create', (event, data) => {
  const result = db.prepare(`
    INSERT INTO insurance_verifications (patient_id, insurance_id, provider, copay, deductible, deductible_met, coverage_limit, auth_required, auth_number, status, notes, verified_at)
    VALUES (@patient_id, @insurance_id, @provider, @copay, @deductible, @deductible_met, @coverage_limit, @auth_required, @auth_number, @status, @notes, @verified_at)
  `).run({ status: 'verified', verified_at: new Date().toISOString().split('T')[0], ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('insverify:update', (event, { id, data }) => {
  db.prepare(`
    UPDATE insurance_verifications SET copay=@copay, deductible=@deductible, deductible_met=@deductible_met,
    coverage_limit=@coverage_limit, auth_required=@auth_required, auth_number=@auth_number,
    status=@status, notes=@notes WHERE id=@id
  `).run({ ...data, id });
  return { success: true };
});

// ── SOAP NOTES ──────────────────────────────────────────────────────────────
ipcMain.handle('soap:get-by-appointment', (event, appointmentId) => {
  return db.prepare('SELECT * FROM soap_notes WHERE appointment_id = ?').get(appointmentId);
});
ipcMain.handle('soap:get-by-patient', (event, patientId) => {
  return db.prepare(`
    SELECT s.*, a.date, a.time, a.type as appt_type
    FROM soap_notes s JOIN appointments a ON s.appointment_id = a.id
    WHERE s.patient_id = ? ORDER BY a.date DESC
  `).all(patientId);
});
ipcMain.handle('soap:get-all', () => {
  return db.prepare(`
    SELECT s.*, p.first_name, p.last_name, a.date as appt_date, a.time as appt_time, a.type as appt_type
    FROM soap_notes s
    JOIN patients p ON s.patient_id = p.id
    LEFT JOIN appointments a ON s.appointment_id = a.id
    ORDER BY COALESCE(s.note_date, s.created_at) DESC
  `).all();
});
ipcMain.handle('soap:create', (event, data) => {
  const result = db.prepare(`
    INSERT INTO soap_notes (appointment_id, patient_id, subjective, objective, assessment, plan, diagnosis_codes, procedure_codes, note_date, created_by)
    VALUES (@appointment_id, @patient_id, @subjective, @objective, @assessment, @plan, @diagnosis_codes, @procedure_codes, @note_date, @created_by)
  `).run({ created_by: null, note_date: null, ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('soap:delete', (event, id) => {
  db.prepare('DELETE FROM soap_notes WHERE id = ?').run(id);
  return { success: true };
});
ipcMain.handle('soap:update', (event, { id, data }) => {
  db.prepare(`
    UPDATE soap_notes SET subjective=@subjective, objective=@objective, assessment=@assessment,
    plan=@plan, diagnosis_codes=@diagnosis_codes, procedure_codes=@procedure_codes WHERE id=@id
  `).run({ ...data, id });
  return { success: true };
});

// ── EOB RECORDS ─────────────────────────────────────────────────────────────
ipcMain.handle('eob:get-all', () => {
  return db.prepare(`
    SELECT e.*, p.first_name, p.last_name, c.claim_number
    FROM eob_records e
    JOIN patients p ON e.patient_id = p.id
    LEFT JOIN claims c ON e.claim_id = c.id
    ORDER BY e.received_date DESC, e.created_at DESC
  `).all();
});
ipcMain.handle('eob:get-by-patient', (event, patientId) => {
  return db.prepare('SELECT * FROM eob_records WHERE patient_id = ? ORDER BY received_date DESC').all(patientId);
});
ipcMain.handle('eob:create', (event, data) => {
  // Auto-detect discrepancy
  if (data.claim_id && !data.discrepancy_flag) {
    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(data.claim_id);
    if (claim && Math.abs(claim.amount - data.billed_amount) > 0.01) {
      data.discrepancy_flag = 1;
      data.discrepancy_notes = data.discrepancy_notes || `Billed amount mismatch: claim shows $${claim.amount}, EOB shows $${data.billed_amount}`;
    }
  }
  const result = db.prepare(`
    INSERT INTO eob_records (claim_id, patient_id, insurer, billed_amount, allowed_amount, paid_amount, patient_responsibility, adjustment_reason, status, received_date, discrepancy_flag, discrepancy_notes)
    VALUES (@claim_id, @patient_id, @insurer, @billed_amount, @allowed_amount, @paid_amount, @patient_responsibility, @adjustment_reason, @status, @received_date, @discrepancy_flag, @discrepancy_notes)
  `).run({ claim_id: null, discrepancy_flag: 0, status: 'received', ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('eob:delete', (event, id) => {
  db.prepare('DELETE FROM eob_records WHERE id = ?').run(id);
  return { success: true };
});
ipcMain.handle('eob:update', (event, { id, data }) => {
  db.prepare(`
    UPDATE eob_records SET insurer=@insurer, received_date=@received_date, billed_amount=@billed_amount,
    allowed_amount=@allowed_amount, paid_amount=@paid_amount,
    patient_responsibility=@patient_responsibility, adjustment_reason=@adjustment_reason,
    status=@status, discrepancy_flag=@discrepancy_flag, discrepancy_notes=@discrepancy_notes WHERE id=@id
  `).run({ ...data, id });
  return { success: true };
});

// ── REMINDERS ───────────────────────────────────────────────────────────────
ipcMain.handle('reminders:delete-template', (event, id) => {
  db.prepare('DELETE FROM reminder_templates WHERE id = ?').run(id);
  return { success: true };
});
ipcMain.handle('reminders:get-templates', () => {
  return db.prepare('SELECT * FROM reminder_templates ORDER BY type, trigger_hours').all();
});
ipcMain.handle('reminders:update-template', (event, { id, data }) => {
  db.prepare(`UPDATE reminder_templates SET name=@name, type=@type, trigger_hours=@trigger_hours, subject=@subject, body=@body, active=@active WHERE id=@id`).run({ ...data, id });
  return { success: true };
});
ipcMain.handle('reminders:create-template', (event, data) => {
  const result = db.prepare(`INSERT INTO reminder_templates (name, type, trigger_hours, subject, body, active) VALUES (@name, @type, @trigger_hours, @subject, @body, @active)`).run({ active: 1, ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('reminders:get-log', () => {
  return db.prepare(`
    SELECT l.*, p.first_name || ' ' || p.last_name AS patient_name
    FROM reminder_log l LEFT JOIN patients p ON l.patient_id = p.id
    ORDER BY l.sent_at DESC LIMIT 200
  `).all();
});
ipcMain.handle('reminders:send', async (event, { appointmentId, templateId }) => {
  try {
    const appt = db.prepare(`SELECT a.*, p.first_name, p.last_name, p.phone, p.email FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.id = ?`).get(appointmentId);
    const template = db.prepare('SELECT * FROM reminder_templates WHERE id = ?').get(templateId);
    if (!appt || !template) return { success: false, error: 'Not found' };

    const body = template.body
      .replace(/\{\{patient_name\}\}/g, `${appt.first_name} ${appt.last_name}`)
      .replace(/\{\{date\}\}/g, appt.date)
      .replace(/\{\{time\}\}/g, appt.time);

    // Log the reminder (actual sending requires Twilio/SendGrid credentials in env)
    db.prepare(`INSERT INTO reminder_log (appointment_id, patient_id, template_id, type, recipient, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      appointmentId, appt.patient_id, templateId, template.type,
      template.type === 'sms' ? appt.phone : appt.email, body, 'sent'
    );
    return { success: true, message: body, recipient: template.type === 'sms' ? appt.phone : appt.email };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── WAITLIST ─────────────────────────────────────────────────────────────────
ipcMain.handle('waitlist:get-all', () => {
  return db.prepare(`
    SELECT w.*, p.first_name || ' ' || p.last_name AS patient_name, p.phone AS patient_phone, p.email
    FROM waitlist w JOIN patients p ON w.patient_id = p.id
    ORDER BY w.created_at ASC
  `).all();
});
ipcMain.handle('waitlist:create', (event, data) => {
  const result = db.prepare(`INSERT INTO waitlist (patient_id, desired_date, desired_time, location_id, notes, status) VALUES (@patient_id, @desired_date, @desired_time, @location_id, @notes, 'waiting')`).run({ location_id: null, ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('waitlist:update-status', (event, { id, status }) => {
  const notifiedAt = status === 'notified' ? new Date().toISOString().split('T')[0] : null;
  db.prepare('UPDATE waitlist SET status = ?, notified_at = ? WHERE id = ?').run(status, notifiedAt, id);
  return { success: true };
});
ipcMain.handle('waitlist:delete', (event, id) => {
  db.prepare('DELETE FROM waitlist WHERE id = ?').run(id);
  return { success: true };
});

// ── TRANSPORTATION ───────────────────────────────────────────────────────────
ipcMain.handle('transport:get-all', () => {
  return db.prepare(`
    SELECT t.*, p.first_name, p.last_name, p.phone, a.date, a.time
    FROM transportation t
    JOIN patients p ON t.patient_id = p.id
    LEFT JOIN appointments a ON t.appointment_id = a.id
    ORDER BY a.date DESC, a.time ASC
  `).all();
});
ipcMain.handle('transport:get-by-patient', (event, patientId) => {
  return db.prepare('SELECT * FROM transportation WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
});
ipcMain.handle('transport:create', (event, data) => {
  const result = db.prepare(`
    INSERT INTO transportation (appointment_id, patient_id, pickup_address, pickup_time, dropoff_address, driver_name, driver_notes, status)
    VALUES (@appointment_id, @patient_id, @pickup_address, @pickup_time, @dropoff_address, @driver_name, @driver_notes, @status)
  `).run({ status: 'requested', ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('transport:update', (event, { id, data }) => {
  db.prepare(`
    UPDATE transportation SET pickup_address=@pickup_address, pickup_time=@pickup_time, dropoff_address=@dropoff_address,
    driver_name=@driver_name, driver_notes=@driver_notes, status=@status WHERE id=@id
  `).run({ ...data, id });
  return { success: true };
});
ipcMain.handle('transport:delete', (event, id) => {
  db.prepare('DELETE FROM transportation WHERE id = ?').run(id);
  return { success: true };
});

// ── PI CASES ─────────────────────────────────────────────────────────────────
ipcMain.handle('pi:get-all', () => {
  return db.prepare(`
    SELECT pi.*, p.first_name || ' ' || p.last_name AS patient_name, p.phone
    FROM pi_cases pi JOIN patients p ON pi.patient_id = p.id
    ORDER BY pi.created_at DESC
  `).all();
});
ipcMain.handle('pi:get-by-patient', (event, patientId) => {
  return db.prepare('SELECT * FROM pi_cases WHERE patient_id = ? ORDER BY created_at DESC').all(patientId);
});
ipcMain.handle('pi:create', (event, data) => {
  const result = db.prepare(`
    INSERT INTO pi_cases (patient_id, referral_id, accident_date, accident_description, attorney_name, attorney_firm, attorney_phone, attorney_email, case_number, lien_amount, settlement_amount, case_status, notes)
    VALUES (@patient_id, @referral_id, @accident_date, @accident_description, @attorney_name, @attorney_firm, @attorney_phone, @attorney_email, @case_number, @lien_amount, @settlement_amount, @case_status, @notes)
  `).run({ referral_id: null, case_status: 'open', lien_amount: 0, settlement_amount: 0, ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('pi:update', (event, { id, data }) => {
  db.prepare(`
    UPDATE pi_cases SET accident_date=@accident_date, accident_description=@accident_description, attorney_name=@attorney_name,
    attorney_firm=@attorney_firm, attorney_phone=@attorney_phone, attorney_email=@attorney_email, case_number=@case_number,
    lien_amount=@lien_amount, settlement_amount=@settlement_amount, case_status=@case_status, notes=@notes WHERE id=@id
  `).run({ ...data, id });
  return { success: true };
});
ipcMain.handle('pi:delete', (event, id) => {
  db.prepare('DELETE FROM pi_cases WHERE id = ?').run(id);
  return { success: true };
});

// ── HCFA FORMS ───────────────────────────────────────────────────────────────
ipcMain.handle('hcfa:get-by-patient', (event, patientId) => {
  return db.prepare(`
    SELECT h.*, s.note_date, s.diagnosis_codes, s.procedure_codes
    FROM hcfa_forms h
    LEFT JOIN soap_notes s ON h.soap_note_id = s.id
    WHERE h.patient_id = ?
    ORDER BY h.created_at DESC
  `).all(patientId);
});
ipcMain.handle('hcfa:get-by-soap', (event, soapNoteId) => {
  return db.prepare('SELECT * FROM hcfa_forms WHERE soap_note_id = ? ORDER BY created_at DESC').all(soapNoteId);
});
ipcMain.handle('hcfa:create', (event, data) => {
  const result = db.prepare(`
    INSERT INTO hcfa_forms (soap_note_id, patient_id, form_data, status, created_by)
    VALUES (@soap_note_id, @patient_id, @form_data, @status, @created_by)
  `).run({ soap_note_id: null, status: 'Draft', created_by: null, ...data });
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('hcfa:update', (event, { id, data }) => {
  db.prepare(`
    UPDATE hcfa_forms SET form_data=@form_data, status=@status, fax_recipient=@fax_recipient,
    fax_sent_at=@fax_sent_at, fax_sent_by=@fax_sent_by, printed_at=@printed_at WHERE id=@id
  `).run({ fax_recipient: null, fax_sent_at: null, fax_sent_by: null, printed_at: null, ...data, id });
  return { success: true };
});
ipcMain.handle('hcfa:delete', (event, id) => {
  db.prepare('DELETE FROM hcfa_forms WHERE id = ?').run(id);
  return { success: true };
});


// ── TIME CLOCK ───────────────────────────────────────────────────────────────
ipcMain.handle('timeclock:clock-in', (event, { userId, notes }) => {
  // Check not already clocked in
  const open = db.prepare('SELECT id FROM time_clock WHERE user_id = ? AND clock_out IS NULL').get(userId);
  if (open) return { success: false, error: 'Already clocked in' };
  const result = db.prepare(`INSERT INTO time_clock (user_id, clock_in, notes) VALUES (?, CURRENT_TIMESTAMP, ?)`).run(userId, notes || null);
  return { success: true, id: result.lastInsertRowid };
});
ipcMain.handle('timeclock:clock-out', (event, { userId }) => {
  const open = db.prepare('SELECT id FROM time_clock WHERE user_id = ? AND clock_out IS NULL').get(userId);
  if (!open) return { success: false, error: 'Not clocked in' };
  db.prepare('UPDATE time_clock SET clock_out = CURRENT_TIMESTAMP WHERE id = ?').run(open.id);
  return { success: true };
});
ipcMain.handle('timeclock:get-status', (event, userId) => {
  return db.prepare('SELECT * FROM time_clock WHERE user_id = ? AND clock_out IS NULL').get(userId);
});
ipcMain.handle('timeclock:get-entries', (event, { userId, startDate, endDate }) => {
  const query = userId
    ? 'SELECT t.*, u.full_name, u.username FROM time_clock t JOIN users u ON t.user_id = u.id WHERE t.user_id = ? AND date(t.clock_in) BETWEEN ? AND ? ORDER BY t.clock_in DESC'
    : 'SELECT t.*, u.full_name, u.username FROM time_clock t JOIN users u ON t.user_id = u.id WHERE date(t.clock_in) BETWEEN ? AND ? ORDER BY t.clock_in DESC';
  return userId
    ? db.prepare(query).all(userId, startDate, endDate)
    : db.prepare(query).all(startDate, endDate);
});
ipcMain.handle('timeclock:approve', (event, { id, approverId }) => {
  db.prepare('UPDATE time_clock SET approved = 1, approved_by = ? WHERE id = ?').run(approverId, id);
  return { success: true };
});
ipcMain.handle('timeclock:update', (event, { id, data }) => {
  db.prepare('UPDATE time_clock SET clock_in=@clock_in, clock_out=@clock_out, notes=@notes WHERE id=@id').run({ ...data, id });
  return { success: true };
});
ipcMain.handle('timeclock:get-all-users', () => {
  return db.prepare('SELECT id, username, full_name, role FROM users ORDER BY full_name').all();
});

// ── REPORTS (extended) ───────────────────────────────────────────────────────
ipcMain.handle('reports:full-dashboard', (event, { startDate, endDate }) => {
  const revenue = db.prepare(`SELECT SUM(amount) as total FROM payments WHERE date BETWEEN ? AND ?`).get(startDate, endDate);
  const claims = db.prepare(`SELECT SUM(amount) as billed, SUM(paid_amount) as collected, COUNT(*) as total, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count, SUM(CASE WHEN status='denied' THEN 1 ELSE 0 END) as denied_count FROM claims WHERE service_date BETWEEN ? AND ?`).get(startDate, endDate);
  const appts = db.prepare(`SELECT status, COUNT(*) as count FROM appointments WHERE date BETWEEN ? AND ? GROUP BY status`).all(startDate, endDate);
  const insurers = db.prepare(`SELECT insurer, COUNT(*) as count, SUM(amount) as total FROM claims WHERE service_date BETWEEN ? AND ? GROUP BY insurer ORDER BY total DESC`).all(startDate, endDate);
  const referrals = db.prepare(`SELECT status, COUNT(*) as count FROM referrals WHERE date(created_at) BETWEEN ? AND ? GROUP BY status`).all(startDate, endDate);
  const monthly = db.prepare(`SELECT strftime('%Y-%m', date) as month, SUM(amount) as revenue FROM payments WHERE date BETWEEN ? AND ? GROUP BY month ORDER BY month`).all(startDate, endDate);
  const newPatients = db.prepare(`SELECT COUNT(*) as count FROM patients WHERE date(created_at) BETWEEN ? AND ?`).get(startDate, endDate);
  const piCases = db.prepare(`SELECT case_status, COUNT(*) as count, SUM(lien_amount) as total_lien FROM pi_cases GROUP BY case_status`).all();
  return { revenue: revenue.total || 0, claims, appts, insurers, referrals, monthly, newPatients: newPatients.count, piCases };
});

// ── PRINT / EXPORT ───────────────────────────────────────────────────────────
ipcMain.handle('print:show-dialog', async () => {
  const result = await mainWindow.webContents.print({}, (success) => success);
  return { success: true };
});
ipcMain.handle('file:save-dialog', async (event, { defaultPath, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'export.html',
    filters: [{ name: 'HTML Files', extensions: ['html'] }, { name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return { success: true, filePath: result.filePath };
});

// ── WHISPER OFFLINE TRANSCRIPTION ────────────────────────────────────────────
ipcMain.handle('transcribe-audio', async (event, audioBuffer) => {
  const tempFile = path.join(os.tmpdir(), `spinepay_${Date.now()}.wav`);
  try {
    fs.writeFileSync(tempFile, Buffer.from(audioBuffer));
    console.log('[Whisper] Transcribing:', tempFile);
    const result = await nodewhisper(tempFile, {
      modelName: 'base.en',
      autoDownloadModelName: 'base.en',
      verbose: false,
      whisperOptions: { outputInText: true }
    });
    console.log('[Whisper] Result:', result);
    return { success: true, text: result };
  } catch (err) {
    console.error('[Whisper] Error:', err.message);
    return { success: false, error: err.message };
  } finally {
    try { fs.unlinkSync(tempFile); } catch (_) {}
  }
});

// APP LIFECYCLE
app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
