const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user')
  },
  patients: {
    getAll: () => ipcRenderer.invoke('patients:get-all'),
    getById: (id) => ipcRenderer.invoke('patients:get-by-id', id),
    create: (data) => ipcRenderer.invoke('patients:create', data),
    update: (id, data) => ipcRenderer.invoke('patients:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('patients:delete', id),
    search: (query) => ipcRenderer.invoke('patients:search', query),
    importCsv: (rows) => ipcRenderer.invoke('patients:import-csv', rows)
  },
  insurance: {
    getByPatient: (patientId) => ipcRenderer.invoke('insurance:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('insurance:create', data),
    update: (id, data) => ipcRenderer.invoke('insurance:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('insurance:delete', id)
  },
  appointments: {
    getAll: () => ipcRenderer.invoke('appointments:get-all'),
    getByDate: (startDate, endDate) => ipcRenderer.invoke('appointments:get-by-date', { startDate, endDate }),
    getByPatient: (patientId) => ipcRenderer.invoke('appointments:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('appointments:create', data),
    update: (id, data) => ipcRenderer.invoke('appointments:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('appointments:delete', id),
    updateStatus: (id, status) => ipcRenderer.invoke('appointments:update-status', { id, status })
  },
  visitNotes: {
    getByAppointment: (appointmentId) => ipcRenderer.invoke('visit-notes:get-by-appointment', appointmentId),
    create: (data) => ipcRenderer.invoke('visit-notes:create', data),
    update: (id, data) => ipcRenderer.invoke('visit-notes:update', { id, data })
  },
  claims: {
    getAll: () => ipcRenderer.invoke('claims:get-all'),
    getByPatient: (patientId) => ipcRenderer.invoke('claims:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('claims:create', data),
    update: (id, data) => ipcRenderer.invoke('claims:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('claims:delete', id),
    updateStatus: (id, status) => ipcRenderer.invoke('claims:update-status', { id, status })
  },
  payments: {
    getByPatient: (patientId) => ipcRenderer.invoke('payments:get-by-patient', patientId),
    getAll: () => ipcRenderer.invoke('payments:get-all'),
    create: (data) => ipcRenderer.invoke('payments:create', data)
  },
  referrals: {
    getAll: () => ipcRenderer.invoke('referrals:get-all'),
    getByPatient: (patientId) => ipcRenderer.invoke('referrals:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('referrals:create', data),
    update: (id, data) => ipcRenderer.invoke('referrals:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('referrals:delete', id),
    sendReferral: (id) => ipcRenderer.invoke('referrals:send-referral', id)
  },
  reports: {
    revenueSummary: (startDate, endDate) => ipcRenderer.invoke('reports:revenue-summary', { startDate, endDate }),
    appointmentStats: (startDate, endDate) => ipcRenderer.invoke('reports:appointment-stats', { startDate, endDate }),
    fullDashboard: (startDate, endDate) => ipcRenderer.invoke('reports:full-dashboard', { startDate, endDate })
  },
  locations: {
    getAll: () => ipcRenderer.invoke('locations:get-all'),
    create: (data) => ipcRenderer.invoke('locations:create', data),
    update: (id, data) => ipcRenderer.invoke('locations:update', { id, data })
  },
  intake: {
    getAll: () => ipcRenderer.invoke('intake:get-all'),
    getByPatient: (patientId) => ipcRenderer.invoke('intake:get-by-patient', patientId),
    getById: (id) => ipcRenderer.invoke('intake:get-by-id', id),
    create: (data) => ipcRenderer.invoke('intake:create', data),
    update: (id, data) => ipcRenderer.invoke('intake:update', { id, data })
  },
  insVerify: {
    getByPatient: (patientId) => ipcRenderer.invoke('insverify:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('insverify:create', data),
    update: (id, data) => ipcRenderer.invoke('insverify:update', { id, data })
  },
  soap: {
    getAll: () => ipcRenderer.invoke('soap:get-all'),
    getByAppointment: (appointmentId) => ipcRenderer.invoke('soap:get-by-appointment', appointmentId),
    getByPatient: (patientId) => ipcRenderer.invoke('soap:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('soap:create', data),
    update: (id, data) => ipcRenderer.invoke('soap:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('soap:delete', id)
  },
  eob: {
    getAll: () => ipcRenderer.invoke('eob:get-all'),
    getByPatient: (patientId) => ipcRenderer.invoke('eob:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('eob:create', data),
    update: (id, data) => ipcRenderer.invoke('eob:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('eob:delete', id)
  },
  reminders: {
    getTemplates: () => ipcRenderer.invoke('reminders:get-templates'),
    createTemplate: (data) => ipcRenderer.invoke('reminders:create-template', data),
    updateTemplate: (id, data) => ipcRenderer.invoke('reminders:update-template', { id, data }),
    deleteTemplate: (id) => ipcRenderer.invoke('reminders:delete-template', id),
    getLog: () => ipcRenderer.invoke('reminders:get-log'),
    send: (appointmentId, templateId) => ipcRenderer.invoke('reminders:send', { appointmentId, templateId })
  },
  waitlist: {
    getAll: () => ipcRenderer.invoke('waitlist:get-all'),
    create: (data) => ipcRenderer.invoke('waitlist:create', data),
    updateStatus: (id, status) => ipcRenderer.invoke('waitlist:update-status', { id, status }),
    delete: (id) => ipcRenderer.invoke('waitlist:delete', id)
  },
  transport: {
    getAll: () => ipcRenderer.invoke('transport:get-all'),
    getByPatient: (patientId) => ipcRenderer.invoke('transport:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('transport:create', data),
    update: (id, data) => ipcRenderer.invoke('transport:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('transport:delete', id)
  },
  pi: {
    getAll: () => ipcRenderer.invoke('pi:get-all'),
    getByPatient: (patientId) => ipcRenderer.invoke('pi:get-by-patient', patientId),
    create: (data) => ipcRenderer.invoke('pi:create', data),
    update: (id, data) => ipcRenderer.invoke('pi:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('pi:delete', id)
  },
  timeclock: {
    clockIn: (userId, notes) => ipcRenderer.invoke('timeclock:clock-in', { userId, notes }),
    clockOut: (userId) => ipcRenderer.invoke('timeclock:clock-out', { userId }),
    getStatus: (userId) => ipcRenderer.invoke('timeclock:get-status', userId),
    getEntries: (userId, startDate, endDate) => ipcRenderer.invoke('timeclock:get-entries', { userId, startDate, endDate }),
    approve: (id, approverId) => ipcRenderer.invoke('timeclock:approve', { id, approverId }),
    update: (id, data) => ipcRenderer.invoke('timeclock:update', { id, data }),
    getAllUsers: () => ipcRenderer.invoke('timeclock:get-all-users')
  },
  sapi: {
    start:    () => ipcRenderer.invoke('sapi:start'),
    stop:     () => ipcRenderer.invoke('sapi:stop'),
    onResult: (cb) => ipcRenderer.on('sapi:result', (_e, text) => cb(text)),
    removeResultListeners: () => ipcRenderer.removeAllListeners('sapi:result')
  },
  pipelineTest: {
    start:           () => ipcRenderer.invoke('start-dictation'),
    stop:            () => ipcRenderer.invoke('stop-dictation'),
    onResult:        (cb) => ipcRenderer.on('dictation-result', (_e, data) => cb(data)),
    removeListeners: () => ipcRenderer.removeAllListeners('dictation-result')
  },
  hcfa: {
    getByPatient: (patientId) => ipcRenderer.invoke('hcfa:get-by-patient', patientId),
    getBySoap: (soapNoteId) => ipcRenderer.invoke('hcfa:get-by-soap', soapNoteId),
    create: (data) => ipcRenderer.invoke('hcfa:create', data),
    update: (id, data) => ipcRenderer.invoke('hcfa:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('hcfa:delete', id)
  },
  file: {
    showOpenDialog: (options) => ipcRenderer.invoke('file:show-open-dialog', options),
    saveDialog: (defaultPath, content) => ipcRenderer.invoke('file:save-dialog', { defaultPath, content })
  },
  print: {
    showDialog: () => ipcRenderer.invoke('print:show-dialog')
  }
});
