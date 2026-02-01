// API Configuration
// Central configuration for all API-related settings

import { ENV } from './env.config'

export const API_CONFIG = {
  // Base URL for API requests
  BASE_URL: ENV.API_URL,

  // WebSocket URL for real-time connections
  WS_URL: ENV.WS_URL,

  // Request timeout in milliseconds
  TIMEOUT: 30000,

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
    BACKOFF_MULTIPLIER: 2,
  },

  // Rate limiting
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 100,
    WINDOW_MS: 60000,
  },
} as const

/**
 * Get the API base URL based on environment
 * In development: Uses Next.js API routes (/api)
 * In production with real backend: Uses external API URL
 */
export function getApiBaseUrl(): string {
  if (ENV.USE_REAL_BACKEND && ENV.API_URL) {
    return ENV.API_URL
  }
  // Use Next.js API routes (temporary during MVP)
  return '/api'
}

/**
 * Get the WebSocket URL for real-time connections
 */
export function getWebSocketUrl(): string {
  return API_CONFIG.WS_URL
}

/**
 * Get auth token from storage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  // Token is stored in httpOnly cookie, so we can't access it directly
  // The cookie is sent automatically with requests
  return null
}

/**
 * Headers for authenticated requests
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  return headers
}
