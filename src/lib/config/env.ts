/**
 * Environment Configuration & Validation
 * Validates all required environment variables at startup
 */

import { logger } from '@/lib/logger'

interface EnvConfig {
  // Database
  DATABASE_URL: string

  // Authentication
  JWT_SECRET: string

  // Encryption (for camera credentials, etc.)
  ENCRYPTION_KEY?: string

  // Payment (optional in development)
  RAZORPAY_KEY_ID?: string
  RAZORPAY_KEY_SECRET?: string
  RAZORPAY_WEBHOOK_SECRET?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string

  // AI Pipeline
  DETECTION_API_KEY?: string

  // Redis (optional - uses memory if not provided)
  REDIS_URL?: string

  // Email
  SMTP_HOST?: string
  SMTP_PORT?: number
  SMTP_USER?: string
  SMTP_PASS?: string

  // Application
  NODE_ENV: 'development' | 'production' | 'test'
  NEXT_PUBLIC_APP_URL?: string

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number
  RATE_LIMIT_MAX_REQUESTS: number

  // Session
  SESSION_MAX_AGE_DAYS: number
  MAX_SESSIONS_PER_USER: number

  // Cron
  CRON_SECRET?: string
}

class EnvironmentConfig {
  private static instance: EnvironmentConfig
  private config: EnvConfig
  private validated = false

  private constructor() {
    this.config = this.loadConfig()
  }

  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig()
    }
    return EnvironmentConfig.instance
  }

  private loadConfig(): EnvConfig {
    return {
      DATABASE_URL: process.env.DATABASE_URL || '',
      JWT_SECRET: process.env.JWT_SECRET || '',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      DETECTION_API_KEY: process.env.DETECTION_API_KEY,
      REDIS_URL: process.env.REDIS_URL,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      SESSION_MAX_AGE_DAYS: parseInt(process.env.SESSION_MAX_AGE_DAYS || '7'),
      MAX_SESSIONS_PER_USER: parseInt(process.env.MAX_SESSIONS_PER_USER || '5'),
      CRON_SECRET: process.env.CRON_SECRET,
    }
  }

  validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    const isProduction = this.config.NODE_ENV === 'production'

    // Required in all environments
    if (!this.config.DATABASE_URL) {
      errors.push('DATABASE_URL is required')
    }

    // Required in production
    if (isProduction) {
      if (!this.config.JWT_SECRET) {
        errors.push('JWT_SECRET is required in production')
      } else if (this.config.JWT_SECRET.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters')
      }

      if (!this.config.ENCRYPTION_KEY) {
        warnings.push('ENCRYPTION_KEY not set - camera credential encryption will be disabled')
      }

      if (!this.config.CRON_SECRET) {
        warnings.push('CRON_SECRET not set - cron endpoints will be disabled')
      }

      if (!this.config.RAZORPAY_WEBHOOK_SECRET && !this.config.STRIPE_WEBHOOK_SECRET) {
        warnings.push('No payment webhook secret configured')
      }

      if (!this.config.DETECTION_API_KEY) {
        warnings.push('DETECTION_API_KEY not set - AI detection endpoint will be disabled')
      }

      if (!this.config.REDIS_URL) {
        warnings.push('REDIS_URL not set - using in-memory rate limiting (not recommended for production)')
      }
    } else {
      // Development warnings
      if (!this.config.JWT_SECRET) {
        warnings.push('JWT_SECRET not set - using development fallback')
      }

      if (!this.config.DATABASE_URL) {
        errors.push('DATABASE_URL is required even in development')
      }
    }

    this.validated = true

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  get(key: keyof EnvConfig): EnvConfig[keyof EnvConfig] {
    return this.config[key]
  }

  getAll(): Readonly<EnvConfig> {
    return Object.freeze({ ...this.config })
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === 'production'
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development'
  }
}

// Singleton export
export const env = EnvironmentConfig.getInstance()

// Validation function to be called at startup
export function validateEnvironment(): void {
  const result = env.validate()

  if (result.warnings.length > 0) {
    logger.warn('Environment Warnings:')
    result.warnings.forEach((w) => logger.warn(`   - ${w}`))
  }

  if (!result.valid) {
    logger.error('Environment Validation Failed:')
    result.errors.forEach((e) => logger.error(`   - ${e}`))

    if (env.isProduction()) {
      throw new Error('Environment validation failed. Cannot start in production.')
    }
  } else {
    logger.info('Environment validation passed')
  }
}

// Export for use in other modules
export type { EnvConfig }
