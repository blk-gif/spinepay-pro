'use strict';

// ── Settings Module ───────────────────────────────────────────────────────────
window.Settings = (() => {
  const { toast } = window.App;

  function render() {
    const view = document.getElementById('view-settings');
    view.innerHTML = `
      <div style="max-width:620px;margin:0 auto;">
        <div class="card card-gold">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-gear"></i> Practice Billing Settings</div>
          </div>
          <div class="card-body">
            <div style="font-size:12px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;">
              CMS-1500 / HCFA Billing Information
            </div>
            <div class="form-grid form-grid-2" style="margin-bottom:20px;">
              <div class="form-group">
                <label class="form-label">Practice NPI <span style="font-size:10px;color:var(--text-muted);">(Box 33)</span></label>
                <input type="text" class="form-control" id="settingNpi" placeholder="10-digit NPI number" maxlength="10" />
              </div>
              <div class="form-group">
                <label class="form-label">Federal EIN / Tax ID <span style="font-size:10px;color:var(--text-muted);">(Box 25)</span></label>
                <input type="text" class="form-control" id="settingEin" placeholder="XX-XXXXXXX" maxlength="20" />
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                <label class="form-label">Billing Provider Name <span style="font-size:10px;color:var(--text-muted);">(Box 33)</span></label>
                <input type="text" class="form-control" id="settingBillingName" placeholder="Practice or clinic name as it appears on claims" />
              </div>
              <div class="form-group">
                <label class="form-label">Accepting Assignment <span style="font-size:10px;color:var(--text-muted);">(Box 27)</span></label>
                <select class="form-control" id="settingAcceptAssign">
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              </div>
            </div>
            <button class="btn btn-primary" id="settingsSaveBtn">
              <i class="fa-solid fa-floppy-disk"></i> Save Settings
            </button>
          </div>
        </div>
      </div>

        <!-- BACKUP STATUS SECTION -->
        <div class="card card-gold" style="margin-top:24px;">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-database"></i> Automated Backups</div>
          </div>
          <div class="card-body">
            <div id="backupStatusArea" style="margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <span id="backupHealthDot" style="width:12px;height:12px;border-radius:50%;background:#555;display:inline-block;"></span>
                <span id="backupHealthMsg" style="font-size:13px;color:var(--text-muted);">Loading backup status…</span>
              </div>
              <div style="font-size:12px;color:var(--text-muted);" id="backupFolderLine"></div>
              <div style="font-size:12px;color:var(--text-muted);" id="backupLastFileLine"></div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
              <button class="btn btn-secondary btn-sm" id="backupRunNowBtn">
                <i class="fa-solid fa-play"></i> Run Backup Now
              </button>
              <button class="btn btn-secondary btn-sm" id="backupChangeFolderBtn">
                <i class="fa-solid fa-folder-open"></i> Change Folder
              </button>
            </div>
            <div style="font-size:12px;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">
              Recent Backups (last 10)
            </div>
            <div id="backupListTable" style="font-size:12px;color:var(--text-muted);">Loading…</div>
          </div>
        </div>
      </div>
    `;
    // Append staff accounts section
    const staffEl = document.createElement('div');
    staffEl.id = 'staffAccountsWrapper';
    staffEl.innerHTML = buildStaffSectionHTML();
    view.appendChild(staffEl);

    // Append updates section
    const updatesEl = document.createElement('div');
    updatesEl.style.cssText = 'max-width:620px;margin:24px auto 0;';
    updatesEl.innerHTML = `
      <div class="card card-gold">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-arrows-rotate"></i> Software Updates</div>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <span id="updateStatusDot" style="width:12px;height:12px;border-radius:50%;background:#2ecc71;flex-shrink:0;"></span>
            <span id="updateStatusMsg" style="font-size:13px;color:var(--text-muted);">SpinePay Pro is up to date.</span>
          </div>
          <button id="updateInstallBtn" style="display:none;" class="btn btn-primary btn-sm" onclick="window.api.updater.installNow()">
            <i class="fa-solid fa-rotate"></i> Restart &amp; Install Update
          </button>
        </div>
      </div>`;
    view.appendChild(updatesEl);

    // Wire up updater events
    if (window.api && window.api.updater) {
      window.api.updater.onUpdateAvailable(() => {
        const dot = document.getElementById('updateStatusDot');
        const msg = document.getElementById('updateStatusMsg');
        if (dot) dot.style.background = '#f59e0b';
        if (msg) msg.textContent = 'A new version is available and downloading…';
      });
      window.api.updater.onUpdateDownloaded(() => {
        const dot = document.getElementById('updateStatusDot');
        const msg = document.getElementById('updateStatusMsg');
        const btn = document.getElementById('updateInstallBtn');
        if (dot) dot.style.background = '#d4af37';
        if (msg) msg.textContent = 'Update downloaded — restart to install.';
        if (btn) btn.style.display = 'inline-flex';
      });
    }

    loadSettings();
    loadBackupStatus();
    loadStaffAccounts();
    document.getElementById('settingsSaveBtn').addEventListener('click', save);
    document.getElementById('backupRunNowBtn').addEventListener('click', runBackupNow);
    document.getElementById('backupChangeFolderBtn').addEventListener('click', changeBackupFolder);
    document.getElementById('addStaffBtn').addEventListener('click', openAddStaffModal);
    document.getElementById('addStaffModalClose').addEventListener('click', closeAddStaffModal);
    document.getElementById('addStaffCancelBtn').addEventListener('click', closeAddStaffModal);
    document.getElementById('addStaffSaveBtn').addEventListener('click', saveNewStaff);
    document.getElementById('genPasswordBtn').addEventListener('click', () => {
      document.getElementById('staffTempPassword').value = generateTempPassword();
    });
    document.getElementById('addStaffModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeAddStaffModal();
    });
  }

  async function loadSettings() {
    try {
      const s = await window.api.settings.getAll();
      document.getElementById('settingNpi').value          = s.PRACTICE_NPI            || '';
      document.getElementById('settingEin').value          = s.PRACTICE_EIN            || '';
      document.getElementById('settingBillingName').value  = s.BILLING_PROVIDER_NAME   || 'Walden Bailey Chiropractic';
      document.getElementById('settingAcceptAssign').value = s.ACCEPTING_ASSIGNMENT    || 'YES';
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function loadBackupStatus() {
    try {
      const status = await window.api.backup.getStatus();
      const dot = document.getElementById('backupHealthDot');
      const msg = document.getElementById('backupHealthMsg');
      const folderLine = document.getElementById('backupFolderLine');
      const fileLine = document.getElementById('backupLastFileLine');

      if (!status.backupFolder) {
        dot.style.background = '#f59e0b';
        msg.textContent = 'No backup folder configured.';
      } else if (!status.lastBackupAt) {
        dot.style.background = '#f59e0b';
        msg.textContent = 'No backups yet. Backups run automatically at midnight.';
      } else {
        const lastDate = new Date(status.lastBackupAt);
        const hoursAgo = (Date.now() - lastDate.getTime()) / 3600000;
        dot.style.background = hoursAgo < 36 ? '#22c55e' : '#ef4444';
        msg.textContent = `Last backup: ${lastDate.toLocaleString()}`;
      }

      folderLine.textContent = status.backupFolder ? `Folder: ${status.backupFolder}` : '';
      if (status.lastBackupSize) {
        const kb = (parseInt(status.lastBackupSize) / 1024).toFixed(1);
        fileLine.textContent = `Last file size: ${kb} KB`;
      }

      // Load list
      const files = await window.api.backup.list();
      const table = document.getElementById('backupListTable');
      if (!files.length) {
        table.innerHTML = '<span>No backups found in configured folder.</span>';
      } else {
        table.innerHTML = `
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="color:var(--gold);">
              <th style="text-align:left;padding:4px 8px;">File</th>
              <th style="text-align:right;padding:4px 8px;">Size</th>
              <th style="text-align:right;padding:4px 8px;">Date</th>
            </tr></thead>
            <tbody>
              ${files.map(f => `
                <tr style="border-top:1px solid rgba(255,255,255,0.06);">
                  <td style="padding:4px 8px;font-family:monospace;">${f.name}</td>
                  <td style="padding:4px 8px;text-align:right;">${(f.size/1024).toFixed(1)} KB</td>
                  <td style="padding:4px 8px;text-align:right;">${new Date(f.date).toLocaleString()}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
      }
    } catch (err) {
      console.error('Backup status error:', err);
    }
  }

  async function runBackupNow() {
    const btn = document.getElementById('backupRunNowBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Backing up…';
    try {
      const result = await window.api.backup.runNow();
      if (result.success) {
        toast('Backup completed successfully', 'success');
        loadBackupStatus();
      } else {
        toast(result.error || 'Backup failed', 'error');
      }
    } catch (err) {
      toast('Backup error: ' + err.message, 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Run Backup Now';
  }

  async function changeBackupFolder() {
    try {
      const result = await window.api.backup.setFolder();
      if (result.success) {
        toast(`Backup folder set: ${result.folder}`, 'success');
        loadBackupStatus();
      }
    } catch (err) {
      toast('Could not set folder', 'error');
    }
  }

  async function save() {
    const npi    = document.getElementById('settingNpi').value.trim();
    const ein    = document.getElementById('settingEin').value.trim();
    const name   = document.getElementById('settingBillingName').value.trim();
    const assign = document.getElementById('settingAcceptAssign').value;
    try {
      await Promise.all([
        window.api.settings.set('PRACTICE_NPI',          npi),
        window.api.settings.set('PRACTICE_EIN',          ein),
        window.api.settings.set('BILLING_PROVIDER_NAME', name),
        window.api.settings.set('ACCEPTING_ASSIGNMENT',  assign)
      ]);
      toast('Settings saved', 'success');
    } catch (err) {
      toast('Failed to save settings', 'error');
    }
  }

  // ── Staff Accounts ──────────────────────────────────────────────────────────

  function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    let p = '';
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
  }

  function buildStaffSectionHTML() {
    return `
      <div style="max-width:900px;margin:24px auto 0;">
        <div class="card card-gold">
          <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
            <div class="card-title"><i class="fa-solid fa-users-gear"></i> Staff Accounts</div>
            <button class="btn btn-primary btn-sm" id="addStaffBtn">
              <i class="fa-solid fa-user-plus"></i> Add Staff Member
            </button>
          </div>
          <div class="card-body" style="padding:0;">
            <div id="staffAccountsTable" style="font-size:13px;">
              <div style="padding:20px;color:var(--text-muted);">Loading staff accounts…</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Staff Modal -->
      <div class="modal-overlay" id="addStaffModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);align-items:center;justify-content:center;">
        <div class="modal" style="width:520px;max-width:95vw;">
          <div class="modal-header">
            <div class="modal-title"><i class="fa-solid fa-user-plus"></i> Add Staff Member</div>
            <button class="modal-close" id="addStaffModalClose">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">First Name</label>
                <input type="text" class="form-control" id="staffFirstName" placeholder="First name" />
              </div>
              <div class="form-group">
                <label class="form-label">Last Name</label>
                <input type="text" class="form-control" id="staffLastName" placeholder="Last name" />
              </div>
              <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" class="form-control" id="staffUsername" placeholder="login username" autocomplete="off" />
              </div>
              <div class="form-group">
                <label class="form-label">Role</label>
                <select class="form-control" id="staffRole">
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                <label class="form-label">Email Address</label>
                <input type="email" class="form-control" id="staffEmail" placeholder="staff@example.com" />
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                <label class="form-label">Temporary Password</label>
                <div style="display:flex;gap:8px;">
                  <input type="text" class="form-control" id="staffTempPassword" readonly
                    style="font-family:monospace;letter-spacing:2px;flex:1;" />
                  <button class="btn btn-secondary btn-sm" id="genPasswordBtn" type="button" style="white-space:nowrap;">
                    <i class="fa-solid fa-rotate"></i> Generate
                  </button>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                  <i class="fa-solid fa-circle-info"></i> Staff member must change this on first login.
                </div>
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" id="staffSendEmail" checked
                    style="width:16px;height:16px;accent-color:var(--gold);" />
                  <span style="font-size:13px;color:var(--text-secondary);">
                    Send welcome email with login instructions and HIPAA acknowledgment link
                  </span>
                </label>
              </div>
            </div>
            <div id="addStaffError" style="display:none;background:rgba(231,76,60,.12);border:1px solid rgba(231,76,60,.3);border-radius:6px;padding:8px 12px;color:#ff6b6b;font-size:13px;margin-top:8px;"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="addStaffCancelBtn">Cancel</button>
            <button class="btn btn-primary" id="addStaffSaveBtn">
              <i class="fa-solid fa-user-plus"></i> Create Account
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function openAddStaffModal() {
    document.getElementById('staffFirstName').value = '';
    document.getElementById('staffLastName').value = '';
    document.getElementById('staffUsername').value = '';
    document.getElementById('staffRole').value = 'staff';
    document.getElementById('staffEmail').value = '';
    document.getElementById('staffTempPassword').value = generateTempPassword();
    document.getElementById('staffSendEmail').checked = true;
    document.getElementById('addStaffError').style.display = 'none';
    const modal = document.getElementById('addStaffModal');
    modal.style.display = 'flex';
  }

  function closeAddStaffModal() {
    document.getElementById('addStaffModal').style.display = 'none';
  }

  async function saveNewStaff() {
    const firstName  = document.getElementById('staffFirstName').value.trim();
    const lastName   = document.getElementById('staffLastName').value.trim();
    const username   = document.getElementById('staffUsername').value.trim();
    const role       = document.getElementById('staffRole').value;
    const email      = document.getElementById('staffEmail').value.trim();
    const tempPwd    = document.getElementById('staffTempPassword').value;
    const sendEmail  = document.getElementById('staffSendEmail').checked;
    const errEl      = document.getElementById('addStaffError');

    if (!firstName || !lastName) { errEl.textContent = 'First and last name are required.'; errEl.style.display = 'block'; return; }
    if (!username) { errEl.textContent = 'Username is required.'; errEl.style.display = 'block'; return; }
    if (!tempPwd) { errEl.textContent = 'Please generate a temporary password.'; errEl.style.display = 'block'; return; }

    const saveBtn = document.getElementById('addStaffSaveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating…';
    errEl.style.display = 'none';

    try {
      const result = await window.api.staff.create({ first_name: firstName, last_name: lastName, username, role, email, temp_password_plain: tempPwd });
      if (!result.success) {
        errEl.textContent = result.error || 'Failed to create account.';
        errEl.style.display = 'block';
        return;
      }

      if (sendEmail && email) {
        await window.api.staff.sendWelcomeEmail({ name: `${firstName} ${lastName}`, username, email, tempPassword: tempPwd });
      }

      closeAddStaffModal();
      toast(`Staff account created for ${firstName} ${lastName}`, 'success');
      loadStaffAccounts();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
    }
  }

  async function loadStaffAccounts() {
    const container = document.getElementById('staffAccountsTable');
    if (!container) return;
    try {
      const staff = await window.api.staff.getAll();
      if (!staff.length) {
        container.innerHTML = '<div style="padding:20px;color:var(--text-muted);">No staff accounts found.</div>';
        return;
      }
      container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,215,0,.15);">
              <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Name</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Username</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Role</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Last Login</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">HIPAA</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Status</th>
              <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${staff.map(s => `
              <tr style="border-bottom:1px solid rgba(255,255,255,.05);">
                <td style="padding:10px 16px;font-weight:600;color:var(--text-primary);">${s.full_name}</td>
                <td style="padding:10px 16px;color:var(--text-muted);font-family:monospace;">${s.username}</td>
                <td style="padding:10px 16px;">
                  <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
                    background:${s.role === 'admin' ? 'rgba(212,175,55,.15)' : 'rgba(52,152,219,.15)'};
                    color:${s.role === 'admin' ? 'var(--gold)' : '#3498db'};">
                    ${s.role}
                  </span>
                </td>
                <td style="padding:10px 16px;color:var(--text-muted);font-size:12px;">
                  ${s.last_login ? new Date(s.last_login).toLocaleDateString() : 'Never'}
                </td>
                <td style="padding:10px 16px;">
                  <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;
                    background:${s.hipaa_signed ? 'rgba(46,204,113,.12)' : 'rgba(231,76,60,.12)'};
                    color:${s.hipaa_signed ? '#2ecc71' : '#e74c3c'};">
                    ${s.hipaa_signed ? 'Signed' : 'Pending'}
                  </span>
                </td>
                <td style="padding:10px 16px;">
                  <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;
                    background:${s.active !== 0 ? 'rgba(46,204,113,.12)' : 'rgba(100,100,100,.15)'};
                    color:${s.active !== 0 ? '#2ecc71' : '#888'};">
                    ${s.active !== 0 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style="padding:10px 16px;text-align:right;">
                  <button class="btn btn-sm" onclick="window.Settings._toggleStaff(${s.id}, ${s.active !== 0 ? 0 : 1}, '${s.full_name.replace(/'/g, "\\'")}')"
                    style="padding:3px 10px;font-size:11px;background:${s.active !== 0 ? 'rgba(231,76,60,.15)' : 'rgba(46,204,113,.15)'};
                      color:${s.active !== 0 ? '#e74c3c' : '#2ecc71'};border:1px solid ${s.active !== 0 ? 'rgba(231,76,60,.3)' : 'rgba(46,204,113,.3)'};border-radius:4px;cursor:pointer;">
                    ${s.active !== 0 ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      if (container) container.innerHTML = `<div style="padding:20px;color:#e74c3c;">Error loading staff: ${err.message}</div>`;
    }
  }

  async function toggleStaff(id, newActive, name) {
    if (newActive === 0) {
      const ok = await window.App.confirm(
        `Are you sure you want to deactivate ${name}? They will immediately lose access to SpinePay Pro.`,
        'Deactivate',
        'btn-danger'
      );
      if (!ok) return;
    }
    try {
      await window.api.staff.toggleActive(id, newActive === 1);
      toast(`${name} has been ${newActive ? 'reactivated' : 'deactivated'}`, newActive ? 'success' : 'warning');
      loadStaffAccounts();
    } catch (err) {
      toast('Failed to update staff status', 'error');
    }
  }

  return { render, _toggleStaff: toggleStaff };
})();
