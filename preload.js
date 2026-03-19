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
    updateStatus: (id, status) => ipcRenderer.invoke('claims:update-status', { id, status }),
    getAll: () => ipcRenderer.invoke('claims:get-all')
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
    appointmentStats: (startDate, endDate) => ipcRenderer.invoke('reports:appointment-stats', { startDate, endDate })
  },
  file: {
    showOpenDialog: (options) => ipcRenderer.invoke('file:show-open-dialog', options)
  }
});
