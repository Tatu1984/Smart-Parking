// Environment Configuration
// Centralizes all environment variable access with type safety

export const ENV = {
  // App Core
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'SParking',

  // API Configuration
  API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  USE_REAL_BACKEND: process.env.NEXT_PUBLIC_USE_REAL_BACKEND === 'true',

  // WebSocket
  WS_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET,
  MAX_SESSIONS_PER_USER: parseInt(process.env.MAX_SESSIONS_PER_USER || '5'),

  // Azure AD
  AZURE_AD_CLIENT_ID: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID,
  AZURE_AD_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || 'common',
  AZURE_AD_REDIRECT_URI: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI,
  AZURE_AD_AUTO_CREATE_USERS: process.env.AZURE_AD_AUTO_CREATE_USERS !== 'false',
  AZURE_AD_DEFAULT_ROLE: process.env.AZURE_AD_DEFAULT_ROLE || 'ADMIN',

  // Detection API
  DETECTION_API_KEY: process.env.DETECTION_API_KEY,

  // Payment
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

  // Feature Flags
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
} as const

// Validation helpers
export function requireEnv(key: keyof typeof ENV): string {
  const value = ENV[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value as string
}

export function getEnvOrDefault<T>(key: keyof typeof ENV, defaultValue: T): T {
  const value = ENV[key]
  return (value ?? defaultValue) as T
}
