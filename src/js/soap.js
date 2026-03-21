'use strict';

// ── SOAP Notes Module ─────────────────────────────────────────────────────────
window.SoapNotes = (() => {
  const { toast, confirm, statusBadge, openModal, closeModal, setupModalClose,
          formatDate, formatTime, formatCurrency, getCurrentUser, todayString } = window.App;

  let allNotes      = [];
  let allPatients   = [];
  let editingNoteId = null;
  let viewMode      = 'list';
  let currentNote   = null;
  let isRecording    = false;
  let recordingField = null;   // active SOAP field id
  let globalDictMode = false;
  let analyserCtx    = null;
  let analyserNode   = null;
  let levelStream    = null;
  let levelTimer     = null;
  let currentHcfaData = null;
  let currentHcfaId   = null;

  const PRACTICE = {
    name:    'Walden Bailey Chiropractic',
    address: '1086 Walden Ave Suite 1',
    city:    'Buffalo',
    state:   'NY',
    zip:     '14211',
    phone:   '(716) 555-0100',
    npi:     '',
    ein:     ''
  };

  // ── Helper: SOAP field with mic button ───────────────────────────────────────
  function soapFieldWithMic(label, letter, id, placeholder) {
    const subtitles = {
      Subjective: "Patient's Description of Symptoms",
      Objective:  'Measurable Findings',
      Assessment: 'Diagnosis / Clinical Impression',
      Plan:       'Treatment Plan'
    };
    return `
      <div class="form-group">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <label class="form-label" style="color:var(--gold);font-weight:700;margin:0;">
            <i class="fa-solid fa-${letter.toLowerCase()}"></i> ${label} — ${subtitles[label]}
          </label>
          <button type="button" class="btn btn-icon btn-sm mic-btn" data-field="${id}"
            title="Dictate ${label}"
            style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);color:var(--gold);width:28px;height:28px;border-radius:50%;flex-shrink:0;padding:0;">
            <i class="fa-solid fa-microphone" style="font-size:12px;"></i>
          </button>
        </div>
        <textarea class="form-control" id="${id}" rows="4" placeholder="${placeholder}"></textarea>
        <div id="dictPreview-${id}" style="display:none;font-style:italic;font-size:11px;color:rgba(212,175,55,0.6);margin-top:4px;min-height:16px;padding:0 2px;"></div>
      </div>`;
  }

  // ── Build HTML ───────────────────────────────────────────────────────────────
  function buildHTML() {
    return `
      <div class="card card-gold" id="soapListCard">
        <div class="filter-bar">
          <div class="filter-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" class="form-control" id="soapSearch" placeholder="Search by patient name..." />
          </div>
          <div style="flex:1;"></div>
          <button class="btn btn-primary btn-sm" id="newSoapBtn" style="display:none;">
            <i class="fa-solid fa-plus"></i> New SOAP Note
          </button>
        </div>
        <div class="table-wrapper">
          <table id="soapTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Appointment Type</th>
                <th>Diagnosis Codes</th>
                <th>Created By</th>
                <th style="width:150px;">Actions</th>
              </tr>
            </thead>
            <tbody id="soapTableBody">
              <tr><td colspan="6"><div class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading...</p></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Detail View -->
      <div id="soapDetailCard" style="display:none;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" id="soapBackBtn">
            <i class="fa-solid fa-arrow-left"></i> Back to List
          </button>
          <div style="flex:1;"></div>
          <button class="btn btn-outline btn-sm" id="soapPrintBtn">
            <i class="fa-solid fa-print"></i> Print SOAP
          </button>
          <button class="btn btn-sm" id="soapHcfaBtn"
            style="background:var(--gold);color:#000;font-weight:700;border:none;">
            <i class="fa-solid fa-file-medical"></i> Generate HCFA
          </button>
          <button class="btn btn-primary btn-sm" id="soapEditBtn" style="display:none;">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button class="btn btn-danger btn-sm" id="soapDeleteBtn" style="display:none;">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
        <div class="card card-gold" id="soapDetailContent"></div>
        <div id="hcfaHistorySection" style="margin-top:18px;"></div>
      </div>

      <!-- New / Edit SOAP Note Modal -->
      <div class="modal-overlay" id="soapModal">
        <div class="modal modal-lg">
          <div class="modal-header" style="gap:8px;flex-wrap:wrap;">
            <div class="modal-title"><i class="fa-solid fa-notes-medical"></i> <span id="soapModalTitle">New SOAP Note</span></div>
            <!-- Mic device selector -->
            <select id="soapMicSelect"
              style="margin-left:auto;background:#1a1a1a;color:var(--gold);border:1px solid rgba(212,175,55,0.4);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;max-width:160px;"
              title="Select microphone input device">
              <option value="">Default Mic</option>
            </select>
            <!-- Mic test button -->
            <button type="button" id="micTestBtn"
              style="background:rgba(212,175,55,0.1);color:var(--gold);border:1px solid rgba(212,175,55,0.3);border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;white-space:nowrap;"
              title="Record 3 seconds and play back to verify your mic is working">
              <i class="fa-solid fa-headphones"></i> Test Mic
            </button>
            <button type="button" id="dictateAllBtn"
              style="background:rgba(212,175,55,0.15);color:var(--gold);border:1px solid rgba(212,175,55,0.4);border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;"
              title="Dictate all four SOAP fields — say Subjective, Objective, Assessment, or Plan to switch sections">
              <i class="fa-solid fa-microphone"></i> Dictate All Fields
            </button>
            <div id="dictateStatus" style="display:none;align-items:center;gap:6px;padding:4px 12px;background:rgba(220,38,38,0.15);border:1px solid #dc2626;border-radius:20px;font-size:11px;color:#ef4444;font-weight:700;white-space:nowrap;">
              <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse 1s infinite;display:inline-block;flex-shrink:0;"></span>
              <span id="dictateStatusText">LISTENING</span>
              <div id="soapLevelTrack" style="width:50px;height:5px;background:rgba(255,255,255,0.12);border-radius:3px;overflow:hidden;flex-shrink:0;">
                <div id="soapLevelBar" style="height:100%;width:0%;border-radius:3px;transition:width 60ms linear;background:#ef4444;"></div>
              </div>
            </div>
            <button class="modal-close" id="soapModalClose">&times;</button>
          </div>
          <div class="modal-body">
            <form id="soapForm">
              <div class="form-grid form-grid-2">
                <div class="form-group">
                  <label class="form-label">Patient <span class="required">*</span></label>
                  <select class="form-control" id="soapPatient" required>
                    <option value="">Select patient...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Appointment</label>
                  <select class="form-control" id="soapAppointment">
                    <option value="">Select appointment (optional)...</option>
                  </select>
                </div>
              </div>

              <div style="margin:8px 0 14px;padding:10px 14px;background:rgba(212,175,55,0.08);border-left:3px solid var(--gold);border-radius:0 var(--radius-sm) var(--radius-sm) 0;font-size:12px;color:var(--text-secondary);">
                <i class="fa-solid fa-circle-info" style="color:var(--gold);margin-right:6px;"></i>
                Click <i class="fa-solid fa-microphone" style="color:var(--gold);"></i> next to any field to dictate that section, or use <strong>Dictate All Fields</strong> and say <em>"Subjective"</em>, <em>"Objective"</em>, <em>"Assessment"</em>, or <em>"Plan"</em> to switch sections.
              </div>

              ${soapFieldWithMic('Subjective', 'S', 'soapSubjective', 'Chief complaint, onset, duration, quality, aggravating/relieving factors, associated symptoms...')}
              ${soapFieldWithMic('Objective',  'O', 'soapObjective',  'Vital signs, ROM, orthopedic tests, palpation findings, neurological exam results...')}
              ${soapFieldWithMic('Assessment', 'A', 'soapAssessment', 'Clinical diagnosis, severity, response to treatment, progress notes...')}
              ${soapFieldWithMic('Plan',       'P', 'soapPlan',       'Adjustments performed, therapies, home exercises, referrals, next visit, patient education...')}

              <div class="form-grid form-grid-2">
                <div class="form-group">
                  <label class="form-label">Diagnosis Codes (ICD-10)</label>
                  <input type="text" class="form-control" id="soapDiagnosisCodes" placeholder="e.g. M54.5, M99.01, M47.812" />
                  <small style="color:var(--text-muted);font-size:11px;">Comma-separated ICD-10 codes</small>
                </div>
                <div class="form-group">
                  <label class="form-label">Procedure Codes (CPT)</label>
                  <input type="text" class="form-control" id="soapProcedureCodes" placeholder="e.g. 98941, 97012, 97110" />
                  <small style="color:var(--text-muted);font-size:11px;">Comma-separated CPT codes</small>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="soapModalCancel">Cancel</button>
            <button class="btn btn-primary" id="soapModalSave">
              <i class="fa-solid fa-floppy-disk"></i> Save SOAP Note
            </button>
          </div>
        </div>
      </div>

      <!-- HCFA Modal -->
      <div class="modal-overlay" id="hcfaModal">
        <div class="modal" style="max-width:980px;width:97vw;">
          <div class="modal-header" style="flex-wrap:wrap;gap:8px;">
            <div class="modal-title" style="flex-shrink:0;"><i class="fa-solid fa-file-medical"></i> CMS-1500 / HCFA Form</div>
            <div style="display:flex;align-items:center;gap:6px;margin-left:auto;flex-wrap:wrap;">
              <button class="btn btn-sm btn-outline" id="hcfaPrintBtn">
                <i class="fa-solid fa-print"></i> Print HCFA
              </button>
              <button class="btn btn-sm btn-outline" id="hcfaSavePdfBtn">
                <i class="fa-solid fa-file-pdf"></i> Save PDF
              </button>
              <button class="btn btn-sm btn-outline" id="hcfaFaxCoverBtn">
                <i class="fa-solid fa-fax"></i> Fax Cover Sheet
              </button>
              <button class="btn btn-sm" id="hcfaSendInsBtn"
                style="background:var(--gold);color:#000;font-weight:700;border:none;">
                <i class="fa-solid fa-paper-plane"></i> Send to Insurance
              </button>
            </div>
            <button class="modal-close" id="hcfaModalClose">&times;</button>
          </div>
          <div class="modal-body" style="padding:0;max-height:72vh;overflow-y:auto;background:#d0d0d0;">
            <div id="hcfaFormContainer" style="padding:16px;"></div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  async function render() {
    const view = document.getElementById('view-soap');
    if (!view.querySelector('#soapListCard')) {
      view.innerHTML = buildHTML();
      bindEvents();
    }

    const user = getCurrentUser();
    if (user && user.role === 'admin') {
      const btn = document.getElementById('newSoapBtn');
      if (btn) btn.style.display = 'inline-flex';
    }

    showListView();
    allPatients = await window.api.patients.getAll();
    populatePatientSelect();
    await loadNotes();
  }

  async function loadNotes() {
    try {
      let notes = [];
      try {
        notes = await window.api.soap.getAll();
      } catch (_) {
        const results = await Promise.all(
          allPatients.map(p => window.api.soap.getByPatient(p.id).catch(() => []))
        );
        notes = results.flat();
      }
      allNotes = notes;
      renderTable();
    } catch (err) {
      console.error(err);
      toast('Failed to load SOAP notes', 'error');
    }
  }

  function populatePatientSelect() {
    const sorted = [...allPatients].sort((a, b) => a.last_name.localeCompare(b.last_name));
    const opts = '<option value="">Select patient...</option>' +
      sorted.map(p => `<option value="${p.id}">${p.last_name}, ${p.first_name}</option>`).join('');
    const sel = document.getElementById('soapPatient');
    if (sel) sel.innerHTML = opts;
  }

  // ── Table Render ─────────────────────────────────────────────────────────────
  function renderTable() {
    const search = (document.getElementById('soapSearch')?.value || '').toLowerCase();
    let filtered = allNotes.filter(n => {
      const name = `${n.first_name || ''} ${n.last_name || ''}`.toLowerCase();
      return !search || name.includes(search);
    });
    filtered = filtered.sort((a, b) =>
      new Date(b.note_date || b.created_at || 0) - new Date(a.note_date || a.created_at || 0)
    );

    const tbody = document.getElementById('soapTableBody');
    if (!tbody) return;

    const user    = getCurrentUser();
    const isAdmin = user && user.role === 'admin';

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><i class="fa-regular fa-file-lines"></i><p>No SOAP notes found</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(n => {
      const diagCodes = n.diagnosis_codes || n.icd_codes || '—';
      const apptType  = n.appointment_type || n.appt_type || '—';
      const createdBy = n.created_by_name || n.created_by || '—';
      return `<tr class="clickable" onclick="window.SoapNotes.openDetail(${n.id})">
        <td class="td-primary">${formatDate(n.note_date || n.created_at)}</td>
        <td>${n.first_name || ''} ${n.last_name || ''}</td>
        <td style="text-transform:capitalize;">${apptType}</td>
        <td style="font-size:12px;font-family:monospace;">${diagCodes}</td>
        <td style="font-size:12px;">${createdBy}</td>
        <td onclick="event.stopPropagation()">
          <div class="action-row" style="gap:4px;">
            <button class="btn btn-icon btn-sm btn-outline" title="View" onclick="window.SoapNotes.openDetail(${n.id})">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="btn btn-icon btn-sm" title="Generate HCFA"
              onclick="window.SoapNotes.generateHCFA(${n.id})"
              style="background:rgba(212,175,55,0.15);color:var(--gold);border:1px solid rgba(212,175,55,0.3);">
              <i class="fa-solid fa-file-medical"></i>
            </button>
            ${isAdmin ? `
            <button class="btn btn-icon btn-sm btn-outline" title="Edit" onclick="window.SoapNotes.openEdit(${n.id})">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-icon btn-sm btn-danger" title="Delete" onclick="window.SoapNotes.deleteNote(${n.id})">
              <i class="fa-solid fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Detail View ──────────────────────────────────────────────────────────────
  function openDetail(id) {
    const note = allNotes.find(n => n.id === id);
    if (!note) return;
    currentNote = note;

    const user    = getCurrentUser();
    const isAdmin = user && user.role === 'admin';
    const editBtn   = document.getElementById('soapEditBtn');
    const deleteBtn = document.getElementById('soapDeleteBtn');
    if (editBtn)   editBtn.style.display   = isAdmin ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = isAdmin ? 'inline-flex' : 'none';

    const content = document.getElementById('soapDetailContent');
    if (content) content.innerHTML = buildDetailHTML(note);

    loadHCFAHistory(note.patient_id);
    showDetailView();
  }

  function buildDetailHTML(note) {
    const diagCodes = (note.diagnosis_codes || note.icd_codes || '').split(',').map(c => c.trim()).filter(Boolean);
    const procCodes = (note.procedure_codes || note.cpt_codes || '').split(',').map(c => c.trim()).filter(Boolean);
    const apptType  = note.appointment_type || note.appt_type || '—';
    const createdBy = note.created_by_name || note.created_by || '—';
    const codeTag   = c => `<span style="display:inline-block;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.3);color:var(--gold);padding:2px 8px;border-radius:4px;font-family:monospace;font-size:12px;margin:2px 4px 2px 0;">${c}</span>`;

    return `
      <div style="padding:24px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-size:20px;font-weight:800;color:var(--text-primary);">${note.first_name || ''} ${note.last_name || ''}</div>
            <div style="color:var(--text-muted);font-size:13px;margin-top:4px;">
              <i class="fa-solid fa-calendar-days" style="color:var(--gold);margin-right:6px;"></i>${formatDate(note.note_date || note.created_at)}
              &nbsp;&bull;&nbsp;
              <i class="fa-solid fa-stethoscope" style="color:var(--gold);margin-right:6px;"></i>${apptType}
              &nbsp;&bull;&nbsp;
              <i class="fa-solid fa-user-doctor" style="color:var(--gold);margin-right:6px;"></i>${createdBy}
            </div>
          </div>
          <div style="text-align:right;">
            ${diagCodes.length ? `<div style="margin-bottom:6px;">${diagCodes.map(codeTag).join('')}</div>` : ''}
            ${procCodes.length ? `<div>${procCodes.map(codeTag).join('')}</div>` : ''}
          </div>
        </div>
        <div style="display:grid;gap:20px;">
          ${soapSection('S', 'Subjective', 'fa-comment-medical', note.subjective)}
          ${soapSection('O', 'Objective',  'fa-microscope',      note.objective)}
          ${soapSection('A', 'Assessment', 'fa-clipboard-check', note.assessment)}
          ${soapSection('P', 'Plan',       'fa-list-check',      note.plan)}
        </div>
      </div>`;
  }

  function soapSection(letter, label, icon, content) {
    return `
      <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:rgba(212,175,55,0.07);border-bottom:1px solid var(--border);">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#000;flex-shrink:0;">${letter}</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--text-primary);">${label}</div>
            <div style="font-size:11px;color:var(--text-muted);"><i class="fa-solid ${icon}" style="margin-right:4px;"></i>${getSoapSectionSubtitle(letter)}</div>
          </div>
        </div>
        <div style="padding:16px;color:var(--text-secondary);font-size:14px;line-height:1.7;white-space:pre-wrap;min-height:60px;">
          ${content ? escapeHtml(content) : '<span style="color:var(--text-muted);font-style:italic;">No content recorded.</span>'}
        </div>
      </div>`;
  }

  function getSoapSectionSubtitle(letter) {
    return { S: "Patient's description of symptoms", O: 'Measurable clinical findings', A: 'Diagnosis / clinical impression', P: 'Treatment plan & next steps' }[letter] || '';
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── HCFA History ─────────────────────────────────────────────────────────────
  async function loadHCFAHistory(patientId) {
    const section = document.getElementById('hcfaHistorySection');
    if (!section) return;
    try {
      const forms = await window.api.hcfa.getByPatient(patientId);
      if (!forms || forms.length === 0) { section.innerHTML = ''; return; }

      const statusColor = { Draft: '#9ca3af', Printed: '#3b82f6', Faxed: '#f59e0b', Submitted: '#10b981' };
      section.innerHTML = `
        <div class="card card-gold" style="padding:18px;">
          <div style="font-weight:700;font-size:14px;color:var(--gold);margin-bottom:14px;">
            <i class="fa-solid fa-clock-rotate-left" style="margin-right:8px;"></i>HCFA Form History
          </div>
          <div style="display:grid;gap:8px;">
            ${forms.map(f => {
              const col = statusColor[f.status] || '#9ca3af';
              const sent = f.fax_sent_at
                ? `Faxed ${formatDate(f.fax_sent_at)} by ${f.fax_sent_by || '—'}`
                : f.printed_at ? `Printed ${formatDate(f.printed_at)}` : 'Draft — not yet sent';
              return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border);">
                <i class="fa-solid fa-file-medical" style="color:var(--gold);"></i>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:600;color:var(--text-primary);">HCFA Form &mdash; ${formatDate(f.created_at)}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${sent}</div>
                </div>
                <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${col}22;color:${col};border:1px solid ${col}44;white-space:nowrap;">${f.status}</span>
                <button class="btn btn-icon btn-sm btn-outline" title="Reopen/View" onclick="window.SoapNotes.reopenHCFA(${f.id})">
                  <i class="fa-solid fa-eye"></i>
                </button>
                <button class="btn btn-icon btn-sm btn-danger" title="Delete record" onclick="window.SoapNotes.deleteHCFA(${f.id}, ${patientId})">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    } catch (_) {
      section.innerHTML = '';
    }
  }

  // ── Generate HCFA ─────────────────────────────────────────────────────────────
  async function generateHCFA(noteId) {
    const note = allNotes.find(n => n.id === noteId);
    if (!note) return;
    currentNote   = note;
    currentHcfaId = null;

    try {
      const patient = allPatients.find(p => p.id === note.patient_id)
        || (await window.api.patients.getById(note.patient_id));

      let insurance = null;
      try {
        const ins = await window.api.insurance.getByPatient(note.patient_id);
        insurance = (ins || []).find(i => i.type === 'primary') || ins?.[0] || null;
      } catch (_) {}

      currentHcfaData = buildHCFAData(note, patient, insurance);
      renderHCFAForm(currentHcfaData);
      openModal('hcfaModal');

      const user = getCurrentUser();
      const res  = await window.api.hcfa.create({
        soap_note_id: note.id,
        patient_id:   note.patient_id,
        form_data:    JSON.stringify(currentHcfaData),
        status:       'Draft',
        created_by:   user ? user.username : null
      });
      currentHcfaId = res.id;
      loadHCFAHistory(note.patient_id);
    } catch (err) {
      console.error(err);
      toast('Failed to generate HCFA form', 'error');
    }
  }

  async function reopenHCFA(hcfaId) {
    if (!currentNote) return;
    try {
      const forms = await window.api.hcfa.getByPatient(currentNote.patient_id);
      const form  = forms.find(f => f.id === hcfaId);
      if (!form) return;
      currentHcfaId   = hcfaId;
      currentHcfaData = form.form_data ? JSON.parse(form.form_data) : {};
      renderHCFAForm(currentHcfaData);
      openModal('hcfaModal');
    } catch (err) {
      toast('Failed to open HCFA form', 'error');
    }
  }

  async function deleteHCFA(id, patientId) {
    const ok = await confirm('Delete this HCFA form record? This cannot be undone.', 'Delete', 'btn-danger');
    if (!ok) return;
    await window.api.hcfa.delete(id);
    toast('HCFA record deleted', 'success');
    loadHCFAHistory(patientId);
  }

  // ── Build HCFA data object from SOAP + patient + insurance ───────────────────
  function buildHCFAData(note, patient, insurance) {
    const insProvider = (insurance?.provider || '').toLowerCase();
    let insType = 'other';
    if (insProvider.includes('medicare'))                            insType = 'medicare';
    else if (insProvider.includes('medicaid'))                       insType = 'medicaid';
    else if (insProvider.includes('tricare') || insProvider.includes('champus')) insType = 'tricare';
    else if (insProvider.includes('champva'))                        insType = 'champva';
    else if (insProvider.includes('feca') || insProvider.includes('black lung')) insType = 'feca';
    else if (insurance)                                              insType = 'group';

    const diagCodes = (note.diagnosis_codes || '').split(',').map(c => c.trim()).filter(Boolean);
    const procCodes = (note.procedure_codes || '').split(',').map(c => c.trim()).filter(Boolean);

    const serviceLines = procCodes.map(cpt => ({
      date_from:     note.note_date || '',
      date_to:       note.note_date || '',
      pos:           '11',
      emg:           '',
      cpt:           cpt,
      modifier:      '',
      diag_ptr:      diagCodes.map((_, j) => String.fromCharCode(65 + j)).join(''),
      charges:       '',
      units:         '1',
      epsdt:         '',
      id_qual:       'NPI',
      rendering_npi: ''
    }));

    if (serviceLines.length === 0) {
      serviceLines.push({
        date_from: note.note_date || '', date_to: note.note_date || '',
        pos: '11', emg: '', cpt: '', modifier: '',
        diag_ptr: 'A', charges: '', units: '1',
        epsdt: '', id_qual: 'NPI', rendering_npi: ''
      });
    }

    return {
      ins_type:         insType,
      ins_provider:     insurance?.provider || '',
      box_1a:           insurance?.policy_number || insurance?.subscriber_id || '',
      box_2:            patient ? `${patient.last_name || ''}, ${patient.first_name || ''}` : '',
      box_3_dob:        patient?.dob || '',
      box_3_sex:        patient?.gender || '',
      box_4:            insurance?.subscriber_name || '',
      box_5_addr:       patient?.address || '',
      box_5_city:       patient?.city    || '',
      box_5_state:      patient?.state   || '',
      box_5_zip:        patient?.zip     || '',
      box_5_phone:      patient?.phone   || '',
      box_6_rel:        insurance?.relationship || 'self',
      box_9:            '',
      box_10a: 'NO', box_10b: 'NO', box_10c: 'NO',
      box_11_group:     insurance?.group_number  || '',
      box_11a_dob:      insurance?.subscriber_dob || '',
      box_14:           note.note_date || '',
      box_17:           '',
      box_17b:          '',
      box_21_codes:     diagCodes,
      box_24_lines:     serviceLines,
      box_25_ein:       PRACTICE.ein,
      box_26_acct:      String(patient?.id || ''),
      box_27:           'YES',
      box_28_total:     '',
      box_31_sig:       'Signature on File',
      box_31_date:      note.note_date || '',
      box_32_name:      PRACTICE.name,
      box_32_addr:      PRACTICE.address,
      box_32_city_st_zip: `${PRACTICE.city}, ${PRACTICE.state} ${PRACTICE.zip}`,
      box_33_name:      PRACTICE.name,
      box_33_addr:      PRACTICE.address,
      box_33_city_st_zip: `${PRACTICE.city}, ${PRACTICE.state} ${PRACTICE.zip}`,
      box_33_phone:     PRACTICE.phone,
      box_33_npi:       PRACTICE.npi,
      patient_name:     patient ? `${patient.first_name || ''} ${patient.last_name || ''}` : ''
    };
  }

  function renderHCFAForm(data) {
    const container = document.getElementById('hcfaFormContainer');
    if (container) container.innerHTML = buildCMS1500HTML(data);
  }

  // ── CMS-1500 Form HTML ────────────────────────────────────────────────────────
  function buildCMS1500HTML(d) {
    const B  = '#c00';  // CMS-1500 red border / label color
    const BG = '#fff8f8';
    const diagLetters = ['A','B','C','D','E','F','G','H','I','J','K','L'];

    const chk = (val, match) => val === match
      ? `<b style="font-size:13px;">&#x2714;</b>`
      : `<span style="font-size:11px;color:#bbb;">&#x25a1;</span>`;

    const cell = (label, value, wPct, extra = '') =>
      `<td style="border:1px solid ${B};padding:2px 5px;vertical-align:top;${wPct ? `width:${wPct}%;` : ''}${extra}">
        <div style="font-size:6.5px;color:${B};font-weight:700;line-height:1.3;margin-bottom:1px;">${label}</div>
        <div style="font-size:11px;min-height:14px;">${value || ''}</div>
      </td>`;

    const insTypes = [
      ['MEDICARE','medicare'],['MEDICAID','medicaid'],['TRICARE','tricare'],
      ['CHAMPVA','champva'],['GROUP HEALTH PLAN','group'],['FECA BLK LUNG','feca'],['OTHER','other']
    ].map(([lbl, key]) =>
      `<span style="font-size:9px;margin-right:10px;">${chk(d.ins_type,key)} ${lbl}</span>`
    ).join('');

    // Diagnosis codes grid A–L
    const diagCells = diagLetters.map((l, i) =>
      `<td style="border:1px solid ${B};padding:2px 4px;width:8.33%;">
        <div style="font-size:6.5px;color:${B};font-weight:700;">${l}.</div>
        <div style="font-size:11px;">${(d.box_21_codes || [])[i] || ''}</div>
      </td>`
    );
    const diagGrid = `<tr>${diagCells.slice(0,6).join('')}</tr><tr>${diagCells.slice(6).join('')}</tr>`;

    // Service lines
    const lines = [...(d.box_24_lines || [])];
    while (lines.length < 6) lines.push({});
    const serviceRows = lines.map(l => `
      <tr style="height:22px;">
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.date_from || ''}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.date_to   || ''}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.pos       || '11'}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.emg       || ''}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;font-weight:600;">${l.cpt || ''}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.modifier  || ''}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.diag_ptr  || ''}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:right;">${l.charges    || ''}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.units     || '1'}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.epsdt     || ''}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.id_qual   || 'NPI'}</td>
        <td style="border:1px solid ${B};padding:1px 3px;font-size:10px;text-align:center;">${l.rendering_npi || ''}</td>
      </tr>`).join('');

    const sexM = (d.box_3_sex||'').toLowerCase() === 'male'   ? `<b>&#x2714;</b>` : `&#x25a1;`;
    const sexF = (d.box_3_sex||'').toLowerCase() === 'female' ? `<b>&#x2714;</b>` : `&#x25a1;`;

    const relOptions = ['Self','Spouse','Child','Other'].map(r =>
      `<span style="font-size:9px;margin-right:6px;">${(d.box_6_rel||'').toLowerCase()===r.toLowerCase()?'<b>&#x2714;</b>':'&#x25a1;'} ${r}</span>`
    ).join('');

    const s = `border:1px solid ${B};`;
    const th = (t) => `<th style="${s}padding:2px 3px;font-size:6.5px;color:${B};background:${BG};text-align:center;white-space:nowrap;">${t}</th>`;

    return `
<div id="cms1500Form" style="background:#fff;padding:10px;margin:0 auto;width:760px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#000;box-shadow:0 2px 12px rgba(0,0,0,0.2);">

  <!-- TITLE ROW -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      <td colspan="2" style="${s}padding:4px 8px;background:${BG};text-align:center;font-weight:900;font-size:14px;color:${B};letter-spacing:1px;border-bottom:2px solid ${B};">
        HEALTH INSURANCE CLAIM FORM
      </td>
    </tr>
    <tr>
      <td style="${s}padding:3px 6px;font-size:7.5px;color:#555;">APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12</td>
      <td style="${s}padding:3px 6px;font-size:7.5px;color:#555;text-align:right;">PICA &nbsp; &#x25a1;</td>
    </tr>
  </table>

  <!-- BOX 1 + 1a -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      <td style="${s}padding:3px 6px;width:70%;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:3px;">1. MEDICARE&nbsp; MEDICAID&nbsp; TRICARE&nbsp; CHAMPVA&nbsp; GROUP HEALTH PLAN&nbsp; FECA BLK LUNG&nbsp; OTHER &nbsp;(ID NUMBER)</div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;">${insTypes}</div>
      </td>
      <td style="${s}padding:3px 6px;width:30%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:2px;">1a. INSURED'S I.D. NUMBER</div>
        <div style="font-size:12px;font-weight:600;">${d.box_1a || ''}</div>
      </td>
    </tr>
  </table>

  <!-- BOX 2, 3, 4 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      ${cell("2. PATIENT'S NAME (Last Name, First Name, Middle Initial)", d.box_2, 38)}
      <td style="${s}padding:2px 4px;width:22%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:1px;">3. PATIENT'S BIRTH DATE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SEX</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-size:11px;">${formatDate(d.box_3_dob) || '&nbsp;'}</div>
          <div style="font-size:10px;white-space:nowrap;">${sexM} M &nbsp; ${sexF} F</div>
        </div>
      </td>
      ${cell("4. INSURED'S NAME (Last Name, First Name, Middle Initial)", d.box_4, 40)}
    </tr>
  </table>

  <!-- BOX 5, 6, 7 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      ${cell("5. PATIENT'S ADDRESS (No., Street)", d.box_5_addr, 38)}
      <td style="${s}padding:2px 4px;width:22%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:2px;">6. PATIENT RELATIONSHIP TO INSURED</div>
        <div>${relOptions}</div>
      </td>
      ${cell("7. INSURED'S ADDRESS (No., Street)", '', 40)}
    </tr>
    <tr>
      ${cell('CITY', d.box_5_city, 22)} ${cell('STATE', d.box_5_state, 6)}
      <td style="${s}width:10%;"></td>
      ${cell('CITY', '', 24)} ${cell('STATE', '', 6)} ${cell('', '', 32)}
    </tr>
    <tr>
      ${cell('ZIP CODE', d.box_5_zip, 14)} ${cell('TELEPHONE (Include Area Code)', d.box_5_phone, 24)}
      <td style="${s}padding:2px 4px;width:10%;font-size:6.5px;color:${B};font-weight:700;vertical-align:middle;">8. RESERVED FOR NUCC USE</td>
      ${cell('ZIP CODE', '', 14)} ${cell('TELEPHONE (Include Area Code)', '', 38)}
    </tr>
  </table>

  <!-- BOX 9, 10, 11 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      ${cell("9. OTHER INSURED'S NAME", d.box_9, 34)}
      <td style="${s}padding:2px 5px;width:32%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:3px;">10. IS PATIENT'S CONDITION RELATED TO:</div>
        <div style="font-size:9px;">a. EMPLOYMENT? &nbsp; &#x25a1; YES &nbsp; &#x25a1; NO</div>
        <div style="font-size:9px;">b. AUTO ACCIDENT? &nbsp; &#x25a1; YES &nbsp; &#x25a1; NO &nbsp; <span style="font-size:8px;">(State)</span></div>
        <div style="font-size:9px;">c. OTHER ACCIDENT? &nbsp; &#x25a1; YES &nbsp; &#x25a1; NO</div>
      </td>
      ${cell("11. INSURED'S POLICY GROUP OR FECA NUMBER", d.box_11_group, 34)}
    </tr>
    <tr>
      ${cell('a. OTHER INSURED\'S POLICY OR GROUP NUMBER', '', 34)}
      ${cell('10d. CLAIM CODES (Designated by NUCC)', '', 32)}
      ${cell("a. INSURED'S DATE OF BIRTH / SEX", d.box_11a_dob, 34)}
    </tr>
  </table>

  <!-- BOX 12, 13 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      <td style="${s}padding:3px 5px;width:66%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:2px;">12. PATIENT'S OR AUTHORIZED PERSON'S SIGNATURE &nbsp; I authorize the release of any medical or other information necessary to process this claim.</div>
        <div style="font-size:11px;">Signature on File &nbsp;&nbsp;&nbsp;&nbsp; DATE: ${formatDate(d.box_31_date) || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</div>
      </td>
      <td style="${s}padding:3px 5px;width:34%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:2px;">13. INSURED'S OR AUTHORIZED PERSON'S SIGNATURE</div>
        <div style="font-size:11px;">Signature on File</div>
      </td>
    </tr>
  </table>

  <!-- SEPARATOR -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      <td colspan="2" style="${s}background:${BG};padding:3px 8px;font-size:8px;font-weight:900;color:${B};text-align:center;border-top:2px solid ${B};border-bottom:2px solid ${B};">
        PHYSICIAN OR SUPPLIER INFORMATION
      </td>
    </tr>
  </table>

  <!-- BOX 14, 15, 16 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      ${cell('14. DATE OF CURRENT ILLNESS, INJURY, OR PREGNANCY (LMP)', formatDate(d.box_14) || '', 34)}
      ${cell('15. OTHER DATE', '', 33)}
      ${cell('16. DATES PATIENT UNABLE TO WORK IN CURRENT OCCUPATION', '', 33)}
    </tr>
  </table>

  <!-- BOX 17, 17a, 17b, 18 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      ${cell('17. NAME OF REFERRING PROVIDER OR OTHER SOURCE', d.box_17, 45)}
      ${cell('17a.', '', 11)}
      ${cell('17b. NPI', d.box_17b, 11)}
      ${cell('18. HOSPITALIZATION DATES RELATED TO CURRENT SERVICES', '', 33)}
    </tr>
  </table>

  <!-- BOX 19, 20 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      ${cell('19. ADDITIONAL CLAIM INFORMATION (Designated by NUCC)', '', 67)}
      <td style="${s}padding:2px 5px;width:33%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:2px;">20. OUTSIDE LAB?</div>
        <div style="font-size:9px;">&#x25a1; YES &nbsp; &#x25a1; NO &nbsp;&nbsp; $ CHARGES: ___________</div>
      </td>
    </tr>
  </table>

  <!-- BOX 21 DIAGNOSIS + 22, 23 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      <td style="${s}padding:3px 5px;width:65%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:3px;">21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY (Relate A-L to service line below) &nbsp; ICD Ind. 0</div>
        <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">${diagGrid}</table>
      </td>
      ${cell('22. RESUBMISSION CODE', '', 10)}
      ${cell('23. PRIOR AUTHORIZATION NUMBER', '', 25)}
    </tr>
  </table>

  <!-- BOX 24 SERVICE LINES -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr style="background:${BG};">
      ${th('24A. DATE(S) OF SERVICE<br>FROM')}
      ${th('TO')}
      ${th('B.<br>POS')}
      ${th('C.<br>EMG')}
      ${th('D. PROCEDURES, SERVICES, OR SUPPLIES<br>(CPT/HCPCS)')}
      ${th('MOD')}
      ${th('E. DIAGNOSIS<br>POINTER')}
      ${th('F. $<br>CHARGES')}
      ${th('G. DAYS<br>OR UNITS')}
      ${th('H.<br>EPSDT')}
      ${th('I. ID<br>QUAL')}
      ${th('J. RENDERING<br>PROVIDER ID #')}
    </tr>
    ${serviceRows}
  </table>

  <!-- BOX 25-30 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      ${cell('25. FEDERAL TAX I.D. NUMBER &nbsp; &#x25a1; SSN &nbsp; &#x25a1; EIN', d.box_25_ein, 22)}
      ${cell("26. PATIENT'S ACCOUNT NO.", d.box_26_acct, 18)}
      <td style="${s}padding:2px 4px;width:14%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:2px;">27. ACCEPT ASSIGNMENT?</div>
        <div style="font-size:9px;">${chk(d.box_27,'YES')} YES &nbsp; ${chk(d.box_27,'NO')} NO</div>
      </td>
      ${cell('28. TOTAL CHARGE', d.box_28_total ? '$' + d.box_28_total : '', 15)}
      ${cell('29. AMOUNT PAID', '', 15)}
      ${cell('30. RSVD FOR NUCC USE', '', 16)}
    </tr>
  </table>

  <!-- BOX 31, 32, 33 -->
  <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
    <tr>
      <td style="${s}padding:4px 6px;width:34%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:3px;">31. SIGNATURE OF PHYSICIAN OR SUPPLIER INCLUDING DEGREES OR CREDENTIALS</div>
        <div style="font-size:11px;">${d.box_31_sig || 'Signature on File'}</div>
        <div style="font-size:10px;margin-top:4px;">DATE: ${formatDate(d.box_31_date) || ''}</div>
      </td>
      <td style="${s}padding:4px 6px;width:34%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:3px;">32. SERVICE FACILITY LOCATION INFORMATION</div>
        <div style="font-size:11px;font-weight:700;">${d.box_32_name || ''}</div>
        <div style="font-size:10px;">${d.box_32_addr || ''}</div>
        <div style="font-size:10px;">${d.box_32_city_st_zip || ''}</div>
      </td>
      <td style="${s}padding:4px 6px;width:32%;vertical-align:top;">
        <div style="font-size:6.5px;color:${B};font-weight:700;margin-bottom:3px;">33. BILLING PROVIDER INFO &amp; PH #</div>
        <div style="font-size:10px;">${d.box_33_phone || ''}</div>
        <div style="font-size:11px;font-weight:700;margin-top:2px;">${d.box_33_name || ''}</div>
        <div style="font-size:10px;">${d.box_33_addr || ''}</div>
        <div style="font-size:10px;">${d.box_33_city_st_zip || ''}</div>
        ${d.box_33_npi ? `<div style="font-size:9px;margin-top:2px;">NPI: ${d.box_33_npi}</div>` : ''}
      </td>
    </tr>
  </table>

  <div style="text-align:center;font-size:7px;color:#aaa;padding:3px;border-top:1px solid #ddd;margin-top:2px;">
    NUCC Instruction Manual available at: www.nucc.org &nbsp;&bull;&nbsp; PLEASE PRINT OR TYPE &nbsp;&bull;&nbsp; APPROVED OMB-0938-1197 FORM 1500 (02-12)
  </div>
</div>`;
  }

  // ── HCFA Print / Save PDF / Fax ──────────────────────────────────────────────
  function getHCFAPrintHTML(title) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,Helvetica,sans-serif; background:#fff; }
  @page { size:8.5in 11in; margin:0.3in; }
  @media print { html,body { width:8.5in; } }
</style></head><body>
${buildCMS1500HTML(currentHcfaData)}
<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body></html>`;
  }

  async function printHCFA() {
    if (!currentHcfaData) return;
    const patName = currentHcfaData.patient_name || 'Patient';
    const win = window.open('', '_blank', 'width=860,height=1050');
    win.document.write(getHCFAPrintHTML(`CMS-1500 — ${patName}`));
    win.document.close();

    if (currentHcfaId) {
      await window.api.hcfa.update(currentHcfaId, {
        form_data:     JSON.stringify(currentHcfaData),
        status:        'Printed',
        printed_at:    new Date().toISOString(),
        fax_recipient: null, fax_sent_at: null, fax_sent_by: null
      });
      if (currentNote) loadHCFAHistory(currentNote.patient_id);
    }
  }

  async function savePDF() {
    if (!currentHcfaData) return;
    const patName = (currentHcfaData.patient_name || 'patient').replace(/\s+/g, '_');
    const dateStr  = new Date().toISOString().slice(0, 10);
    const win = window.open('', '_blank', 'width=860,height=1050');
    win.document.title = `HCFA_${patName}_${dateStr}`;
    win.document.write(getHCFAPrintHTML(`HCFA_${patName}_${dateStr}`));
    win.document.close();
    toast('Print dialog opened — select "Save as PDF" as the printer', 'info');
  }

  async function showFaxCover() {
    if (!currentHcfaData) return;
    const d       = currentHcfaData;
    const insName = d.ins_provider || 'Insurance Company';
    const today   = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    const win = window.open('', '_blank', 'width=720,height=950');
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Fax Cover Sheet</title>
<style>
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;padding:48px 56px;color:#000;background:#fff;}
  h1{font-size:24px;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:28px;letter-spacing:1px;}
  .row{display:flex;gap:16px;margin-bottom:14px;align-items:flex-end;}
  .lbl{font-weight:bold;min-width:90px;font-size:13px;}
  .line{flex:1;border-bottom:1px solid #000;padding-bottom:3px;font-size:13px;}
  .cover-body{margin-top:32px;padding-top:20px;border-top:1px solid #000;}
  p{margin-bottom:14px;line-height:1.6;font-size:13px;}
  .sig-row{margin-top:40px;display:flex;gap:40px;}
  .sig-block{flex:1;}
  .sig-line{border-bottom:1px solid #000;height:28px;margin-bottom:4px;}
  .sig-lbl{font-size:11px;color:#666;}
  .footer{margin-top:36px;font-size:11px;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:10px;}
  @media print{@page{margin:0.6in;}}
</style></head><body>
<h1>FAX COVER SHEET</h1>
<div class="row"><span class="lbl">TO:</span><span class="line">${insName}</span></div>
<div class="row"><span class="lbl">FAX NUMBER:</span><span class="line">&nbsp;</span></div>
<div class="row"><span class="lbl">FROM:</span><span class="line">${PRACTICE.name}</span></div>
<div class="row"><span class="lbl">FAX:</span><span class="line">${PRACTICE.phone}</span></div>
<div class="row"><span class="lbl">PHONE:</span><span class="line">${PRACTICE.phone}</span></div>
<div class="row"><span class="lbl">DATE:</span><span class="line">${today}</span></div>
<div class="row"><span class="lbl">RE:</span><span class="line">Patient: ${d.patient_name || ''} &mdash; CMS-1500 Claim Submission</span></div>
<div class="row"><span class="lbl">PAGES:</span><span class="line">2 (including this cover sheet)</span></div>
<div class="row"><span class="lbl">PRIORITY:</span><span class="line">&#x25a1; URGENT &nbsp;&nbsp; &#x25a1; STANDARD &nbsp;&nbsp; &#x25a1; REPLY REQUESTED</span></div>
<div class="cover-body">
  <p>Please find attached a completed CMS-1500 claim form for the above referenced patient. All required information has been provided. If you have questions or require additional documentation, please contact our billing department.</p>
  <p>CONFIDENTIALITY NOTICE: This facsimile transmission contains confidential health information which may be protected under the Health Insurance Portability and Accountability Act (HIPAA). If you have received this transmission in error, please immediately notify our office and destroy all copies.</p>
</div>
<div class="sig-row">
  <div class="sig-block"><div class="sig-line"></div><div class="sig-lbl">Authorized Signature</div></div>
  <div class="sig-block"><div class="sig-line"></div><div class="sig-lbl">Date</div></div>
</div>
<div class="footer">${PRACTICE.name} &bull; ${PRACTICE.address}, ${PRACTICE.city}, ${PRACTICE.state} ${PRACTICE.zip} &bull; ${PRACTICE.phone}</div>
<script>window.onload=function(){window.print();};<\/script>
</body></html>`);
    win.document.close();
  }

  async function sendToInsurance() {
    if (!currentHcfaData || !currentHcfaId) return;
    const insName = currentHcfaData.ins_provider || 'Insurance Company';
    const ok = await confirm(
      `Log this claim as faxed/sent to ${insName} for patient ${currentHcfaData.patient_name || ''}?\n\nThis will create an audit trail record with the current timestamp and your username.`,
      'Confirm Sent', 'btn-primary'
    );
    if (!ok) return;

    const user = getCurrentUser();
    const now  = new Date().toISOString();
    await window.api.hcfa.update(currentHcfaId, {
      form_data:     JSON.stringify(currentHcfaData),
      status:        'Faxed',
      fax_recipient: insName,
      fax_sent_at:   now,
      fax_sent_by:   user ? user.username : 'Staff',
      printed_at:    null
    });
    toast(`Fax logged — sent to ${insName} at ${new Date().toLocaleTimeString('en-US')}`, 'success');
    closeModal('hcfaModal');
    if (currentNote) loadHCFAHistory(currentNote.patient_id);
  }

  // ── Show/Hide Views ──────────────────────────────────────────────────────────
  function showListView() {
    viewMode = 'list';
    document.getElementById('soapListCard').style.display   = 'block';
    document.getElementById('soapDetailCard').style.display = 'none';
  }

  function showDetailView() {
    viewMode = 'detail';
    document.getElementById('soapListCard').style.display   = 'none';
    document.getElementById('soapDetailCard').style.display = 'block';
  }

  // ── Modal: New ───────────────────────────────────────────────────────────────
  function openNew() {
    editingNoteId = null;
    document.getElementById('soapModalTitle').textContent = 'New SOAP Note';
    document.getElementById('soapForm').reset();
    document.getElementById('soapAppointment').innerHTML = '<option value="">Select appointment (optional)...</option>';
    openModal('soapModal');
  }

  // ── Modal: Edit ──────────────────────────────────────────────────────────────
  function openEdit(id) {
    const note = allNotes.find(n => n.id === id);
    if (!note) return;
    editingNoteId = id;
    document.getElementById('soapModalTitle').textContent = 'Edit SOAP Note';
    document.getElementById('soapPatient').value          = note.patient_id || '';
    document.getElementById('soapSubjective').value       = note.subjective || '';
    document.getElementById('soapObjective').value        = note.objective  || '';
    document.getElementById('soapAssessment').value       = note.assessment || '';
    document.getElementById('soapPlan').value             = note.plan       || '';
    document.getElementById('soapDiagnosisCodes').value   = note.diagnosis_codes || note.icd_codes   || '';
    document.getElementById('soapProcedureCodes').value   = note.procedure_codes || note.cpt_codes   || '';
    onPatientChange().then(() => {
      document.getElementById('soapAppointment').value = note.appointment_id || '';
    });
    openModal('soapModal');
  }

  async function onPatientChange() {
    const patientId = document.getElementById('soapPatient')?.value;
    const sel = document.getElementById('soapAppointment');
    sel.innerHTML = '<option value="">Select appointment (optional)...</option>';
    if (!patientId) return;
    try {
      const appts = await window.api.appointments.getByPatient(parseInt(patientId));
      appts.sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));
      appts.forEach(a => {
        const label = `${formatDate(a.date)} ${a.time ? formatTime(a.time) : ''} — ${(a.type || '').replace(/-/g, ' ')}`;
        sel.innerHTML += `<option value="${a.id}">${label}</option>`;
      });
    } catch (_) {}
  }

  // ── Save SOAP Note ────────────────────────────────────────────────────────────
  async function save() {
    const patientId = document.getElementById('soapPatient').value;
    if (!patientId) { toast('Please select a patient', 'warning'); return; }

    const data = {
      patient_id:      parseInt(patientId),
      appointment_id:  document.getElementById('soapAppointment').value
                         ? parseInt(document.getElementById('soapAppointment').value) : null,
      subjective:      document.getElementById('soapSubjective').value.trim()     || null,
      objective:       document.getElementById('soapObjective').value.trim()      || null,
      assessment:      document.getElementById('soapAssessment').value.trim()     || null,
      plan:            document.getElementById('soapPlan').value.trim()           || null,
      diagnosis_codes: document.getElementById('soapDiagnosisCodes').value.trim() || null,
      procedure_codes: document.getElementById('soapProcedureCodes').value.trim() || null,
      note_date:       todayString()
    };

    const btn = document.getElementById('soapModalSave');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
      if (editingNoteId) {
        await window.api.soap.update(editingNoteId, data);
        toast('SOAP note updated', 'success');
      } else {
        await window.api.soap.create(data);
        toast('SOAP note created', 'success');
      }
      stopDictation();
      closeModal('soapModal');
      await loadNotes();
      if (editingNoteId && currentNote) openDetail(editingNoteId);
    } catch (err) {
      console.error(err);
      toast('Failed to save SOAP note', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save SOAP Note';
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function deleteNote(id) {
    const confirmed = await confirm('Delete this SOAP note? This cannot be undone.', 'Delete', 'btn-danger');
    if (!confirmed) return;
    try {
      await window.api.soap.delete(id);
      toast('SOAP note deleted', 'success');
      await loadNotes();
      if (viewMode === 'detail') showListView();
    } catch (err) {
      toast('Failed to delete SOAP note', 'error');
    }
  }

  // ── Print SOAP ────────────────────────────────────────────────────────────────
  function printSOAP(note) {
    if (!note) note = currentNote;
    if (!note) return;

    const diagCodes = (note.diagnosis_codes || note.icd_codes || '').split(',').map(c => c.trim()).filter(Boolean);
    const procCodes = (note.procedure_codes || note.cpt_codes || '').split(',').map(c => c.trim()).filter(Boolean);
    const apptType  = note.appointment_type || note.appt_type || '—';
    const createdBy = note.created_by_name  || note.created_by || '—';

    const sec = (letter, label, content) => `
      <div style="margin-bottom:22px;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;border-bottom:2px solid #c9a227;padding-bottom:6px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#c9a227;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#000;flex-shrink:0;">${letter}</div>
          <div style="font-weight:800;font-size:15px;color:#1a1a1a;">${label}</div>
        </div>
        <div style="padding:10px 14px;background:#fafafa;border-left:3px solid #c9a227;font-size:13px;line-height:1.8;color:#333;white-space:pre-wrap;min-height:40px;">
          ${content ? content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '<em style="color:#999;">Not recorded</em>'}
        </div>
      </div>`;

    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SOAP Note — ${note.first_name || ''} ${note.last_name || ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#222;background:#fff;padding:30px 40px;}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #c9a227;}
  .cn{font-size:22px;font-weight:900;color:#1a1a1a;}.cs{font-size:12px;color:#666;margin-top:3px;}
  .nt{font-size:18px;font-weight:800;color:#c9a227;text-align:right;}.nm{font-size:12px;color:#666;text-align:right;margin-top:4px;}
  .pbar{background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:12px 16px;margin-bottom:22px;display:flex;gap:40px;flex-wrap:wrap;}
  .fl{font-size:10px;text-transform:uppercase;color:#999;font-weight:700;margin-bottom:2px;}
  .fv{font-size:14px;font-weight:600;color:#222;}
  .cbar{display:flex;gap:20px;margin-bottom:22px;}
  .cs2{flex:1;padding:10px 14px;background:#fffbf0;border:1px solid #e8d78a;border-radius:5px;}
  .cl{font-size:10px;text-transform:uppercase;color:#999;font-weight:700;margin-bottom:6px;}
  .cc{display:inline-block;background:#fff3cc;border:1px solid #c9a227;color:#7a5f00;padding:2px 8px;border-radius:4px;font-family:monospace;font-size:12px;margin:2px 3px 2px 0;}
  .ftr{margin-top:30px;padding-top:14px;border-top:1px solid #e0e0e0;font-size:11px;color:#999;text-align:center;}
  @media print{body{padding:15px 20px;}@page{margin:0.5in;}}
</style></head><body>
<div class="hdr">
  <div><div class="cn">Walden Bailey Chiropractic</div><div class="cs">Buffalo, NY &bull; (716) 555-0100</div></div>
  <div><div class="nt">SOAP NOTE</div><div class="nm">${formatDate(note.note_date || note.created_at)}</div></div>
</div>
<div class="pbar">
  <div><div class="fl">Patient</div><div class="fv">${note.first_name || ''} ${note.last_name || ''}</div></div>
  <div><div class="fl">Appointment Type</div><div class="fv" style="text-transform:capitalize;">${apptType}</div></div>
  <div><div class="fl">Treating Provider</div><div class="fv">${createdBy}</div></div>
  <div><div class="fl">Note Date</div><div class="fv">${formatDate(note.note_date || note.created_at)}</div></div>
</div>
${diagCodes.length || procCodes.length ? `<div class="cbar">
  ${diagCodes.length ? `<div class="cs2"><div class="cl">ICD-10 Diagnosis Codes</div>${diagCodes.map(c=>`<span class="cc">${c}</span>`).join('')}</div>` : ''}
  ${procCodes.length ? `<div class="cs2"><div class="cl">CPT Procedure Codes</div>${procCodes.map(c=>`<span class="cc">${c}</span>`).join('')}</div>` : ''}
</div>` : ''}
${sec('S',"Subjective — Patient's Description of Symptoms", note.subjective)}
${sec('O','Objective — Measurable Findings', note.objective)}
${sec('A','Assessment — Diagnosis / Clinical Impression', note.assessment)}
${sec('P','Plan — Treatment Plan', note.plan)}
<div class="ftr">This document is confidential and protected under HIPAA regulations. &bull; Walden Bailey Chiropractic &bull; Printed ${new Date().toLocaleString('en-US')}</div>
<script>window.onload=function(){window.print();};<\/script>
</body></html>`);
    win.document.close();
  }

  // ── Voice Dictation (Whisper offline via @xenova/transformers) ────────────────
  let mediaRecorder   = null;
  let audioChunks     = [];
  let recordingStream = null;

  function getSelectedMicId() {
    return localStorage.getItem('soapMicDeviceId') || '';
  }

  async function _startCapture(fieldId, global) {
    const deviceId = getSelectedMicId();
    const constraint = deviceId ? { deviceId: { exact: deviceId } } : true;
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: constraint, video: false });

    // Level meter
    levelStream  = recordingStream;
    analyserCtx  = new AudioContext();
    analyserNode = analyserCtx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserCtx.createMediaStreamSource(recordingStream).connect(analyserNode);
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    function draw() {
      if (!isRecording) return;
      analyserNode.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const pct = Math.min(100, Math.round((avg / 128) * 100));
      const bar = document.getElementById('soapLevelBar');
      if (bar) { bar.style.width = pct + '%'; bar.style.background = pct > 60 ? '#22c55e' : pct > 20 ? '#eab308' : '#ef4444'; }
      levelTimer = requestAnimationFrame(draw);
    }
    draw();

    // MediaRecorder capture
    audioChunks   = [];
    mediaRecorder = new MediaRecorder(recordingStream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.start();
  }

  async function startDictation(fieldId) {
    if (isRecording) { stopDictation(); return; }
    recordingField = fieldId;
    globalDictMode = false;
    isRecording    = true;
    try {
      await _startCapture(fieldId, false);
      updateMicUI(fieldId, true);
      showDictateStatus('\uD83D\uDD34 RECORDING \u25cf ' + fieldId.replace('soap', '').toUpperCase() + ' \u2014 click mic to stop & transcribe');
    } catch (err) {
      isRecording = false;
      toast('Mic access failed: ' + err.message, 'error');
    }
  }

  async function startGlobalDictation() {
    if (isRecording) { stopDictation(); return; }
    recordingField = 'soapSubjective';
    globalDictMode = true;
    isRecording    = true;
    try {
      await _startCapture('soapSubjective', true);
      const dictBtn = document.getElementById('dictateAllBtn');
      if (dictBtn) {
        dictBtn.style.background  = 'rgba(220,38,38,0.15)';
        dictBtn.style.borderColor = '#dc2626';
        dictBtn.style.color       = '#ef4444';
        dictBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop & Transcribe';
      }
      updateMicUI('soapSubjective', true);
      showDictateStatus('\uD83D\uDD34 RECORDING \u2014 say "Subjective / Objective / Assessment / Plan" to label sections, click to transcribe');
    } catch (err) {
      isRecording = false;
      toast('Mic access failed: ' + err.message, 'error');
    }
  }

  function stopLevelMeter() {
    if (levelTimer)  { cancelAnimationFrame(levelTimer); levelTimer = null; }
    if (analyserCtx) { analyserCtx.close().catch(() => {}); analyserCtx = null; analyserNode = null; }
    levelStream = null; // stream tracks stopped by stopDictation
    const bar = document.getElementById('soapLevelBar');
    if (bar) bar.style.width = '0%';
  }

  // Called when mic button clicked again, modal closes, or save triggered
  function stopDictation() {
    if (!isRecording) return;
    isRecording = false;

    stopLevelMeter();

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      const capturedChunks = audioChunks.slice();
      const capturedField  = recordingField;
      const capturedGlobal = globalDictMode;

      mediaRecorder.onstop = async () => {
        if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()); recordingStream = null; }
        mediaRecorder = null;
        resetDictateUI();

        if (capturedChunks.length === 0) return;
        showDictateStatus('\u23F3 Transcribing...');

        try {
          const blob        = new Blob(capturedChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx    = new AudioContext({ sampleRate: 16000 });
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const float32     = audioBuffer.getChannelData(0);
          audioCtx.close();

          console.log('[Voice] Sending', float32.length, 'samples to Whisper');
          const result = await window.api.transcribe.audio(Array.from(float32));

          const statusEl = document.getElementById('dictateStatus');
          if (statusEl) statusEl.style.display = 'none';

          if (!result.success || !result.text || !result.text.trim()) {
            if (!result.success) toast('Transcription failed: ' + (result.error || 'unknown'), 'error');
            return;
          }

          const text  = result.text.trim();
          const lower = text.toLowerCase();

          if (capturedGlobal) {
            if      (lower.includes('subjective')) recordingField = 'soapSubjective';
            else if (lower.includes('objective'))  recordingField = 'soapObjective';
            else if (lower.includes('assessment')) recordingField = 'soapAssessment';
            else if (lower.includes('plan'))       recordingField = 'soapPlan';
            else {
              const field = document.getElementById(recordingField);
              if (field) { field.value += text + ' '; field.dispatchEvent(new Event('input', { bubbles: true })); }
            }
          } else {
            const field = document.getElementById(capturedField);
            if (field) { field.value += text + ' '; field.dispatchEvent(new Event('input', { bubbles: true })); }
          }
          console.log('[Whisper] Written:', text, '\u2192', capturedField);
        } catch (err) {
          toast('Transcription failed: ' + err.message, 'error');
          const statusEl = document.getElementById('dictateStatus');
          if (statusEl) statusEl.style.display = 'none';
        }
      };

      audioChunks = [];
      mediaRecorder.stop();
    } else {
      if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()); recordingStream = null; }
      mediaRecorder = null;
      resetDictateUI();
    }
  }

  function resetDictateUI() {
    globalDictMode = false;
    recordingField = null;

    document.querySelectorAll('.mic-btn').forEach(btn => {
      btn.style.background  = 'rgba(212,175,55,0.1)';
      btn.style.borderColor = 'rgba(212,175,55,0.3)';
      btn.style.color       = 'var(--gold)';
      btn.innerHTML = '<i class="fa-solid fa-microphone" style="font-size:12px;"></i>';
    });

    const dictBtn = document.getElementById('dictateAllBtn');
    if (dictBtn) {
      dictBtn.style.background  = 'rgba(212,175,55,0.15)';
      dictBtn.style.borderColor = 'rgba(212,175,55,0.4)';
      dictBtn.style.color       = 'var(--gold)';
      dictBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Dictate All Fields';
    }

    const statusEl = document.getElementById('dictateStatus');
    if (statusEl) statusEl.style.display = 'none';
  }

  function updateMicUI(fieldId, isActive) {
    document.querySelectorAll('.mic-btn').forEach(btn => {
      if (fieldId && btn.dataset.field !== fieldId) return;
      if (isActive) {
        btn.style.background  = 'rgba(220,38,38,0.2)';
        btn.style.borderColor = '#dc2626';
        btn.style.color       = '#ef4444';
        btn.innerHTML = '<i class="fa-solid fa-stop" style="font-size:11px;"></i>';
      } else {
        btn.style.background  = 'rgba(212,175,55,0.1)';
        btn.style.borderColor = 'rgba(212,175,55,0.3)';
        btn.style.color       = 'var(--gold)';
        btn.innerHTML = '<i class="fa-solid fa-microphone" style="font-size:12px;"></i>';
      }
    });
  }

  function showDictateStatus(text) {
    const el = document.getElementById('dictateStatus');
    if (el) el.style.display = 'flex';
    const tx = document.getElementById('dictateStatusText');
    if (tx) tx.textContent = text;
  }

  // ── Bind Events ───────────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('newSoapBtn')?.addEventListener('click', openNew);
    document.getElementById('soapSearch')?.addEventListener('input', () => {
      clearTimeout(window._soapSearchTimer);
      window._soapSearchTimer = setTimeout(renderTable, 200);
    });
    document.getElementById('soapBackBtn')?.addEventListener('click', showListView);
    document.getElementById('soapPrintBtn')?.addEventListener('click', () => printSOAP(currentNote));
    document.getElementById('soapHcfaBtn')?.addEventListener('click', () => { if (currentNote) generateHCFA(currentNote.id); });
    document.getElementById('soapEditBtn')?.addEventListener('click', () => { if (currentNote) openEdit(currentNote.id); });
    document.getElementById('soapDeleteBtn')?.addEventListener('click', () => { if (currentNote) deleteNote(currentNote.id); });
    document.getElementById('soapModalSave')?.addEventListener('click', save);
    document.getElementById('soapPatient')?.addEventListener('change', onPatientChange);

    setupModalClose('soapModal', ['soapModalClose', 'soapModalCancel']);
    setupModalClose('hcfaModal', ['hcfaModalClose']);

    // Stop dictation when SOAP modal closes
    document.getElementById('soapModalClose')?.addEventListener('click',  stopDictation);
    document.getElementById('soapModalCancel')?.addEventListener('click', stopDictation);

    // Mic buttons — delegated on the view container
    document.getElementById('view-soap')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mic-btn');
      if (!btn) return;
      e.preventDefault();
      startDictation(btn.dataset.field);
    });

    // Dictate All button
    document.getElementById('dictateAllBtn')?.addEventListener('click', () => {
      if (isRecording) stopDictation();
      else startGlobalDictation();
    });

    // HCFA buttons
    document.getElementById('hcfaPrintBtn')?.addEventListener('click',   printHCFA);
    document.getElementById('hcfaSavePdfBtn')?.addEventListener('click', savePDF);
    document.getElementById('hcfaFaxCoverBtn')?.addEventListener('click', showFaxCover);
    document.getElementById('hcfaSendInsBtn')?.addEventListener('click', sendToInsurance);

    // Populate mic device selector and restore saved choice
    populateMicSelector();

    // Save mic choice to localStorage on change
    document.getElementById('soapMicSelect')?.addEventListener('change', (e) => {
      const id = e.target.value;
      if (id) localStorage.setItem('soapMicDeviceId', id);
      else    localStorage.removeItem('soapMicDeviceId');
    });

    // Mic test — record 3 s and play back
    document.getElementById('micTestBtn')?.addEventListener('click', runMicTest);
  }

  async function populateMicSelector() {
    try {
      // Request permission first so labels are visible
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics    = devices.filter(d => d.kind === 'audioinput');

      console.log('[SpinePay] Audio input devices detected:', mics.map(m => `${m.label || 'Unlabeled'} (${m.deviceId.slice(0,8)}...)`));

      const sel = document.getElementById('soapMicSelect');
      if (!sel) return;
      sel.innerHTML = '<option value="">Default Mic</option>';
      const saved = localStorage.getItem('soapMicDeviceId') || '';
      mics.forEach((m) => {
        const opt  = document.createElement('option');
        opt.value  = m.deviceId;
        opt.text   = m.label || ('Microphone ' + (sel.options.length));
        opt.selected = (m.deviceId === saved);
        sel.appendChild(opt);
      });
    } catch (err) {
      console.warn('[SpinePay] Could not enumerate mic devices:', err.message);
    }
  }

  async function runMicTest() {
    const btn = document.getElementById('micTestBtn');
    if (!btn) return;
    btn.disabled   = true;
    btn.textContent = 'Recording 3s…';

    const deviceId = getSelectedMicId();
    const audioConstraint = deviceId ? { deviceId: { exact: deviceId } } : true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: false });
    } catch (err) {
      toast('Mic test failed: ' + err.message, 'error');
      btn.disabled   = false;
      btn.innerHTML  = '<i class="fa-solid fa-headphones"></i> Test Mic';
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks   = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();

    setTimeout(() => {
      recorder.stop();
      stream.getTracks().forEach(t => t.stop());
      btn.textContent = 'Playing back…';

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url  = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          btn.disabled  = false;
          btn.innerHTML = '<i class="fa-solid fa-headphones"></i> Test Mic';
        };
        audio.play().catch(() => {
          toast('Playback failed — but recording worked. Mic is detected.', 'info');
          btn.disabled  = false;
          btn.innerHTML = '<i class="fa-solid fa-headphones"></i> Test Mic';
        });
      };
    }, 3000);
  }

  return {
    render,
    openDetail,
    openEdit,
    deleteNote,
    printSOAP,
    generateHCFA,
    reopenHCFA,
    deleteHCFA,
    refresh: loadNotes
  };
})();
