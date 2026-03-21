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
    loadSettings();
    loadBackupStatus();
    document.getElementById('settingsSaveBtn').addEventListener('click', save);
    document.getElementById('backupRunNowBtn').addEventListener('click', runBackupNow);
    document.getElementById('backupChangeFolderBtn').addEventListener('click', changeBackupFolder);
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

  return { render };
})();
