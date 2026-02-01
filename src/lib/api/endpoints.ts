// API Endpoints
// Centralized endpoint definitions - single source of truth

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    MICROSOFT: '/auth/microsoft',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },

  // Users
  USERS: {
    LIST: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    CREATE: '/users',
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
  },

  // Parking Lots
  PARKING_LOTS: {
    LIST: '/parking-lots',
    BY_ID: (id: string) => `/parking-lots/${id}`,
    STATUS: (id: string) => `/parking-lots/${id}/status`,
    STATS: (id: string) => `/parking-lots/${id}/stats`,
    CREATE: '/parking-lots',
    UPDATE: (id: string) => `/parking-lots/${id}`,
    DELETE: (id: string) => `/parking-lots/${id}`,
  },

  // Zones
  ZONES: {
    LIST: '/zones',
    BY_ID: (id: string) => `/zones/${id}`,
    CREATE: '/zones',
    UPDATE: (id: string) => `/zones/${id}`,
    DELETE: (id: string) => `/zones/${id}`,
  },

  // Slots
  SLOTS: {
    LIST: '/slots',
    BY_ID: (id: string) => `/slots/${id}`,
    CREATE: '/slots',
    UPDATE: (id: string) => `/slots/${id}`,
    DELETE: (id: string) => `/slots/${id}`,
    BULK_UPDATE: '/slots/bulk-update',
  },

  // Tokens
  TOKENS: {
    LIST: '/tokens',
    BY_ID: (id: string) => `/tokens/${id}`,
    CREATE: '/tokens',
    UPDATE: (id: string) => `/tokens/${id}`,
    COMPLETE: (id: string) => `/tokens/${id}/complete`,
  },

  // Transactions
  TRANSACTIONS: {
    LIST: '/transactions',
    BY_ID: (id: string) => `/transactions/${id}`,
  },

  // Cameras
  CAMERAS: {
    LIST: '/cameras',
    BY_ID: (id: string) => `/cameras/${id}`,
    SNAPSHOT: (id: string) => `/cameras/${id}/snapshot`,
    STREAM: (id: string) => `/cameras/${id}/stream`,
    CREATE: '/cameras',
    UPDATE: (id: string) => `/cameras/${id}`,
    DELETE: (id: string) => `/cameras/${id}`,
  },

  // Gates
  GATES: {
    LIST: '/gates',
    BY_ID: (id: string) => `/gates/${id}`,
    OPEN: (id: string) => `/gates/${id}/open`,
    CLOSE: (id: string) => `/gates/${id}/close`,
  },

  // Displays
  DISPLAYS: {
    LIST: '/displays',
    BY_ID: (id: string) => `/displays/${id}`,
    UPDATE_MESSAGE: (id: string) => `/displays/${id}/message`,
  },

  // Vehicles
  VEHICLES: {
    LIST: '/vehicles',
    BY_ID: (id: string) => `/vehicles/${id}`,
    SEARCH: '/vehicles/search',
    CREATE: '/vehicles',
    UPDATE: (id: string) => `/vehicles/${id}`,
  },

  // Wallet
  WALLET: {
    GET: '/wallet',
    BY_ID: (id: string) => `/wallet/${id}`,
    BALANCE: (id: string) => `/wallet/${id}/balance`,
    TRANSACTIONS: (id: string) => `/wallet/${id}/transactions`,
  },

  // Bank Accounts
  BANK_ACCOUNTS: {
    LIST: '/bank-accounts',
    BY_ID: (id: string) => `/bank-accounts/${id}`,
    VERIFY: (id: string) => `/bank-accounts/${id}/verify`,
    CREATE: '/bank-accounts',
    DELETE: (id: string) => `/bank-accounts/${id}`,
  },

  // Payments
  PAYMENTS: {
    CREATE: '/payments',
    DEPOSIT: '/payments/deposit',
    WITHDRAW: '/payments/withdraw',
    TRANSFER: '/payments/transfer',
    PARKING: '/payments/parking',
    VERIFY: '/payments/verify',
    REQUEST: '/payments/request',
    REQUEST_BY_ID: (id: string) => `/payments/request/${id}`,
    REQUEST_PAY: (id: string) => `/payments/request/${id}/pay`,
  },

  // Analytics
  ANALYTICS: {
    DASHBOARD: '/analytics',
    PREDICTIVE: '/analytics/predictive',
    OCCUPANCY: '/analytics/occupancy',
    REVENUE: '/analytics/revenue',
  },

  // Reports
  REPORTS: {
    LIST: '/reports',
    EXPORT: '/reports/export',
    GENERATE: '/reports/generate',
  },

  // Settings
  SETTINGS: {
    GET: '/settings',
    UPDATE: '/settings',
    ORGANIZATION: '/settings/organization',
  },

  // Alerts
  ALERTS: {
    LIST: '/alerts',
    CREATE: '/alerts',
    UPDATE: (id: string) => `/alerts/${id}`,
    DELETE: (id: string) => `/alerts/${id}`,
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/notifications',
    MARK_READ: '/notifications/read',
    MARK_ALL_READ: '/notifications/read-all',
  },

  // Real-time Detection
  REALTIME: {
    DETECTION: '/realtime/detection',
  },

  // Find Car
  FIND_CAR: {
    SEARCH: '/find-car',
  },

  // Webhooks
  WEBHOOKS: {
    LIST: '/webhooks',
    BY_ID: (id: string) => `/webhooks/${id}`,
    CREATE: '/webhooks',
    DELETE: (id: string) => `/webhooks/${id}`,
  },

  // Sandbox
  SANDBOX: {
    CONFIGURE: '/sandbox',
    SIMULATE: '/sandbox/simulate',
    PAYMENT: '/sandbox/payment',
  },

  // System
  HEALTH: '/health',
  METRICS: '/metrics',
  SYNC: '/sync',
} as const
