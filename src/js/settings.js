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
    `;
    loadSettings();
    document.getElementById('settingsSaveBtn').addEventListener('click', save);
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
