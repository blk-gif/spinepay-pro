const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

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
  `);

  // Insert default admin if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    db.prepare(`INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)`).run(
      'admin', hashPassword('admin123'), 'admin', 'Administrator'
    );
    db.prepare(`INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)`).run(
      'staff1', hashPassword('staff123'), 'staff', 'Front Desk Staff'
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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
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
  const result = stmt.run({ paid_amount: 0, status: 'pending', ...data });
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
