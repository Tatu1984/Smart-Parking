// Application Configuration
// App-wide settings and feature flags

import { ENV } from './env.config'

export const APP_CONFIG = {
  // App metadata
  NAME: ENV.APP_NAME,
  VERSION: '0.1.0',
  DESCRIPTION: 'Smart Parking Management System',

  // Theme
  DEFAULT_THEME: 'system' as const,
  AVAILABLE_THEMES: ['light', 'dark', 'system'] as const,

  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100] as const,

  // Date/Time
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  DEFAULT_DATE_FORMAT: 'dd MMM yyyy',
  DEFAULT_TIME_FORMAT: 'HH:mm',
  DEFAULT_DATETIME_FORMAT: 'dd MMM yyyy HH:mm',

  // Currency
  DEFAULT_CURRENCY: 'INR',
  CURRENCY_LOCALE: 'en-IN',

  // Session
  SESSION_DURATION_DAYS: 7,
  SESSION_REFRESH_THRESHOLD_HOURS: 24,

  // Real-time
  POLLING_INTERVAL_MS: 30000, // 30 seconds
  REALTIME_RECONNECT_DELAY_MS: 5000,
  REALTIME_MAX_RECONNECT_ATTEMPTS: 10,

  // File Upload
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],

  // Feature Flags
  FEATURES: {
    MICROSOFT_LOGIN: Boolean(ENV.AZURE_AD_CLIENT_ID),
    PAYMENTS: Boolean(ENV.RAZORPAY_KEY_ID || ENV.STRIPE_SECRET_KEY),
    REAL_TIME_UPDATES: true,
    ANALYTICS_DASHBOARD: true,
    CAMERA_STREAMING: true,
    WALLET_SYSTEM: true,
    SANDBOX_MODE: ENV.IS_DEVELOPMENT,
  },
} as const

// Export type for theme
export type Theme = typeof APP_CONFIG.AVAILABLE_THEMES[number]
