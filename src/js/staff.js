'use strict';

// ── Staff Management Module (Admin only) ──────────────────────────────────────
window.Staff = (() => {
  const { toast, confirm, formatDate } = window.App;

  function render() {
    const view = document.getElementById('view-staff');
    view.innerHTML = `
      <div class="card card-gold" style="margin-bottom:24px;">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-users-gear"></i> Staff Management</div>
        </div>
        <div class="card-body" style="padding:0;">
          <div id="staffDashTable">
            <div style="padding:20px;color:var(--text-muted);">Loading staff…</div>
          </div>
        </div>
      </div>

      <!-- Staff Profile Modal -->
      <div id="staffProfileModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;">
        <div style="background:#1a1a1a;border:1px solid rgba(212,175,55,.25);border-radius:16px;width:640px;max-width:100%;box-shadow:0 25px 60px rgba(0,0,0,.7);">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.06);">
            <div style="font-size:15px;font-weight:700;color:var(--text-primary);">
              <i class="fa-solid fa-id-card" style="color:var(--gold);margin-right:8px;"></i>
              Staff Profile
            </div>
            <button id="staffProfileClose" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;line-height:1;">&times;</button>
          </div>
          <div id="staffProfileBody" style="padding:24px;"></div>
        </div>
      </div>
    `;

    document.getElementById('staffProfileClose').addEventListener('click', () => {
      document.getElementById('staffProfileModal').style.display = 'none';
    });
    document.getElementById('staffProfileModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
    });

    loadStaff();
  }

  async function loadStaff() {
    const container = document.getElementById('staffDashTable');
    if (!container) return;
    try {
      const staff = await window.api.staff.getAll();
      if (!staff.length) {
        container.innerHTML = '<div style="padding:24px;color:var(--text-muted);text-align:center;">No staff accounts found.</div>';
        return;
      }
      container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,215,0,.15);">
              <th style="padding:12px 20px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Staff Member</th>
              <th style="padding:12px 20px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Role</th>
              <th style="padding:12px 20px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Status</th>
              <th style="padding:12px 20px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Last Login</th>
              <th style="padding:12px 20px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">HIPAA Signed</th>
              <th style="padding:12px 20px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">HIPAA Status</th>
              <th style="padding:12px 20px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${staff.map(s => {
              const initials = s.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
              return `
              <tr class="staff-row" data-id="${s.id}" style="border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer;transition:background .15s;"
                  onmouseenter="this.style.background='rgba(212,175,55,.04)'"
                  onmouseleave="this.style.background=''"
                  onclick="window.Staff._openProfile(${s.id})">
                <td style="padding:14px 20px;">
                  <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#d4af37,#a08020);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#000;flex-shrink:0;">${initials}</div>
                    <div>
                      <div style="font-weight:600;color:var(--text-primary);font-size:14px;">${s.full_name}</div>
                      <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">${s.email || s.username}</div>
                    </div>
                  </div>
                </td>
                <td style="padding:14px 20px;">
                  <span style="padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
                    background:${s.role === 'admin' ? 'rgba(212,175,55,.15)' : 'rgba(52,152,219,.15)'};
                    color:${s.role === 'admin' ? 'var(--gold)' : '#3498db'};">
                    ${s.role}
                  </span>
                </td>
                <td style="padding:14px 20px;">
                  <span style="padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;
                    background:${s.active !== 0 ? 'rgba(46,204,113,.12)' : 'rgba(100,100,100,.15)'};
                    color:${s.active !== 0 ? '#2ecc71' : '#888'};">
                    ${s.active !== 0 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style="padding:14px 20px;color:var(--text-muted);font-size:13px;">
                  ${s.last_login ? new Date(s.last_login).toLocaleString() : '<span style="color:#555;">Never</span>'}
                </td>
                <td style="padding:14px 20px;color:var(--text-muted);font-size:13px;">
                  ${s.hipaa_signed_at ? new Date(s.hipaa_signed_at).toLocaleDateString() : '<span style="color:#555;">—</span>'}
                </td>
                <td style="padding:14px 20px;">
                  <span style="padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;
                    background:${s.hipaa_signed ? 'rgba(46,204,113,.12)' : 'rgba(245,158,11,.12)'};
                    color:${s.hipaa_signed ? '#2ecc71' : '#f59e0b'};">
                    ${s.hipaa_signed ? 'Signed' : 'Pending'}
                  </span>
                </td>
                <td style="padding:14px 20px;text-align:right;" onclick="event.stopPropagation()">
                  <button onclick="window.Staff._toggleActive(${s.id}, ${s.active !== 0 ? 0 : 1}, '${s.full_name.replace(/'/g, "\\'")}')"
                    style="padding:5px 12px;font-size:12px;font-weight:600;border-radius:5px;cursor:pointer;border:1px solid;
                      background:${s.active !== 0 ? 'rgba(231,76,60,.12)' : 'rgba(46,204,113,.12)'};
                      color:${s.active !== 0 ? '#e74c3c' : '#2ecc71'};
                      border-color:${s.active !== 0 ? 'rgba(231,76,60,.3)' : 'rgba(46,204,113,.3)'};">
                    ${s.active !== 0 ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      if (container) container.innerHTML = `<div style="padding:20px;color:#e74c3c;">Error: ${err.message}</div>`;
    }
  }

  async function toggleActive(id, newActive, name) {
    if (newActive === 0) {
      const ok = await confirm(
        `Are you sure you want to deactivate ${name}? They will immediately lose access to SpinePay Pro.`,
        'Deactivate',
        'btn-danger'
      );
      if (!ok) return;
    }
    try {
      await window.api.staff.toggleActive(id, newActive === 1);
      toast(`${name} has been ${newActive ? 'reactivated' : 'deactivated'}`, newActive ? 'success' : 'warning');
      loadStaff();
    } catch (err) {
      toast('Failed to update staff status', 'error');
    }
  }

  async function openProfile(staffId) {
    const modal = document.getElementById('staffProfileModal');
    const body  = document.getElementById('staffProfileBody');
    modal.style.display = 'flex';
    body.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">Loading…</div>';

    try {
      const [allStaff, history] = await Promise.all([
        window.api.staff.getAll(),
        window.api.staff.getLoginHistory(staffId)
      ]);
      const s = allStaff.find(u => u.id === staffId);
      if (!s) { body.innerHTML = '<div style="color:#e74c3c;">Staff member not found.</div>'; return; }

      const initials = s.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      const permsList = s.role === 'admin'
        ? 'All features including Settings, Staff Management, Reports, Billing, and all patient data'
        : 'Dashboard, Patients, Scheduling, SOAP Notes, Intake Forms, Waitlist, Referrals, Transportation';

      body.innerHTML = `
        <div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:24px;">
          <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#d4af37,#a08020);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#000;flex-shrink:0;">${initials}</div>
          <div>
            <div style="font-size:18px;font-weight:700;color:var(--text-primary);">${s.full_name}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">@${s.username} &bull; ${s.email || 'No email'}</div>
            <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
              <span style="padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
                background:${s.role === 'admin' ? 'rgba(212,175,55,.15)' : 'rgba(52,152,219,.15)'};
                color:${s.role === 'admin' ? 'var(--gold)' : '#3498db'};">${s.role}</span>
              <span style="padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;
                background:${s.active !== 0 ? 'rgba(46,204,113,.12)' : 'rgba(100,100,100,.15)'};
                color:${s.active !== 0 ? '#2ecc71' : '#888'};">${s.active !== 0 ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px;">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);margin-bottom:8px;">
              <i class="fa-solid fa-shield-halved"></i> HIPAA Acknowledgment
            </div>
            <div style="font-size:13px;color:${s.hipaa_signed ? '#2ecc71' : '#f59e0b'};font-weight:600;margin-bottom:4px;">
              ${s.hipaa_signed ? '<i class="fa-solid fa-check-circle"></i> Signed' : '<i class="fa-solid fa-clock"></i> Pending'}
            </div>
            ${s.hipaa_signed_at ? `<div style="font-size:12px;color:var(--text-muted);">Date: ${new Date(s.hipaa_signed_at).toLocaleString()}</div>` : ''}
          </div>
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px;">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);margin-bottom:8px;">
              <i class="fa-solid fa-clock"></i> Last Login
            </div>
            <div style="font-size:13px;color:var(--text-secondary);">
              ${s.last_login ? new Date(s.last_login).toLocaleString() : 'Never logged in'}
            </div>
          </div>
        </div>

        <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);margin-bottom:8px;">
            <i class="fa-solid fa-key"></i> Access Permissions
          </div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">${permsList}</div>
        </div>

        <div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--gold);margin-bottom:12px;">
            <i class="fa-solid fa-list-check"></i> Recent Login History
          </div>
          ${history.length === 0
            ? '<div style="color:var(--text-muted);font-size:13px;">No login history recorded.</div>'
            : `<div style="max-height:200px;overflow-y:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <thead><tr style="color:var(--text-muted);">
                    <th style="text-align:left;padding:4px 8px;font-weight:500;">Date &amp; Time</th>
                    <th style="text-align:left;padding:4px 8px;font-weight:500;">Result</th>
                  </tr></thead>
                  <tbody>
                    ${history.map(h => `
                      <tr style="border-top:1px solid rgba(255,255,255,.05);">
                        <td style="padding:6px 8px;color:var(--text-muted);">${new Date(h.logged_in_at).toLocaleString()}</td>
                        <td style="padding:6px 8px;">
                          <span style="color:${h.success ? '#2ecc71' : '#e74c3c'};font-weight:600;">
                            ${h.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>`;
    } catch (err) {
      body.innerHTML = `<div style="color:#e74c3c;">Error loading profile: ${err.message}</div>`;
    }
  }

  return {
    render,
    _toggleActive: toggleActive,
    _openProfile:  openProfile
  };
})();
