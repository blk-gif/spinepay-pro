'use strict';

// ── Documents Module ──────────────────────────────────────────────────────────
window.Documents = (() => {
  const { toast, confirm: appConfirm, openModal, closeModal, formatDate } = window.App;

  let allDocs     = [];
  let allPatients = [];
  let docTypes    = [];
  let uploadPatientId = null;  // null = all-docs mode, number = patient-specific mode

  const DOC_ICONS = {
    'application/pdf': '<i class="fa-solid fa-file-pdf" style="color:#e74c3c"></i>',
    'image/jpeg':      '<i class="fa-solid fa-file-image" style="color:#3498db"></i>',
    'image/png':       '<i class="fa-solid fa-file-image" style="color:#3498db"></i>',
    'image/gif':       '<i class="fa-solid fa-file-image" style="color:#3498db"></i>',
    'image/webp':      '<i class="fa-solid fa-file-image" style="color:#3498db"></i>',
    'application/msword': '<i class="fa-solid fa-file-word" style="color:#2980b9"></i>',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                       '<i class="fa-solid fa-file-word" style="color:#2980b9"></i>',
  };
  function docIcon(mime) { return DOC_ICONS[mime] || '<i class="fa-solid fa-file" style="color:#aaa"></i>'; }

  function fmtBytes(b) {
    if (!b) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function retentionLabel(dateStr) {
    if (!dateStr) return '—';
    const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
    const label = formatDate ? formatDate(dateStr) : dateStr;
    if (diff < 0)  return `<span style="color:#e74c3c">⚠️ Expired</span>`;
    if (diff < 30) return `<span style="color:#f39c12">⚠️ ${label}</span>`;
    return label;
  }

  // ── HTML ───────────────────────────────────────────────────────────────────

  function buildHTML() {
    return `
      <div class="card card-gold">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-folder-open"></i> Document Storage</div>
          <button class="btn btn-primary btn-sm" id="docsUploadBtn">
            <i class="fa-solid fa-upload"></i> Upload Document
          </button>
        </div>
        <div class="filter-bar" style="gap:10px;flex-wrap:wrap">
          <div class="filter-search" style="flex:1;min-width:160px">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" class="form-control" id="docsSearch" placeholder="Search file name or patient…">
          </div>
          <select class="form-select" id="docsTypeFilter" style="min-width:140px">
            <option value="">All Types</option>
          </select>
          <select class="form-select" id="docsPatientFilter" style="min-width:160px">
            <option value="">All Patients</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead><tr>
              <th style="width:32px"></th>
              <th>File Name</th>
              <th>Patient</th>
              <th>Type</th>
              <th>Uploaded By</th>
              <th>Date</th>
              <th>Size</th>
              <th>Retention</th>
              <th>Actions</th>
            </tr></thead>
            <tbody id="docsTbody"></tbody>
          </table>
        </div>
      </div>

      <!-- Upload Modal -->
      <div class="modal-overlay" id="docsUploadModal" style="display:none">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title"><i class="fa-solid fa-upload"></i> <span id="docsUploadTitle">Upload Document</span></div>
            <button class="modal-close" id="docsUploadClose">&times;</button>
          </div>
          <div class="modal-body">
            <div id="docsUploadAlert"></div>
            <div class="form-row">
              <div class="form-group" id="docsPatientGroup">
                <label class="form-label">Patient</label>
                <select class="form-select" id="docsUpPatient">
                  <option value="">— General / No Patient —</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Document Type <span class="required">*</span></label>
                <select class="form-select" id="docsUpType">
                  <option value="">— Select Type —</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">File <span class="required">*</span></label>
              <div id="docsDropZone" style="border:2px dashed var(--border);border-radius:8px;padding:28px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;color:var(--text-secondary)">
                <div id="docsDropText">
                  <i class="fa-solid fa-cloud-arrow-up" style="font-size:28px;margin-bottom:8px;display:block;color:var(--gold)"></i>
                  <div>Click to browse file</div>
                  <div style="font-size:11px;margin-top:4px;color:var(--text-muted)">PDF, Images, Word docs — max 50 MB</div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-control" id="docsUpNotes" style="min-height:56px" placeholder="Optional notes…"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="docsUploadCancelBtn">Cancel</button>
            <button class="btn btn-primary" id="docsUploadSubmitBtn">
              <i class="fa-solid fa-upload"></i> Upload
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Bind events ─────────────────────────────────────────────────────────────

  function bindEvents() {
    document.getElementById('docsUploadBtn').addEventListener('click', () => openUploadModal(null));
    document.getElementById('docsUploadClose').addEventListener('click', closeUploadModal);
    document.getElementById('docsUploadCancelBtn').addEventListener('click', closeUploadModal);
    document.getElementById('docsUploadSubmitBtn').addEventListener('click', submitUpload);
    document.getElementById('docsSearch').addEventListener('input', filterDocs);
    document.getElementById('docsTypeFilter').addEventListener('change', filterDocs);
    document.getElementById('docsPatientFilter').addEventListener('change', filterDocs);

    document.getElementById('docsDropZone').addEventListener('click', () => pickFile());
  }

  async function pickFile() {
    const result = await window.api.file.showOpenDialog({
      title: 'Select Document',
      filters: [
        { name: 'Documents', extensions: ['pdf','jpg','jpeg','png','gif','webp','doc','docx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (!result || result.canceled || !result.filePaths || !result.filePaths.length) return;
    const filePath = result.filePaths[0];
    const fileName = filePath.split(/[\\/]/).pop();
    document.getElementById('docsDropZone').dataset.filePath = filePath;
    document.getElementById('docsDropText').innerHTML = `
      <i class="fa-solid fa-circle-check" style="font-size:24px;margin-bottom:6px;display:block;color:var(--success,#2ecc71)"></i>
      <div style="font-weight:600;color:var(--gold)">${escHtmlLocal(fileName)}</div>
    `;
  }

  function escHtmlLocal(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function openUploadModal(patientId) {
    uploadPatientId = patientId;
    document.getElementById('docsUploadAlert').innerHTML = '';
    document.getElementById('docsUpType').value = '';
    document.getElementById('docsUpNotes').value = '';
    document.getElementById('docsDropZone').dataset.filePath = '';
    document.getElementById('docsDropText').innerHTML = `
      <i class="fa-solid fa-cloud-arrow-up" style="font-size:28px;margin-bottom:8px;display:block;color:var(--gold)"></i>
      <div>Click to browse file</div>
      <div style="font-size:11px;margin-top:4px;color:var(--text-muted)">PDF, Images, Word docs — max 50 MB</div>
    `;
    // Show/hide patient selector based on mode
    const patGroup = document.getElementById('docsPatientGroup');
    const patSel   = document.getElementById('docsUpPatient');
    if (patientId) {
      patGroup.style.display = 'none';
      patSel.value = String(patientId);
    } else {
      patGroup.style.display = '';
      patSel.value = '';
    }
    document.getElementById('docsUploadModal').style.display = 'flex';
  }

  function closeUploadModal() {
    document.getElementById('docsUploadModal').style.display = 'none';
  }

  async function submitUpload() {
    const filePath     = document.getElementById('docsDropZone').dataset.filePath;
    const document_type = document.getElementById('docsUpType').value;
    const notes        = document.getElementById('docsUpNotes').value.trim();
    const patient_id   = uploadPatientId || (document.getElementById('docsUpPatient').value || null);
    const alertEl      = document.getElementById('docsUploadAlert');

    if (!filePath)      { alertEl.innerHTML = '<div class="alert alert-danger">Please select a file</div>'; return; }
    if (!document_type) { alertEl.innerHTML = '<div class="alert alert-danger">Please select a document type</div>'; return; }

    const btn = document.getElementById('docsUploadSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…';

    const result = await window.api.docs.upload({ filePath, patient_id: patient_id ? parseInt(patient_id, 10) : null, document_type, notes });

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload';

    if (result.success) {
      closeUploadModal();
      toast('Document uploaded successfully', 'success');
      await loadDocs();
    } else {
      alertEl.innerHTML = `<div class="alert alert-danger">${escHtmlLocal(result.error)}</div>`;
    }
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  async function loadDocs() {
    allDocs = await window.api.docs.getAll().catch(() => []);
    filterDocs();
  }

  function filterDocs() {
    const search  = (document.getElementById('docsSearch')?.value || '').toLowerCase();
    const type    = document.getElementById('docsTypeFilter')?.value || '';
    const patId   = document.getElementById('docsPatientFilter')?.value || '';
    const filtered = allDocs.filter(d => {
      if (type  && d.document_type !== type)          return false;
      if (patId && String(d.patient_id) !== patId)    return false;
      if (search && !d.file_name.toLowerCase().includes(search) &&
          !(d.patient_name || '').toLowerCase().includes(search)) return false;
      return true;
    });
    renderTable(filtered);
  }

  function renderTable(docs) {
    const tb = document.getElementById('docsTbody');
    if (!tb) return;
    const user = window.App.getCurrentUser();
    const isAdmin = user && user.role === 'admin';
    if (!docs.length) {
      tb.innerHTML = '<tr><td colspan="9"><div class="table-empty"><i class="fa-solid fa-folder-open"></i><p>No documents found</p></div></td></tr>';
      return;
    }
    tb.innerHTML = docs.map(d => `<tr>
      <td>${docIcon(d.mime_type)}</td>
      <td><strong>${escHtmlLocal(d.file_name)}</strong></td>
      <td>${escHtmlLocal(d.patient_name || '—')}</td>
      <td><span class="badge badge-info" style="font-size:11px">${escHtmlLocal(d.document_type)}</span></td>
      <td>${escHtmlLocal(d.uploaded_by_name || '—')}</td>
      <td>${formatDate ? formatDate(d.created_at) : d.created_at}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${fmtBytes(d.file_size)}</td>
      <td style="font-size:12px">${retentionLabel(d.retention_date)}</td>
      <td>
        <button class="btn btn-xs btn-outline" onclick="window.Documents.viewDoc(${d.id})">
          <i class="fa-solid fa-eye"></i>
        </button>
        ${isAdmin ? `<button class="btn btn-xs btn-danger" style="margin-left:4px" onclick="window.Documents.deleteDoc(${d.id})">
          <i class="fa-solid fa-trash"></i>
        </button>` : ''}
      </td>
    </tr>`).join('');
  }

  async function viewDoc(id) {
    const result = await window.api.docs.view(id);
    if (!result.success) toast(result.error || 'Could not open file', 'error');
  }

  async function deleteDoc(id) {
    const ok = await appConfirm('Delete this document? This cannot be undone.');
    if (!ok) return;
    const result = await window.api.docs.delete(id);
    if (result.success) { toast('Document deleted', 'success'); await loadDocs(); }
    else toast(result.error || 'Delete failed', 'error');
  }

  // ── Patient-context helper (called from Patients module) ───────────────────

  async function renderPatientDocs(containerId, patientId) {
    const docs = await window.api.docs.getByPatient(patientId).catch(() => []);
    const user = window.App.getCurrentUser();
    const isAdmin = user && user.role === 'admin';
    const container = document.getElementById(containerId);
    if (!container) return;

    const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:13px;color:var(--text-secondary)">${docs.length} document${docs.length===1?'':'s'}</span>
      <button class="btn btn-sm btn-primary" onclick="window.Documents.openForPatient(${patientId})">
        <i class="fa-solid fa-upload"></i> Upload
      </button>
    </div>`;

    if (!docs.length) {
      container.innerHTML = header + '<div class="table-empty" style="padding:16px"><i class="fa-solid fa-folder-open"></i><p>No documents</p></div>';
      return;
    }

    const rows = docs.map(d => `<tr>
      <td>${docIcon(d.mime_type)}</td>
      <td><strong>${escHtmlLocal(d.file_name)}</strong></td>
      <td><span class="badge badge-info" style="font-size:11px">${escHtmlLocal(d.document_type)}</span></td>
      <td>${formatDate ? formatDate(d.created_at) : d.created_at}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${fmtBytes(d.file_size)}</td>
      <td>
        <button class="btn btn-xs btn-outline" onclick="window.Documents.viewDoc(${d.id})">View</button>
        ${isAdmin ? `<button class="btn btn-xs btn-danger" style="margin-left:4px" onclick="window.Documents.deleteDoc(${d.id})">Del</button>` : ''}
      </td>
    </tr>`).join('');

    container.innerHTML = header + `<div class="table-wrapper" style="max-height:260px;overflow-y:auto">
      <table class="table"><thead><tr><th style="width:28px"></th><th>File</th><th>Type</th><th>Date</th><th>Size</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  async function openForPatient(patientId) {
    openUploadModal(patientId);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  async function render() {
    const view = document.getElementById('view-documents');
    if (!view) return;
    if (!view.querySelector('#docsTbody')) {
      view.innerHTML = buildHTML();
      bindEvents();
    }

    [allPatients, docTypes] = await Promise.all([
      window.api.patients.getAll().catch(() => []),
      window.api.docs.getTypes().catch(() => []),
    ]);

    // Populate filter dropdowns
    const typeFilter = document.getElementById('docsTypeFilter');
    typeFilter.innerHTML = '<option value="">All Types</option>' +
      docTypes.map(t => `<option value="${escHtmlLocal(t)}">${escHtmlLocal(t)}</option>`).join('');

    const patFilter = document.getElementById('docsPatientFilter');
    patFilter.innerHTML = '<option value="">All Patients</option>' +
      allPatients.map(p => `<option value="${p.id}">${escHtmlLocal(p.first_name + ' ' + p.last_name)}</option>`).join('');

    // Populate upload modal dropdowns
    const upType = document.getElementById('docsUpType');
    upType.innerHTML = '<option value="">— Select Type —</option>' +
      docTypes.map(t => `<option value="${escHtmlLocal(t)}">${escHtmlLocal(t)}</option>`).join('');

    const upPat = document.getElementById('docsUpPatient');
    upPat.innerHTML = '<option value="">— General / No Patient —</option>' +
      allPatients.map(p => `<option value="${p.id}">${escHtmlLocal(p.first_name + ' ' + p.last_name)}</option>`).join('');

    await loadDocs();
  }

  return { render, viewDoc, deleteDoc, renderPatientDocs, openForPatient };
})();
