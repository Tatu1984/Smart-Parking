/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for symmetric encryption
 */

import crypto from 'crypto'
import { logger } from '@/lib/logger'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

// Get encryption key from environment or generate one for development
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (key) {
    // If key is provided, derive a 32-byte key from it
    return crypto.scryptSync(key, 'sparking-salt', 32)
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY environment variable is required in production')
  }

  // Development fallback - NOT SECURE FOR PRODUCTION
  logger.warn('WARNING: Using development encryption key. Set ENCRYPTION_KEY in production!')
  return crypto.scryptSync('dev-encryption-key-not-for-production', 'sparking-salt', 32)
}

/**
 * Encrypt a string value
 * Returns base64 encoded string: iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Combine iv, authTag, and encrypted data
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypt an encrypted string
 * Expects base64 encoded string: iv:authTag:encryptedData
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return encryptedData

  // Check if data is encrypted (contains our format)
  if (!encryptedData.includes(':')) {
    // Data is not encrypted, return as-is (for backwards compatibility)
    return encryptedData
  }

  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivBase64, authTagBase64, encrypted] = parts
  const key = getEncryptionKey()
  const iv = Buffer.from(ivBase64, 'base64')
  const authTag = Buffer.from(authTagBase64, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false
  const parts = value.split(':')
  return parts.length === 3 && parts.every(p => p.length > 0)
}

/**
 * Hash a value (one-way, for comparison)
 */
export function hash(value: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const hash = crypto.pbkdf2Sync(value, salt, 100000, 64, 'sha512')
  return `${salt.toString('base64')}:${hash.toString('base64')}`
}

/**
 * Verify a value against a hash
 */
export function verifyHash(value: string, storedHash: string): boolean {
  const [saltBase64, hashBase64] = storedHash.split(':')
  const salt = Buffer.from(saltBase64, 'base64')
  const originalHash = Buffer.from(hashBase64, 'base64')
  const newHash = crypto.pbkdf2Sync(value, salt, 100000, 64, 'sha512')
  return crypto.timingSafeEqual(originalHash, newHash)
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url')
}

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return generateSecureToken(32)
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) return false
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(storedToken)
    )
  } catch {
    return false
  }
}
